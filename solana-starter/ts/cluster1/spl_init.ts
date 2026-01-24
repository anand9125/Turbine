import { Keypair, Connection, Commitment } from "@solana/web3.js";
import { createMint } from '@solana/spl-token';
import wallet from "../turbin3-wallet.json"

const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

(async () => {
    try {
        // Start here
        const mintTx = await createMint(
            connection,
            keypair,
            keypair.publicKey,
            keypair.publicKey,
            6
        )
    } catch(error) {
        console.log(`Oops, something went wrong: ${error}`)
    }
})()
