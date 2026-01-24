import { Keypair, PublicKey, Connection, Commitment } from "@solana/web3.js";
import { createMint, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import wallet from "../turbin3-wallet.json"

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

const token_decimals = 1_000_000n;

// Mint address
const mint = new PublicKey("<mint address>");

(async () => {
    try {
        // Create an ATA
         const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey,
            true,
            commitment
         )
  
      
        console.log(`Your mint txid: ${mint}`);
    } catch(error) {
        console.log(`Oops, something went wrong: ${error}`)
    }
})()
