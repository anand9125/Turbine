import wallet from "../turbin3-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createGenericFile, createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"
import { readFile } from "fs/promises"

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');  //used for nft related opretion

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader());
umi.use(signerIdentity(signer));

(async () => {
    try {
        //1. Load image
        //2. Convert image to generic file.
        //3. Upload image
        const imageBuffer = await readFile("./cluster1/nft.png")
        console.log(imageBuffer)

        
        //node js give you buffer we need to convert buffer to generic file
        //UMI needs metadata:
        // filename
        // contentType (image/png, image/jpeg, etc.)
        const imageFile = createGenericFile(imageBuffer, "nft.png", {
           contentType: "image/png"
        })

        const [myUri] = await umi.uploader.upload([imageFile])
        console.log("Your image URI: ", myUri);
        
    }
    catch(error) {
        console.log("Oops.. Something went wrong", error);
    }
})();
