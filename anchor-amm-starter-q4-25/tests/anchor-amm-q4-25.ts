import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("anchor-amm-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorAmmQ425 as Program<AnchorAmmQ425>;
  
  // Test accounts
  let mintX: PublicKey;
  let mintY: PublicKey;
  let mintAuthority: Keypair;
  
  // PDAs
  let config: PublicKey;
  let mintLp: PublicKey;
  let vaultX: PublicKey;
  let vaultY: PublicKey;
  
  // User accounts
  let user: Keypair;
  let userX: PublicKey;
  let userY: PublicKey;
  let userLp: PublicKey;
  
  // Second user for multi-user tests
  let user2: Keypair;
  let user2X: PublicKey;
  let user2Y: PublicKey;
  let user2Lp: PublicKey;
  
  const seed = new anchor.BN(1);
  const fee = 30; // 0.3%
  
  // Helper function to derive PDAs
  const derivePDAs = async (seedNum: anchor.BN) => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seedNum.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    const [lpMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), configPda.toBuffer()],
      program.programId
    );
    
    return { configPda, lpMintPda };
  };
  
  // Helper function to get token balance
  const getTokenBalance = async (tokenAccount: PublicKey): Promise<bigint> => {
    const account = await getAccount(provider.connection, tokenAccount);
    return account.amount;
  };
  
  // Setup before all tests
  before(async () => {
    // Create mint authority
    mintAuthority = Keypair.generate();
    
    // Airdrop SOL to mint authority
    const airdropSig = await provider.connection.requestAirdrop(
      mintAuthority.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
    
    // Create token mints
    mintX = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6 // decimals
    );
    
    mintY = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6 // decimals
    );
    
    // Create users
    user = Keypair.generate();
    user2 = Keypair.generate();
    
    // Airdrop SOL to users
    const airdrop1 = await provider.connection.requestAirdrop(
      user.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    const airdrop2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop1);
    await provider.connection.confirmTransaction(airdrop2);
    
    // Create user token accounts
    const userXAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mintX,
      user.publicKey
    );
    userX = userXAccount.address;
    
    const userYAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mintY,
      user.publicKey
    );
    userY = userYAccount.address;
    
    const user2XAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user2,
      mintX,
      user2.publicKey
    );
    user2X = user2XAccount.address;
    
    const user2YAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user2,
      mintY,
      user2.publicKey
    );
    user2Y = user2YAccount.address;
    
    // Mint tokens to users
    await mintTo(
      provider.connection,
      mintAuthority,
      mintX,
      userX,
      mintAuthority,
      10_000_000_000 // 10,000 tokens
    );
    
    await mintTo(
      provider.connection,
      mintAuthority,
      mintY,
      userY,
      mintAuthority,
      10_000_000_000
    );
    
    await mintTo(
      provider.connection,
      mintAuthority,
      mintX,
      user2X,
      mintAuthority,
      10_000_000_000
    );
    
    await mintTo(
      provider.connection,
      mintAuthority,
      mintY,
      user2Y,
      mintAuthority,
      10_000_000_000
    );
  });

  // ============================================================================
  // Initialize Tests
  // ============================================================================

  describe("Initialize", () => {
    it("Successfully initializes AMM pool", async () => {
      const { configPda, lpMintPda } = await derivePDAs(seed);
      config = configPda;
      mintLp = lpMintPda;
      
      // Derive vault addresses using getAssociatedTokenAddress
      vaultX = await getAssociatedTokenAddress(
        mintX,
        config,
        true // allowOwnerOffCurve
      );
      
      vaultY = await getAssociatedTokenAddress(
        mintY,
        config,
        true
      );
      
      await program.methods
        .initialize(seed, fee, null)
        .accounts({
          initalizer: provider.wallet.publicKey,
          mintX: mintX,
          mintY: mintY,
          mintLp: mintLp,
          vaultX: vaultX,
          vualtY: vaultY,
          config: config,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      // Verify config account
      const configAccount = await program.account.config.fetch(config);
      assert.equal(configAccount.seed.toNumber(), seed.toNumber());
      assert.equal(configAccount.fee, fee);
      assert.equal(configAccount.mintX.toBase58(), mintX.toBase58());
      assert.equal(configAccount.mintY.toBase58(), mintY.toBase58());
      assert.equal(configAccount.locked, false);
      assert.equal(configAccount.authority, null);
    });
    
    it("Fails to initialize with same seed twice", async () => {
      try {
        await program.methods
          .initialize(seed, fee, null)
          .accounts({
            initalizer: provider.wallet.publicKey,
            mintX: mintX,
            mintY: mintY,
            mintLp: mintLp,
            vaultX: vaultX,
            vualtY: vaultY,
            config: config,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed with duplicate seed");
      } catch (error) {
        assert.ok(error);
      }
    });
    
    it("Initializes with custom authority", async () => {
      const customSeed = new anchor.BN(2);
      const customAuthority = Keypair.generate();
      const { configPda, lpMintPda } = await derivePDAs(customSeed);
      
      const vaultXPda = await getAssociatedTokenAddress(
        mintX,
        configPda,
        true
      );
      
      const vaultYPda = await getAssociatedTokenAddress(
        mintY,
        configPda,
        true
      );
      
      await program.methods
        .initialize(customSeed, fee, customAuthority.publicKey)
        .accounts({
          initalizer: provider.wallet.publicKey,
          mintX: mintX,
          mintY: mintY,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vualtY: vaultYPda,
          config: configPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      const configAccount = await program.account.config.fetch(configPda);
      assert.equal(
        configAccount.authority.toBase58(), 
        customAuthority.publicKey.toBase58()
      );
    });
  });

  // ============================================================================
  // Deposit Tests
  // ============================================================================

  describe("Deposit", () => {
    before(async () => {
      // Derive user LP token account
      userLp = await getAssociatedTokenAddress(
        mintLp,
        user.publicKey,
        false
      );
    });
    
    it("Deposits initial liquidity", async () => {
      const lpAmount = new anchor.BN(1_000_000); // 1 LP token
      const maxX = new anchor.BN(1_000_000); // 1 X token
      const maxY = new anchor.BN(2_000_000); // 2 Y tokens
      
      await program.methods
        .deposit(lpAmount, maxX, maxY)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      // Verify vault balances
      const vaultXBalance = await getTokenBalance(vaultX);
      const vaultYBalance = await getTokenBalance(vaultY);
      assert.equal(vaultXBalance.toString(), maxX.toString());
      assert.equal(vaultYBalance.toString(), maxY.toString());
      
      // Verify user LP balance
      const userLpBalance = await getTokenBalance(userLp);
      assert.equal(userLpBalance.toString(), lpAmount.toString());
    });
    
    it("Deposits proportional liquidity", async () => {
      // Pool now has: 1_000_000 X, 2_000_000 Y, 1_000_000 LP supply
      const lpAmount = new anchor.BN(500_000); // 0.5 LP token
      // Should require: 500_000 X and 1_000_000 Y
      const maxX = new anchor.BN(600_000); // Allow slippage
      const maxY = new anchor.BN(1_100_000);
      
      const vaultXBefore = await getTokenBalance(vaultX);
      const vaultYBefore = await getTokenBalance(vaultY);
      const userLpBefore = await getTokenBalance(userLp);
      
      await program.methods
        .deposit(lpAmount, maxX, maxY)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const vaultXAfter = await getTokenBalance(vaultX);
      const vaultYAfter = await getTokenBalance(vaultY);
      const userLpAfter = await getTokenBalance(userLp);
      
      // Verify proportional deposit
      const expectedX = 500_000;
      const expectedY = 1_000_000;
      
      assert.equal(
        (vaultXAfter - vaultXBefore).toString(), 
        expectedX.toString()
      );
      assert.equal(
        (vaultYAfter - vaultYBefore).toString(), 
        expectedY.toString()
      );
      assert.equal(
        (userLpAfter - userLpBefore).toString(), 
        lpAmount.toString()
      );
    });
    
    it("Fails with zero amount", async () => {
      const lpAmount = new anchor.BN(0);
      const maxX = new anchor.BN(1_000_000);
      const maxY = new anchor.BN(2_000_000);
      
      try {
        await program.methods
          .deposit(lpAmount, maxX, maxY)
          .accounts({
            user: user.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            mintLp: mintLp,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: userX,
            userY: userY,
            userLp: userLp,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with InvalidAmount");
      } catch (error) {
        assert.include(error.toString(), "InvalidAmount");
      }
    });
    
    it("Fails when slippage exceeded on X", async () => {
      const lpAmount = new anchor.BN(100_000);
      const maxX = new anchor.BN(50_000); // Too low
      const maxY = new anchor.BN(200_000);
      
      try {
        await program.methods
          .deposit(lpAmount, maxX, maxY)
          .accounts({
            user: user.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            mintLp: mintLp,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: userX,
            userY: userY,
            userLp: userLp,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with SlippageExceeded");
      } catch (error) {
        assert.include(error.toString(), "SlippageExceeded");
      }
    });
    
    it("Fails when slippage exceeded on Y", async () => {
      const lpAmount = new anchor.BN(100_000);
      const maxX = new anchor.BN(200_000);
      const maxY = new anchor.BN(100_000); // Too low
      
      try {
        await program.methods
          .deposit(lpAmount, maxX, maxY)
          .accounts({
            user: user.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            mintLp: mintLp,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: userX,
            userY: userY,
            userLp: userLp,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with SlippageExceeded");
      } catch (error) {
        assert.include(error.toString(), "SlippageExceeded");
      }
    });
    
    it("Creates LP token account for new user", async () => {
      user2Lp = await getAssociatedTokenAddress(
        mintLp,
        user2.publicKey,
        false
      );
      
      // Verify account doesn't exist
      try {
        await getAccount(provider.connection, user2Lp);
        assert.fail("Account should not exist yet");
      } catch (error) {
        // Expected
      }
      
      const lpAmount = new anchor.BN(100_000);
      const maxX = new anchor.BN(200_000);
      const maxY = new anchor.BN(400_000);
      
      await program.methods
        .deposit(lpAmount, maxX, maxY)
        .accounts({
          user: user2.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: user2X,
          userY: user2Y,
          userLp: user2Lp,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();
      
      // Verify account now exists
      const user2LpBalance = await getTokenBalance(user2Lp);
      assert.equal(user2LpBalance.toString(), lpAmount.toString());
    });
  });

  // ============================================================================
  // Swap Tests
  // ============================================================================

  describe("Swap", () => {
    it("Swaps X for Y successfully", async () => {
      const amountIn = new anchor.BN(100_000); // 0.1 X token
      const minOut = new anchor.BN(150_000); // Expect ~0.18 Y (allowing slippage)
      const isX = true;
      
      const userXBefore = await getTokenBalance(userX);
      const userYBefore = await getTokenBalance(userY);
      const vaultXBefore = await getTokenBalance(vaultX);
      const vaultYBefore = await getTokenBalance(vaultY);
      
      await program.methods
        .swap(isX, amountIn, minOut)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const userXAfter = await getTokenBalance(userX);
      const userYAfter = await getTokenBalance(userY);
      const vaultXAfter = await getTokenBalance(vaultX);
      const vaultYAfter = await getTokenBalance(vaultY);
      
      // Verify user balances changed correctly
      assert.equal(
        (userXBefore - userXAfter).toString(),
        amountIn.toString()
      );
      assert.ok(userYAfter > userYBefore);
      assert.ok(userYAfter - userYBefore >= BigInt(minOut.toString()));
      
      // Verify vault balances
      assert.equal(
        (vaultXAfter - vaultXBefore).toString(),
        amountIn.toString()
      );
      assert.ok(vaultYBefore > vaultYAfter);
    });
    
    it("Swaps Y for X successfully", async () => {
      const amountIn = new anchor.BN(200_000); // 0.2 Y token
      const minOut = new anchor.BN(50_000); // Expect ~0.06 X
      const isX = false;
      
      const userXBefore = await getTokenBalance(userX);
      const userYBefore = await getTokenBalance(userY);
      
      await program.methods
        .swap(isX, amountIn, minOut)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const userXAfter = await getTokenBalance(userX);
      const userYAfter = await getTokenBalance(userY);
      
      // Verify balances
      assert.ok(userXAfter > userXBefore);
      assert.equal(
        (userYBefore - userYAfter).toString(),
        amountIn.toString()
      );
      assert.ok(userXAfter - userXBefore >= BigInt(minOut.toString()));
    });
    
    it("Fails with zero amount", async () => {
      const amountIn = new anchor.BN(0);
      const minOut = new anchor.BN(0);
      const isX = true;
      
      try {
        await program.methods
          .swap(isX, amountIn, minOut)
          .accounts({
            user: user.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: userX,
            userY: userY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with InvalidAmount");
      } catch (error) {
        assert.include(error.toString(), "InvalidAmount");
      }
    });
    
    it("Fails when slippage exceeded", async () => {
      const amountIn = new anchor.BN(100_000);
      const minOut = new anchor.BN(10_000_000); // Unrealistically high
      const isX = true;
      
      try {
        await program.methods
          .swap(isX, amountIn, minOut)
          .accounts({
            user: user.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: userX,
            userY: userY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        assert.fail("Should have failed with slippage");
      } catch (error) {
        assert.ok(error);
      }
    });
    
    it("Handles large swap with price impact", async () => {
      const vaultXBefore = await getTokenBalance(vaultX);
      const vaultYBefore = await getTokenBalance(vaultY);
      
      // Large swap: 10% of pool
      const amountIn = new anchor.BN(Number(vaultXBefore) / 10);
      const minOut = new anchor.BN(1); // Just need some output
      const isX = true;
      
      await program.methods
        .swap(isX, amountIn, minOut)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const vaultXAfter = await getTokenBalance(vaultX);
      const vaultYAfter = await getTokenBalance(vaultY);
      
      // Verify constant product (k should increase or stay same due to fees)
      const kBefore = vaultXBefore * vaultYBefore;
      const kAfter = vaultXAfter * vaultYAfter;
      assert.ok(kAfter >= kBefore);
    });
  });

  // ============================================================================
  // Withdraw Tests
  // ============================================================================

  describe("Withdraw", () => {
    it("Withdraws partial liquidity", async () => {
      const userLpBefore = await getTokenBalance(userLp);
      const vaultXBefore = await getTokenBalance(vaultX);
      const vaultYBefore = await getTokenBalance(vaultY);
      const userXBefore = await getTokenBalance(userX);
      const userYBefore = await getTokenBalance(userY);
      
      // Withdraw 25% of LP tokens
      const amount = new anchor.BN(Number(userLpBefore) / 4);
      const minX = new anchor.BN(1);
      const minY = new anchor.BN(1);
      
      await program.methods
        .withdraw(amount, minX, minY)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const userLpAfter = await getTokenBalance(userLp);
      const userXAfter = await getTokenBalance(userX);
      const userYAfter = await getTokenBalance(userY);
      
      // Verify LP tokens burned
      assert.equal(
        (userLpBefore - userLpAfter).toString(),
        amount.toString()
      );
      
      // Verify user received tokens
      assert.ok(userXAfter > userXBefore);
      assert.ok(userYAfter > userYBefore);
    });
    
    it("Withdraws all liquidity", async () => {
      const userLpBefore = await getTokenBalance(userLp);
      const amount = new anchor.BN(Number(userLpBefore));
      const minX = new anchor.BN(1);
      const minY = new anchor.BN(1);
      
      await program.methods
        .withdraw(amount, minX, minY)
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: userX,
          userY: userY,
          userLp: userLp,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const userLpAfter = await getTokenBalance(userLp);
      
      // Verify all LP tokens burned
      assert.equal(userLpAfter.toString(), "0");
    });
    
    it("Fails with zero amount", async () => {
      // First deposit some liquidity for user2
      await program.methods
        .deposit(new anchor.BN(100_000), new anchor.BN(500_000), new anchor.BN(1_000_000))
        .accounts({
          user: user2.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: config,
          mintLp: mintLp,
          vaultX: vaultX,
          vaultY: vaultY,
          userX: user2X,
          userY: user2Y,
          userLp: user2Lp,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();
      
      try {
        await program.methods
          .withdraw(new anchor.BN(0), new anchor.BN(1), new anchor.BN(1))
          .accounts({
            user: user2.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            mintLp: mintLp,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: user2X,
            userY: user2Y,
            userLp: user2Lp,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();
        assert.fail("Should have failed with InvalidAmount");
      } catch (error) {
        assert.include(error.toString(), "InvalidAmount");
      }
    });
    
    it("Fails when slippage exceeded", async () => {
      const userLpBalance = await getTokenBalance(user2Lp);
      const amount = new anchor.BN(Number(userLpBalance) / 2);
      const minX = new anchor.BN(10_000_000); // Unrealistically high
      const minY = new anchor.BN(1);
      
      try {
        await program.methods
          .withdraw(amount, minX, minY)
          .accounts({
            user: user2.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            mintLp: mintLp,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: user2X,
            userY: user2Y,
            userLp: user2Lp,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();
        assert.fail("Should have failed with SlippageExceeded");
      } catch (error) {
        assert.include(error.toString(), "SlippageExceeded");
      }
    });
    
    it("Fails when withdrawing more than owned", async () => {
      const userLpBalance = await getTokenBalance(user2Lp);
      const amount = new anchor.BN(Number(userLpBalance) * 2);
      const minX = new anchor.BN(1);
      const minY = new anchor.BN(1);
      
      try {
        await program.methods
          .withdraw(amount, minX, minY)
          .accounts({
            user: user2.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: config,
            mintLp: mintLp,
            vaultX: vaultX,
            vaultY: vaultY,
            userX: user2X,
            userY: user2Y,
            userLp: user2Lp,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();
        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        assert.ok(error);
      }
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration", () => {
    it("Complete lifecycle: deposit, swap, withdraw", async () => {
      // Setup new pool
      const newSeed = new anchor.BN(100);
      const { configPda, lpMintPda } = await derivePDAs(newSeed);
      
      const vaultXPda = await getAssociatedTokenAddress(
        mintX,
        configPda,
        true
      );
      
      const vaultYPda = await getAssociatedTokenAddress(
        mintY,
        configPda,
        true
      );
      
      const user2LpPda = await getAssociatedTokenAddress(
        lpMintPda,
        user2.publicKey,
        false
      );
      
      // Initialize
      await program.methods
        .initialize(newSeed, fee, null)
        .accounts({
          initalizer: provider.wallet.publicKey,
          mintX: mintX,
          mintY: mintY,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vualtY: vaultYPda,
          config: configPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      // User deposits initial liquidity
      await program.methods
        .deposit(
          new anchor.BN(1_000_000),
          new anchor.BN(1_000_000),
          new anchor.BN(2_000_000)
        )
        .accounts({
          user: user2.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          userX: user2X,
          userY: user2Y,
          userLp: user2LpPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();
      
      // Perform swap
      await program.methods
        .swap(true, new anchor.BN(50_000), new anchor.BN(1))
        .accounts({
          user: user2.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          userX: user2X,
          userY: user2Y,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();
      
      // Withdraw all liquidity
      const lpBalance = await getTokenBalance(user2LpPda);
      await program.methods
        .withdraw(
          new anchor.BN(Number(lpBalance)),
          new anchor.BN(1),
          new anchor.BN(1)
        )
        .accounts({
          user: user2.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          userX: user2X,
          userY: user2Y,
          userLp: user2LpPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();
      
      // Verify final state
      const finalLpBalance = await getTokenBalance(user2LpPda);
      assert.equal(finalLpBalance.toString(), "0");
    });
    
    it("Fee accumulation benefits LPs", async () => {
      // Setup new pool
      const newSeed = new anchor.BN(200);
      const { configPda, lpMintPda } = await derivePDAs(newSeed);
      
      const vaultXPda = await getAssociatedTokenAddress(
        mintX,
        configPda,
        true
      );
      
      const vaultYPda = await getAssociatedTokenAddress(
        mintY,
        configPda,
        true
      );
      
      const userLpPda = await getAssociatedTokenAddress(
        lpMintPda,
        user.publicKey,
        false
      );
      
      // Initialize
      await program.methods
        .initialize(newSeed, fee, null)
        .accounts({
          initalizer: provider.wallet.publicKey,
          mintX: mintX,
          mintY: mintY,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vualtY: vaultYPda,
          config: configPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      // Deposit liquidity
      await program.methods
        .deposit(
          new anchor.BN(1_000_000),
          new anchor.BN(1_000_000),
          new anchor.BN(1_000_000)
        )
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          userX: userX,
          userY: userY,
          userLp: userLpPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const userXBefore = await getTokenBalance(userX);
      const userYBefore = await getTokenBalance(userY);
      
      // Perform multiple swaps (generates fees)
      for (let i = 0; i < 5; i++) {
        await program.methods
          .swap(true, new anchor.BN(10_000), new anchor.BN(1))
          .accounts({
            user: user.publicKey,
            mintX: mintX,
            mintY: mintY,
            config: configPda,
            vaultX: vaultXPda,
            vaultY: vaultYPda,
            userX: userX,
            userY: userY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
      }
      
      // Withdraw all liquidity
      const lpBalance = await getTokenBalance(userLpPda);
      await program.methods
        .withdraw(
          new anchor.BN(Number(lpBalance)),
          new anchor.BN(1),
          new anchor.BN(1)
        )
        .accounts({
          user: user.publicKey,
          mintX: mintX,
          mintY: mintY,
          config: configPda,
          mintLp: lpMintPda,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          userX: userX,
          userY: userY,
          userLp: userLpPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      const userXAfter = await getTokenBalance(userX);
      const userYAfter = await getTokenBalance(userY);
      
      // User should have benefited from fees
      // They deposited 1_000_000 of each, but should get back more due to accumulated fees
      const totalValueBefore = Number(userXBefore) + Number(userYBefore);
      const totalValueAfter = Number(userXAfter) + Number(userYAfter);
      
      assert.ok(totalValueAfter > totalValueBefore, "LP should profit from fees");
    });
  });
});