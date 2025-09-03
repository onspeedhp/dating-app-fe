/**
 * Script to initialize computation definitions for Dating App
 * This should be run once by the program deployer
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
// import { Contract } from "../lib/contract"; // Using JSON IDL instead
import * as fs from "fs";
import * as os from "os";
import {
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  buildFinalizeCompDefTx,
  getMXEAccAddress,
  getClusterAccAddress,
  getArciumEnv,
} from "@arcium-hq/client";

// DEVNET CONFIGURATION
const RPC_URL = "http://localhost:8899";
const CLUSTER_OFFSET = 1116522165;

// Utility function to read keypair from JSON file
function readKeypairFromJson(path: string): Keypair {
  const file = fs.readFileSync(path);
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(file.toString())));
}

async function initializeComputationDefinitions() {
  console.log("🚀 Initializing Dating App Computation Definitions...");
  
  try {
    // Setup connection and provider
    const connection = new Connection(RPC_URL, "confirmed");
    
    // Load owner keypair (the program deployer)
    const ownerPath = `${os.homedir()}/.config/solana/id.json`;
    console.log(`📂 Loading owner keypair from: ${ownerPath}`);
    
    if (!fs.existsSync(ownerPath)) {
      throw new Error(`Owner keypair not found at ${ownerPath}. Please ensure you have a Solana keypair configured.`);
    }
    
    const owner = readKeypairFromJson(ownerPath);
    console.log(`👤 Owner public key: ${owner.publicKey.toString()}`);
    
    // Check owner balance (must have SOL from existing sources)
    const balance = await connection.getBalance(owner.publicKey);
    console.log(`💰 Owner balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.5 * 1e9) {
      throw new Error(
        `Insufficient balance: ${balance / 1e9} SOL. Need at least 0.5 SOL.\n` +
        `Please fund your keypair or use: solana airdrop 2 ${owner.publicKey.toString()} --url devnet`
      );
    }
    
    // Setup provider and program
    const wallet = new anchor.Wallet(owner);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(provider);
    
    // Load IDL and create program
    const contractIdl = JSON.parse(fs.readFileSync("./lib/contract.json", "utf8"));
    const programId = new PublicKey(contractIdl.address || "2XTVdn5xYacRCkUq12JLkxAVL7ZNaZFKuTcxEg6tV3Q4");
    
    console.log(`📝 Using program ID: ${programId.toString()}`);
    
    // Create program instance
    const program = new anchor.Program(contractIdl, provider) as any;
    
    console.log(`📝 Program ID: ${programId.toString()}`);
    
    // Get cluster account
    const clusterAccount = new PublicKey("GgSqqAyH7AVY3Umcv8NvncrjFaNJuQLmxzxFxPoPW2Yd");
    console.log(`🔗 Cluster account: ${clusterAccount.toString()}`);
    
    // Get MXE account
    const mxeAccountPDA = getMXEAccAddress(program.programId);
    console.log(`🔐 MXE account: ${mxeAccountPDA.toString()}`);
    
    // Initialize computation definitions
    const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    
    const compDefs = [
      {
        name: "init_match_session",
        method: "initInitMatchSessionCompDef",
        offset: getCompDefAccOffset("init_match_session"),
      },
      {
        name: "submit_like", 
        method: "initSubmitLikeCompDef",
        offset: getCompDefAccOffset("submit_like"),
      },
      {
        name: "check_mutual_match",
        method: "initCheckMutualMatchCompDef", 
        offset: getCompDefAccOffset("check_mutual_match"),
      },
    ];
    
    for (const compDef of compDefs) {
      console.log(`\n🔧 Initializing ${compDef.name}...`);
      
      // Get computation definition PDA
      const compDefPDA = PublicKey.findProgramAddressSync(
        [baseSeedCompDefAcc, program.programId.toBuffer(), compDef.offset],
        getArciumProgAddress()
      )[0];
      
      console.log(`   PDA: ${compDefPDA.toString()}`);
      
      try {
        // Check if already initialized
        const accountInfo = await connection.getAccountInfo(compDefPDA);
        if (accountInfo) {
          console.log(`   ✅ ${compDef.name} already initialized, skipping...`);
          continue;
        }
        
        // Initialize computation definition
        console.log(`   📝 Calling ${compDef.method}...`);
        const initSig = await (program.methods as any)[compDef.method]()
          .accounts({
            compDefAccount: compDefPDA,
            payer: owner.publicKey,
            mxeAccount: mxeAccountPDA,
          })
          .signers([owner])
          .rpc();
        
        console.log(`   ✅ Init transaction: ${initSig}`);
        
        // Finalize computation definition
        console.log(`   🔄 Finalizing ${compDef.name}...`);
        const finalizeTx = await buildFinalizeCompDefTx(
          provider,
          Buffer.from(compDef.offset).readUInt32LE(),
          program.programId
        );
        
        const latestBlockhash = await connection.getLatestBlockhash();
        finalizeTx.recentBlockhash = latestBlockhash.blockhash;
        finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
        finalizeTx.sign(owner);
        
        const finalizeSig = await provider.sendAndConfirm(finalizeTx);
        console.log(`   ✅ Finalize transaction: ${finalizeSig}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to initialize ${compDef.name}:`, error);
        throw error;
      }
    }
    
    console.log("\n🎉 All computation definitions initialized successfully!");
    console.log("📱 Your dating app frontend can now connect and use MPC operations.");
    
  } catch (error) {
    console.error("❌ Failed to initialize computation definitions:", error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeComputationDefinitions()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { initializeComputationDefinitions };
