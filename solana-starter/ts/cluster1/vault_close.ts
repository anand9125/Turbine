import {
  Connection,
  Keypair,
  SystemProgram,
  PublicKey,
  Commitment,
} from "@solana/web3.js";
import {
  Program,
  Wallet,
  AnchorProvider,
  Address,
  BN,
} from "@coral-xyz/anchor";
import { WbaVault, IDL } from "./programs/wba_vault";
import wallet from "../turbin3-wallet.json"

const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

const commitment: Commitment = "confirmed";

const connection = new Connection("https://api.devnet.solana.com");

const provider = new AnchorProvider(connection, new Wallet(keypair), {
  commitment,
});

// Create our program
const program = new Program<WbaVault>(IDL, "<address>" as Address, provider);

// Create a random keypair
const vaultState = new PublicKey("<address>");

// Create a random keypair
// const closeVaultState = ???

(async () => {
  try {
    // const signature = await program.methods
    // .closeAccount()
    // .accounts({
    //     ???
    // })
    // .signers([
    //     keypair
    // ]).rpc();
    // console.log(`Close success! Check out your TX here:\n\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`);
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
