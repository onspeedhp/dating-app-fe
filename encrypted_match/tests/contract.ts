/**
 * Encrypted Dating App Smart Contract Tests
 * Tests profile creation, encrypted matching, and MPC computations
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Contract } from "../target/types/contract";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as bs58 from "bs58";
import { expect } from "chai";
import {
  awaitComputationFinalization,
  getArciumEnv,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  uploadCircuit,
  buildFinalizeCompDefTx,
  RescueCipher,
  deserializeLE,
  getMXEPublicKey,
  getMXEAccAddress,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  x25519,
} from "@arcium-hq/client";

interface PrivateProfileData {
  income: string;
}

interface MatchingPreferences {
  preferredAgeMin: number;
  preferredAgeMax: number;
  preferredDistanceKm: number;
  interests: string[];
  dealBreakers: string[];
  relationshipType: string;
  religionImportance: string;
  politicalViews: string;
  lifestylePreferences: {
    smoking: string;
    drinking: string;
    exercise: string;
    diet: string;
  };
  physicalPreferences: {
    heightPreference: string;
    bodyTypePreference: string;
  };
}

interface ProfileResult {
  user: anchor.web3.Keypair;
  profilePDA: PublicKey;
  profileData: any;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  realPrivateData: PrivateProfileData;
  realPreferences: MatchingPreferences;
}

interface MatchResult {
  sessionId: number;
  alice: string;
  target: string;
  isFinalized: boolean;
  matchFound: boolean;
  sessionPDA: PublicKey;
}

const ENCRYPTION_LIMITS = {
  PRIVATE_DATA_MAX_SIZE: 800,
  PREFERENCES_MAX_SIZE: 300,
  MARGIN_BYTES: 50,
} as const;

const MPC_TIMEOUTS = {
  INIT_SESSION: 15000,
  SUBMIT_LIKE: 15000,
  CHECK_MATCH: 20000,
  EVENT_WAIT: 5000,
} as const;

const SAMPLE_INCOMES = ["$50K", "$75K", "$100K", "$150K", "$200K+"] as const;

function generatePrivateProfileData(username: string, age: number): PrivateProfileData {
  return {
    income: SAMPLE_INCOMES[Math.floor(Math.random() * SAMPLE_INCOMES.length)]
  };
}

function generateMatchingPreferences(userAge: number): MatchingPreferences {
  return {
    preferredAgeMin: 20,
    preferredAgeMax: 35,
    preferredDistanceKm: 25,
    interests: ["Music", "Travel"],
    dealBreakers: ["Smoking"],
    relationshipType: "serious",
    religionImportance: "Not important",
    politicalViews: "Moderate",
    lifestylePreferences: {
      smoking: "Never",
      drinking: "Socially", 
      exercise: "Weekly",
      diet: "No restrictions"
    },
    physicalPreferences: {
      heightPreference: "No preference",
      bodyTypePreference: "No preference"
    }
  };
}

function encryptSensitiveData(data: any, userPrivateKey: Uint8Array, maxSize: number = ENCRYPTION_LIMITS.PRIVATE_DATA_MAX_SIZE): Uint8Array {
  const userPublicKey = x25519.getPublicKey(userPrivateKey);
  
  let jsonData = JSON.stringify(data);
  
  if (jsonData.length > maxSize - ENCRYPTION_LIMITS.MARGIN_BYTES) {
    const truncatedData = {
      income: data.income?.substring(0, 20) || '',
      preferredAgeMin: data.preferredAgeMin || 18,
      preferredAgeMax: data.preferredAgeMax || 65,
      relationshipType: data.relationshipType?.substring(0, 20) || '',
      interests: data.interests?.slice(0, 3) || [],
      dealBreakers: data.dealBreakers?.slice(0, 2) || []
    };
    
    jsonData = JSON.stringify(truncatedData);
  }
  
  const dataBytes = Buffer.from(jsonData, 'utf8');
  const finalSize = Math.min(dataBytes.length, maxSize);
  const encryptedData = new Uint8Array(finalSize);
  
  for (let i = 0; i < finalSize; i++) {
    const keyByte = userPrivateKey[i % userPrivateKey.length];
    const dataByte = i < dataBytes.length ? dataBytes[i] : 0;
    encryptedData[i] = dataByte ^ keyByte;
  }
  
  return encryptedData;
}

function readKeypairFromJson(path: string): anchor.web3.Keypair {
  const file = fs.readFileSync(path);
  return anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(file.toString()))
  );
}

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries: number = 10,
  retryDelayMs: number = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mxePublicKey = await getMXEPublicKey(provider, programId);
      if (mxePublicKey) {
        return mxePublicKey;
      }
    } catch (error) {
      // Silent retry
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Failed to fetch MXE public key after ${maxRetries} attempts`);
}

async function ensureSufficientBalance(
  connection: anchor.web3.Connection,
  keypair: anchor.web3.Keypair,
  minimumBalance: number = 2 * anchor.web3.LAMPORTS_PER_SOL,
  airdropAmount: number = 5 * anchor.web3.LAMPORTS_PER_SOL
): Promise<void> {
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance < minimumBalance) {
    const signature = await connection.requestAirdrop(keypair.publicKey, airdropAmount);
    await connection.confirmTransaction(signature);
  }
}

async function createUserProfile(
  program: Program<Contract>,
  user: anchor.web3.Keypair,
  profileData: any
): Promise<PublicKey> {
  const [userProfilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), user.publicKey.toBuffer()],
    program.programId
  );

  await program.methods
    .createProfile(profileData)
    .accountsPartial({
      userProfile: userProfilePDA,
      user: user.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([user])
    .rpc();

  return userProfilePDA;
}

async function initializeMPCComputationDefinitions(
  program: Program<Contract>,
  provider: anchor.AnchorProvider,
  owner: anchor.web3.Keypair
): Promise<{
  initMatchSessionCompDefPDA: PublicKey;
  submitLikeCompDefPDA: PublicKey;
  checkMutualMatchCompDefPDA: PublicKey;
}> {
  const mxeAccountPDA = getMXEAccAddress(program.programId);
  const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  
  const initMatchSessionOffset = getCompDefAccOffset("init_match_session");
  const initMatchSessionCompDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), initMatchSessionOffset],
    getArciumProgAddress()
  )[0];

  const submitLikeOffset = getCompDefAccOffset("submit_like");
  const submitLikeCompDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), submitLikeOffset],
    getArciumProgAddress()
  )[0];

  const checkMutualMatchOffset = getCompDefAccOffset("check_mutual_match");
  const checkMutualMatchCompDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), checkMutualMatchOffset],
    getArciumProgAddress()
  )[0];

  const compDefs = [
    { name: "init_match_session", method: "initInitMatchSessionCompDef", pda: initMatchSessionCompDefPDA, offset: initMatchSessionOffset },
    { name: "submit_like", method: "initSubmitLikeCompDef", pda: submitLikeCompDefPDA, offset: submitLikeOffset },
    { name: "check_mutual_match", method: "initCheckMutualMatchCompDef", pda: checkMutualMatchCompDefPDA, offset: checkMutualMatchOffset }
  ];

  for (const compDef of compDefs) {
    try {
      await (program.methods as any)[compDef.method]()
        .accounts({
          compDefAccount: compDef.pda,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
        })
        .signers([owner])
        .rpc();
      
      const finalizeTx = await buildFinalizeCompDefTx(
        provider,
        Buffer.from(compDef.offset).readUInt32LE(),
        program.programId
      );
      
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
    } catch (error) {
      // Comp def may already exist
    }
  }

  return {
    initMatchSessionCompDefPDA,
    submitLikeCompDefPDA,
    checkMutualMatchCompDefPDA
  };
}

describe("Contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Contract as Program<Contract>;
  const provider = anchor.getProvider();
  const connection = provider.connection;
  const arciumEnv = getArciumEnv();

  type Event = anchor.IdlEvents<(typeof program)["idl"]>;
  const awaitEvent = async <E extends keyof Event>(eventName: E): Promise<Event[E]> => {
    let listenerId: number;
    const event = await new Promise<Event[E]>((res) => {
      listenerId = program.addEventListener(eventName, (event) => {
        res(event);
      });
    });
    await program.removeEventListener(listenerId);
    return event;
  };

  it("Should create a user profile with encrypted sensitive data", async () => {
    const user = anchor.web3.Keypair.generate();
    await ensureSufficientBalance(connection, user);

    const userPrivateKey = x25519.utils.randomSecretKey();
    const userPublicKey = x25519.getPublicKey(userPrivateKey);

    const username = "AliceChef25";
    const age = 25;
    const realPrivateData = generatePrivateProfileData(username, age);
    const realPreferences = generateMatchingPreferences(age);

    const encryptedPrivateData = encryptSensitiveData(realPrivateData, userPrivateKey, ENCRYPTION_LIMITS.PRIVATE_DATA_MAX_SIZE);
    const encryptedPreferences = encryptSensitiveData(realPreferences, userPrivateKey, ENCRYPTION_LIMITS.PREFERENCES_MAX_SIZE);

    const profileData = {
      username: username,
      avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786",
      age: age,
      locationCity: "Ho Chi Minh City",
      encryptedPrivateData: Buffer.from(encryptedPrivateData),
      encryptedPreferences: Buffer.from(encryptedPreferences),
      encryptionPubkey: Array.from(userPublicKey),
      profileVersion: 1,
    };

    const [userProfilePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.publicKey.toBuffer()],
      program.programId
    );

    const profileEventPromise = awaitEvent("profileCreatedEvent");
    const tx = await program.methods
      .createProfile(profileData)
      .accountsPartial({
        user: user.publicKey,
        userProfile: userProfilePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    const profileEvent = await profileEventPromise;
    expect(profileEvent.user.toString()).to.equal(user.publicKey.toString());
    expect(profileEvent.profilePda.toString()).to.equal(userProfilePDA.toString());
    expect(profileEvent.username).to.equal("AliceChef25");
    expect(profileEvent.age).to.equal(25);
    expect(profileEvent.locationCity).to.equal("Ho Chi Minh City");

    const profileAccount = await program.account.userProfile.fetch(userProfilePDA);
    expect(profileAccount.owner.toString()).to.equal(user.publicKey.toString());
    expect(profileAccount.username).to.equal("AliceChef25");
    expect(profileAccount.age).to.equal(25);
    expect(profileAccount.locationCity).to.equal("Ho Chi Minh City");
    expect(profileAccount.isActive).to.equal(true);
    expect(profileAccount.totalLikesGiven).to.equal(0);
    expect(profileAccount.totalLikesReceived).to.equal(0);
    expect(profileAccount.totalMatches).to.equal(0);
    expect(profileAccount.encryptedLikesGiven).to.have.length(0);
    expect(profileAccount.encryptedLikesReceived).to.have.length(0);
    expect(profileAccount.encryptedMatches).to.have.length(0);
  });

  it("Should fail with invalid username", async () => {
    const user = anchor.web3.Keypair.generate();
    await ensureSufficientBalance(connection, user);

    const userPrivateKey = x25519.utils.randomSecretKey();
    const userPublicKey = x25519.getPublicKey(userPrivateKey);

    const invalidProfileData = {
      username: "ab",
      avatarUrl: "https://example.com/avatar.jpg",
      age: 25,
      locationCity: "Ho Chi Minh City",
      encryptedPrivateData: randomBytes(100),
      encryptedPreferences: randomBytes(50),
      encryptionPubkey: Array.from(userPublicKey),
      profileVersion: 1,
    };

    const [userProfilePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .createProfile(invalidProfileData)
        .accountsPartial({
          user: user.publicKey,
          userProfile: userProfilePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      
      expect.fail("Should have thrown error for invalid username");
    } catch (error) {
      expect(error.message).to.include("Username quá ngắn");
    }
  });

  it("Should fail with invalid age", async () => {
    const user = anchor.web3.Keypair.generate();
    await ensureSufficientBalance(connection, user);

    const userPrivateKey = x25519.utils.randomSecretKey();
    const userPublicKey = x25519.getPublicKey(userPrivateKey);

    const invalidProfileData = {
      username: "testuser123",
      avatarUrl: "https://example.com/avatar.jpg",
      age: 16,
      locationCity: "Ho Chi Minh City",
      encryptedPrivateData: randomBytes(100),
      encryptedPreferences: randomBytes(50),
      encryptionPubkey: Array.from(userPublicKey),
      profileVersion: 1,
    };

    const [userProfilePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .createProfile(invalidProfileData)
        .accountsPartial({
          user: user.publicKey,
          userProfile: userProfilePDA,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      
      expect.fail("Should have thrown error for invalid age");
    } catch (error) {
      expect(error.message).to.include("Tuổi phải từ 18-99");
    }
  });

  it("Should initialize MPC environment", async () => {
    const owner = readKeypairFromJson(`${os.homedir()}/.config/solana/id.json`);
    const mxePublicKey = await getMXEPublicKeyWithRetry(
      provider as anchor.AnchorProvider,
      program.programId
    );

    expect(mxePublicKey).to.not.be.null;
    expect(owner.publicKey).to.not.be.null;
  });

  it("Should demonstrate encrypted matching flow", async () => {
    const alice = anchor.web3.Keypair.generate();
    const bob = anchor.web3.Keypair.generate();
    
    const aliceAirdrop = await connection.requestAirdrop(alice.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(aliceAirdrop);

    const bobAirdrop = await connection.requestAirdrop(bob.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(bobAirdrop);
    
    const aliceProfilePrivateKey = x25519.utils.randomSecretKey();
    const aliceProfilePublicKey = x25519.getPublicKey(aliceProfilePrivateKey);
    const bobProfilePrivateKey = x25519.utils.randomSecretKey();
    const bobProfilePublicKey = x25519.getPublicKey(bobProfilePrivateKey);
    
    const aliceRealPrivateData = generatePrivateProfileData("Alice", 25);
    const aliceRealPreferences = generateMatchingPreferences(25);
    const aliceEncryptedPrivateData = encryptSensitiveData(aliceRealPrivateData, aliceProfilePrivateKey, 800);
    const aliceEncryptedPreferences = encryptSensitiveData(aliceRealPreferences, aliceProfilePrivateKey, 300);
    
    const bobRealPrivateData = generatePrivateProfileData("Bob", 28);
    const bobRealPreferences = generateMatchingPreferences(28);
    const bobEncryptedPrivateData = encryptSensitiveData(bobRealPrivateData, bobProfilePrivateKey, 800);
    const bobEncryptedPreferences = encryptSensitiveData(bobRealPreferences, bobProfilePrivateKey, 300);
    
    // Profiles data encrypted and ready
    const [aliceProfilePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), alice.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .createProfile({
        username: "Alice",
        avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786",
        age: 25,
        locationCity: "San Francisco",
        encryptedPrivateData: Buffer.from(aliceEncryptedPrivateData),
        encryptedPreferences: Buffer.from(aliceEncryptedPreferences),
        encryptionPubkey: Array.from(aliceProfilePublicKey),
        profileVersion: 1,
      })
      .accountsPartial({
        userProfile: aliceProfilePDA,
        user: alice.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([alice])
      .rpc();
    
    const [bobProfilePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), bob.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods
      .createProfile({
        username: "Bob",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
        age: 28,
        locationCity: "New York",
        encryptedPrivateData: Buffer.from(bobEncryptedPrivateData),
        encryptedPreferences: Buffer.from(bobEncryptedPreferences),
        encryptionPubkey: Array.from(bobProfilePublicKey),
        profileVersion: 1,
      })
      .accountsPartial({
        userProfile: bobProfilePDA,
        user: bob.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([bob])
      .rpc();
      
    const owner = readKeypairFromJson(`${os.homedir()}/.config/solana/id.json`);
    
    const ownerBalance = await connection.getBalance(owner.publicKey);
    if (ownerBalance < 5 * anchor.web3.LAMPORTS_PER_SOL) {
      const ownerAirdrop = await connection.requestAirdrop(owner.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
      await connection.confirmTransaction(ownerAirdrop);
    }
    
    const mxeAccountPDA = getMXEAccAddress(program.programId);
    const mempoolPDA = getMempoolAccAddress(program.programId);
    const executingPoolPDA = getExecutingPoolAccAddress(program.programId);

    // Initialize MPC computation definitions
    
    const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    
    const initMatchSessionOffset = getCompDefAccOffset("init_match_session");
    const initMatchSessionCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), initMatchSessionOffset],
      getArciumProgAddress()
    )[0];

    const submitLikeOffset = getCompDefAccOffset("submit_like");
    const submitLikeCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), submitLikeOffset],
      getArciumProgAddress()
    )[0];

    const checkMutualMatchOffset = getCompDefAccOffset("check_mutual_match");
    const checkMutualMatchCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), checkMutualMatchOffset],
      getArciumProgAddress()
    )[0];
    
    try {
      await program.methods.initInitMatchSessionCompDef()
      .accounts({
          compDefAccount: initMatchSessionCompDefPDA,
        payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
      })
      .signers([owner])
        .rpc();
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(initMatchSessionOffset).readUInt32LE(),
        program.programId
      );
      
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
    } catch (error) {
      // Comp def already exists
    }
    
    try {
      await program.methods.initSubmitLikeCompDef()
        .accounts({
          compDefAccount: submitLikeCompDefPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
        })
        .signers([owner])
        .rpc();
      //console.log("submit_like comp def initialized");
      
      // Finalize the computation definition
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(submitLikeOffset).readUInt32LE(),
        program.programId
      );

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
      //console.log("    submit_like comp def finalized");
    } catch (error) {
      //console.log("    submit_like comp def error:", error.message);
    }
    
    try {
      await program.methods.initCheckMutualMatchCompDef()
        .accounts({
          compDefAccount: checkMutualMatchCompDefPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
        })
        .signers([owner])
        .rpc();
      //console.log("    check_mutual_match comp def initialized");
      
      // Finalize the computation definition
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(checkMutualMatchOffset).readUInt32LE(),
        program.programId
      );

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
      //console.log("    check_mutual_match comp def finalized");
    } catch (error) {
      //console.log("    check_mutual_match comp def error:", error.message);
    }
    
    // === STEP 2: Create Match Session ===
    //console.log("\n Creating encrypted match session...");
    
    const sessionId = Date.now(); // Unique session ID
    const [matchSessionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("match_session"),
        Buffer.from(new anchor.BN(sessionId).toArray("le", 8)) // session_id.to_le_bytes()
      ],
      program.programId
    );
    
    // Listen for session creation event
    const sessionEventPromise = awaitEvent("matchSessionCreatedEvent");
    
    const nonce = Date.now(); // Random nonce for MPC
    
    // Generate computation offsets for each MPC call
    const initMatchComputationOffset = new anchor.BN(randomBytes(8), "hex");
    const computationAccountPDA = getComputationAccAddress(
      program.programId,
      initMatchComputationOffset
    );

    await program.methods
      .initMatchSession(
        initMatchComputationOffset, // computation_offset
        new anchor.BN(sessionId), // session_id
        alice.publicKey, // user_a
        bob.publicKey, // user_b
        new anchor.BN(nonce) // nonce
      )
      .accountsPartial({
        matchPairSession: matchSessionPDA,
        payer: owner.publicKey,
        mxeAccount: mxeAccountPDA,
        mempoolAccount: mempoolPDA,
        executingPool: executingPoolPDA,
        computationAccount: computationAccountPDA,
        compDefAccount: initMatchSessionCompDefPDA,
        clusterAccount: arciumEnv.arciumClusterPubkey,
      })
      .signers([owner])
      .rpc();
      
    // Wait for session creation event
    const sessionEvent = await sessionEventPromise;
    //console.log(" Match session created!");
    //console.log(`   Session ID: ${sessionId}`);
    //console.log(`   User A: ${alice.publicKey.toString().slice(0, 8)}...`);
    //console.log(`   User B: ${bob.publicKey.toString().slice(0, 8)}...`);
    //console.log(`   Event data:`, sessionEvent);
    
    // Wait for InitMatchSession MPC computation to finalize
    //console.log("    Waiting for InitMatchSession MPC computation to finalize...");
    
    const initSessionFinalizationPromise = awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      initMatchComputationOffset,
      program.programId,
      "confirmed"
    );
    
    // Race between finalization and timeout
    const initSessionResult = await Promise.race([
      initSessionFinalizationPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("InitMatchSession finalization timeout")), 15000)
      )
    ]);
    
    //console.log("    InitMatchSession computation finalized:", initSessionResult);
    
    // === STEP 3: Alice Likes Bob ===
    //console.log("\n Alice likes Bob (encrypted)...");
    
    // Listen for like submission event
    const aliceLikeEventPromise = awaitEvent("likeSubmittedEvent");
    
    // Properly encrypt data for Alice's like action using MXE public key
    const aliceMpcPrivateKey = x25519.utils.randomSecretKey();
    const aliceMpcPublicKey = x25519.getPublicKey(aliceMpcPrivateKey);
    const mxePublicKey = await getMXEPublicKeyWithRetry(
      provider as anchor.AnchorProvider,
      program.programId
    );
    const aliceSharedSecret = x25519.getSharedSecret(aliceMpcPrivateKey, mxePublicKey);
    const aliceCipher = new RescueCipher(aliceSharedSecret);
    
    // Convert user IDs to u64 (use 8 bytes to match InitMatchSession logic)
    const aliceUserId = new anchor.BN(alice.publicKey.toBuffer().slice(0, 8), "le");
    const bobTargetId = new anchor.BN(bob.publicKey.toBuffer().slice(0, 8), "le"); 
    const likeAction = true; // boolean: true = like
    const currentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    
    //console.log("    Alice User ID:", aliceUserId);
    //console.log("    Bob Target ID:", bobTargetId);
    
    // Encrypt all fields together for UserLikeAction struct (like reference implementation)
    const aliceNonce = randomBytes(16);
    const aliceCiphertext = aliceCipher.encrypt(
      [BigInt(aliceUserId.toString()), BigInt(bobTargetId.toString()), likeAction ? BigInt(1) : BigInt(0), BigInt(currentTimestamp)],
      aliceNonce
    );
    
    // Generate computation offset for Alice's like
    const aliceLikeComputationOffset = new anchor.BN(randomBytes(8), "hex");
    const aliceComputationAccountPDA = getComputationAccAddress(
      program.programId,
      aliceLikeComputationOffset
    );
    
    //console.log("    Submitting Alice's like transaction...");
    
    try {
      const aliceTx = await program.methods
        .submitLike(
          aliceLikeComputationOffset, // computation_offset
          Array.from(aliceCiphertext[0]), // encrypted_user_id
          Array.from(aliceCiphertext[1]), // encrypted_target_id
          Array.from(aliceCiphertext[2]), // encrypted_like_action  
          Array.from(aliceCiphertext[3]), // encrypted_timestamp
          Array.from(aliceMpcPublicKey), // Alice's public key
          new anchor.BN(deserializeLE(aliceNonce).toString()) // nonce
        )
        .accountsPartial({
          matchPairSession: matchSessionPDA,
          user: alice.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: aliceComputationAccountPDA,
          compDefAccount: submitLikeCompDefPDA,
          clusterAccount: arciumEnv.arciumClusterPubkey,
        })
        .signers([alice])
        .rpc();
      
      //console.log("    Alice's transaction submitted:", aliceTx);
      
      // Check transaction for events
      const txDetails = await connection.getTransaction(aliceTx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0
      });
      //console.log("    Transaction logs:");
      if (txDetails?.meta?.logMessages) {
        txDetails.meta.logMessages.forEach((log, i) => {
          //console.log(`     ${i}: ${log}`);
        });
        
        // Check for specific MPC-related logs
        const mpcLogs = txDetails.meta.logMessages.filter(log => 
          log.includes("CallbackComputation") || 
          log.includes("SubmitLike") ||
          log.includes("Program data") ||
          log.includes("computation")
        );
        
        if (mpcLogs.length > 0) {
          //console.log("    MPC-related logs:");
          // mpcLogs.forEach((log, i) => console.log(`     MPC ${i}: ${log}`));
        } else {
          //console.log("    No MPC logs found - computation may not have been queued");
        }
      }
    } catch (error) {
      //console.error("    Alice's submitLike failed:", error.message);
      throw error;
    }
      
    //console.log(" Alice's like transaction confirmed - continuing with flow");
    
    // Wait for Alice's computation to finalize (with timeout)
    //console.log("    Waiting for Alice's MPC computation to finalize...");
    //console.log("    Alice computation offset:", aliceLikeComputationOffset.toString());
    //console.log("    Alice computation account:", aliceComputationAccountPDA.toString());
    
    // Check if computation account exists and has data
    try {
      const computationAccountInfo = await connection.getAccountInfo(aliceComputationAccountPDA);
      if (computationAccountInfo) {
        //console.log("    Computation account exists, data length:", computationAccountInfo.data.length);
        //console.log("    Account lamports:", computationAccountInfo.lamports);
      } else {
        //console.log("    Computation account does not exist!");
      }
    } catch (error) {
      //console.log("    Could not fetch computation account:", error.message);
    }
    
    const aliceFinalizationPromise = awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      aliceLikeComputationOffset,
      program.programId,
      "confirmed"
    );
    
    // Race between finalization and timeout
    const aliceResult = await Promise.race([
      aliceFinalizationPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Alice finalization timeout")), 15000)
      )
    ]);
    
    //console.log("    Alice's computation finalized:", aliceResult);
    
    // Check session state immediately after Alice's finalization
    try {
      const sessionAfterAlice = await program.account.matchPairSession.fetch(matchSessionPDA);
      // Session state check after Alice
    } catch (error) {
      // Could not fetch session state
    }
    
    // === STEP 4: Bob Likes Alice ===
    //console.log("\n Bob likes Alice (encrypted)...");
    
    // Listen for mutual interest detection event
    const mutualInterestEventPromise = awaitEvent("mutualInterestDetectedEvent");
    
    // Properly encrypt data for Bob's like action
    const bobMpcPrivateKey = x25519.utils.randomSecretKey();
    const bobMpcPublicKey = x25519.getPublicKey(bobMpcPrivateKey);
    const bobSharedSecret = x25519.getSharedSecret(bobMpcPrivateKey, mxePublicKey);
    const bobCipher = new RescueCipher(bobSharedSecret);
    
    // Convert user IDs to u64 (use 8 bytes to match InitMatchSession logic) 
    const bobUserId = new anchor.BN(bob.publicKey.toBuffer().slice(0, 8), "le");
    const aliceTargetId = new anchor.BN(alice.publicKey.toBuffer().slice(0, 8), "le");
    const bobLikeAction = true; // boolean: true = like
    const bobCurrentTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    
    //console.log("    Bob User ID:", bobUserId);
    //console.log("    Alice Target ID:", aliceTargetId);
    
    // Encrypt all fields together for Bob's UserLikeAction struct (like reference implementation)
    const bobNonce = randomBytes(16);
    const bobCiphertext = bobCipher.encrypt(
      [BigInt(bobUserId.toString()), BigInt(aliceTargetId.toString()), bobLikeAction ? BigInt(1) : BigInt(0), BigInt(bobCurrentTimestamp)],
      bobNonce
    );
    
    // Generate computation offset for Bob's like
    const bobLikeComputationOffset = new anchor.BN(randomBytes(8), "hex");
    const bobComputationAccountPDA = getComputationAccAddress(
      program.programId,
      bobLikeComputationOffset
    );
    
    await program.methods
      .submitLike(
        bobLikeComputationOffset, // computation_offset
        Array.from(bobCiphertext[0]), // encrypted_user_id
        Array.from(bobCiphertext[1]), // encrypted_target_id
        Array.from(bobCiphertext[2]), // encrypted_like_action  
        Array.from(bobCiphertext[3]), // encrypted_timestamp
        Array.from(bobMpcPublicKey), // Bob's public key
        new anchor.BN(deserializeLE(bobNonce).toString()) // nonce
      )
      .accountsPartial({
        matchPairSession: matchSessionPDA,
        user: bob.publicKey,
        mxeAccount: mxeAccountPDA,
        mempoolAccount: mempoolPDA,
        executingPool: executingPoolPDA,
        computationAccount: bobComputationAccountPDA,
        compDefAccount: submitLikeCompDefPDA,
        clusterAccount: arciumEnv.arciumClusterPubkey,
      })
      .signers([bob])
      .rpc();
      
    //console.log(" Bob's like submitted (encrypted)!");
    
    // Wait for Bob's computation to finalize (with timeout)
    //console.log("    Waiting for Bob's MPC computation to finalize...");
    
    const bobFinalizationPromise = awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      bobLikeComputationOffset,
      program.programId,
      "confirmed"
    );
    
    // Race between finalization and timeout
    const bobResult = await Promise.race([
      bobFinalizationPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Bob finalization timeout")), 15000)
      )
    ]);
    
    //console.log("    Bob's computation finalized:", bobResult);
    
    // Check for mutual interest event (non-blocking)
    setTimeout(async () => {
      try {
        const mutualInterestEvent = await mutualInterestEventPromise;
        //console.log("    Mutual interest detected event:", mutualInterestEvent);
      } catch (error) {
        //console.log("    No mutual interest event received yet");
      }
    }, 100);
    
    // === STEP 5: Check for Mutual Match ===
    //console.log("\n Checking for mutual match...");
    
    // Listen for final match result event
    const matchResultEventPromise = Promise.race([
      awaitEvent("mutualMatchFoundEvent"),
      awaitEvent("noMutualMatchEvent")
    ]);
    
    // Generate computation offset for mutual match check
    const checkMatchComputationOffset = new anchor.BN(randomBytes(8), "hex");
    const checkMatchComputationAccountPDA = getComputationAccAddress(
      program.programId,
      checkMatchComputationOffset
    );
    
    await program.methods
      .checkMutualMatch(checkMatchComputationOffset) // computation_offset
      .accountsPartial({
        matchPairSession: matchSessionPDA,
        payer: owner.publicKey,
        mxeAccount: mxeAccountPDA,
        mempoolAccount: mempoolPDA,
        executingPool: executingPoolPDA,
        computationAccount: checkMatchComputationAccountPDA,
        compDefAccount: checkMutualMatchCompDefPDA,
        clusterAccount: arciumEnv.arciumClusterPubkey,
      })
      .signers([ owner ])
      .rpc();
      
    //console.log(" Mutual match check transaction completed!");
    
    // Wait for mutual match computation to finalize (with timeout)
    //console.log("    Waiting for mutual match MPC computation to finalize...");
    
    const checkMatchFinalizationPromise = awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      checkMatchComputationOffset,
      program.programId,
      "confirmed"
    );
    
    // Race between finalization and timeout
    const checkMatchResult = await Promise.race([
      checkMatchFinalizationPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Check match finalization timeout")), 20000)
      )
    ]);
    
    //console.log("    Mutual match computation finalized:", checkMatchResult);
    
    // Wait for final match result event (with shorter timeout)
    try {
      const matchResultEvent = await Promise.race([
        matchResultEventPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Event timeout")), 5000)
        )
      ]);
      //console.log("    Final match result event:", matchResultEvent);
    } catch (error) {
      //console.log("    No match result event received within timeout");
    }
    
    // === STEP 6: Verify Final State ===
    //console.log("\n Verifying final state...");
    
    const finalSession = await program.account.matchPairSession.fetch(matchSessionPDA);
    
    //console.log(" Final Session State:");
    //console.log("  - Session ID:", finalSession.sessionId.toString());
    //console.log("  - Is Finalized:", finalSession.isFinalized);
    //console.log("  - Match Found:", finalSession.matchFound);
    //console.log("  - Last Updated:", finalSession.lastUpdated.toString(), "(raw timestamp)");
    //console.log("  - User A:", finalSession.userA.toString().slice(0, 8) + "...");
    //console.log("  - User B:", finalSession.userB.toString().slice(0, 8) + "...");
    
    // Performance metrics
    const endTime = Date.now();
    const totalTime = endTime - sessionId; // sessionId was set to Date.now()
    //console.log("  Total execution time:", (totalTime / 1000).toFixed(2), "seconds");
    
    // Assertions for test success
    if (finalSession.isFinalized && finalSession.matchFound) {
      //console.log(" MUTUAL MATCH DETECTED - TEST PASSED!");
    } else if (finalSession.isFinalized && !finalSession.matchFound) {
      //console.log(" NO MATCH - TEST PASSED (both users didn't match)");
    } else {
      //console.log("  Session not finalized yet - may need more time");
    }
    
    // Test completed successfully
    expect(finalSession.isFinalized).to.be.true;
    console.log("Encrypted matching flow test completed");
  });

  // Test case: Multiple profiles và matching scenario
  it("Should demonstrate multi-profile encrypted matching", async () => {
    console.log("Multi-profile matching test started");
    
    const profiles = [];
    const profileNames = [
      "Alice", "Bob", "Charlie", "Diana", "Eve", 
      "Frank", "Grace", "Henry", "Iris", "Jack"
    ];
    
    const cities = [
      "San Francisco", "New York", "Los Angeles", "Chicago", "Miami",
      "Seattle", "Austin", "Boston", "Denver", "Portland"
    ];
    
    const ages = [22, 25, 28, 24, 26, 30, 23, 27, 29, 31];
    
    for (let i = 0; i < 10; i++) {
      const user = anchor.web3.Keypair.generate();
      
      // Airdrop SOL
      const airdrop = await connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdrop);
      
      // Generate encryption keypair
      const userPrivateKey = x25519.utils.randomSecretKey();
      const userPublicKey = x25519.getPublicKey(userPrivateKey);
      
      // Generate realistic sensitive data for each profile
      const realPrivateData = generatePrivateProfileData(profileNames[i], ages[i]);
      const realPreferences = generateMatchingPreferences(ages[i]);
      const encryptedPrivateData = encryptSensitiveData(realPrivateData, userPrivateKey, 800);
      const encryptedPreferences = encryptSensitiveData(realPreferences, userPrivateKey, 300);
      
      // Display some sensitive info (just for demo - normally this would be completely hidden)
      if (i < 3) { // Only show for first 3 profiles
        //console.log(`\n ${profileNames[i]}'s Sensitive Data (Encrypted):`);
        //console.log(`    Income: ${realPrivateData.income} (PRIVATE!)`);
        //console.log(`    Seeking: ${realPreferences.relationshipType} relationship`);
        //console.log(`    Encrypted size: ${encryptedPrivateData.length} bytes`);
      }
      
      const profileData = {
        username: profileNames[i],
        avatarUrl: `https://api.dicebear.com/7.x/avatars/svg?seed=${profileNames[i]}`,
        age: ages[i],
        locationCity: cities[i],
        encryptedPrivateData: Buffer.from(encryptedPrivateData),
        encryptedPreferences: Buffer.from(encryptedPreferences),
        encryptionPubkey: Array.from(userPublicKey),
        profileVersion: 1,
      };
      
      const [userProfilePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_profile"), user.publicKey.toBuffer()],
        program.programId
      );
      
      await program.methods
        .createProfile(profileData)
        .accountsPartial({
          userProfile: userProfilePDA,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      
      profiles.push({
        user,
        profilePDA: userProfilePDA,
        profileData,
        privateKey: userPrivateKey,
        publicKey: userPublicKey,
        realPrivateData,
        realPreferences
      });
      
      //console.log(`    Created profile ${i + 1}/10: ${profileNames[i]} (${ages[i]}, ${cities[i]})`);
    }
    
    expect(profiles.length).to.equal(10);
    
    const alice = profiles[0];
    const aliceTargets = [profiles[1], profiles[2], profiles[3]];
    
    // Create owner for MPC operations
    const owner = readKeypairFromJson(`${os.homedir()}/.config/solana/id.json`);
    const ownerBalance = await connection.getBalance(owner.publicKey);
    if (ownerBalance < 10 * anchor.web3.LAMPORTS_PER_SOL) {
      const ownerAirdrop = await connection.requestAirdrop(owner.publicKey, 20 * anchor.web3.LAMPORTS_PER_SOL);
      await connection.confirmTransaction(ownerAirdrop);
    }
    
    // Get MXE and other accounts
    const mxeAccountPDA = getMXEAccAddress(program.programId);
    const mempoolPDA = getMempoolAccAddress(program.programId);
    const executingPoolPDA = getExecutingPoolAccAddress(program.programId);
    
    // Get computation definition PDAs
    const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const initMatchSessionOffset = getCompDefAccOffset("init_match_session");
    const initMatchSessionCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), initMatchSessionOffset],
      getArciumProgAddress()
    )[0];
    
    const submitLikeOffset = getCompDefAccOffset("submit_like");
    const submitLikeCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), submitLikeOffset],
      getArciumProgAddress()
    )[0];
    
    const checkMutualMatchOffset = getCompDefAccOffset("check_mutual_match");
    const checkMutualMatchCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), checkMutualMatchOffset],
      getArciumProgAddress()
    )[0];
    
    // === STEP 3.5: Initialize MPC Computation Definitions ===
    //console.log("\n Initializing MPC computation definitions for multi-profile matching...");
    
    try {
      await program.methods.initInitMatchSessionCompDef()
        .accounts({
          compDefAccount: initMatchSessionCompDefPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
        })
        .signers([owner])
        .rpc();
      //console.log("    init_match_session comp def initialized");
      
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(initMatchSessionOffset).readUInt32LE(),
        program.programId
      );
      
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
      //console.log("    init_match_session comp def finalized");
    } catch (error) {
      //console.log("    init_match_session comp def may already exist:", error.message);
    }
    
    try {
      await program.methods.initSubmitLikeCompDef()
        .accounts({
          compDefAccount: submitLikeCompDefPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
        })
        .signers([owner])
        .rpc();
      //console.log("submit_like comp def initialized");
      
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(submitLikeOffset).readUInt32LE(),
        program.programId
      );

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
      //console.log("    submit_like comp def finalized");
    } catch (error) {
      //console.log("    submit_like comp def may already exist:", error.message);
    }
    
    try {
      await program.methods.initCheckMutualMatchCompDef()
        .accounts({
          compDefAccount: checkMutualMatchCompDefPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
        })
        .signers([owner])
        .rpc();
      //console.log("    check_mutual_match comp def initialized");
      
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(checkMutualMatchOffset).readUInt32LE(),
        program.programId
      );

      const latestBlockhash = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latestBlockhash.blockhash;
      finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
      //console.log("    check_mutual_match comp def finalized");
    } catch (error) {
      //console.log("    check_mutual_match comp def may already exist:", error.message);
    }
    
    const matches = [];
    
    // === STEP 4: Process Each Like/Match Pair ===
    for (let i = 0; i < aliceTargets.length; i++) {
      const target = aliceTargets[i];
      //console.log(`\n Match ${i + 1}/3: Alice + ${target.profileData.username}`);
      
      // Create match session
      const sessionId = Date.now() + i; // Unique session ID
      const [matchSessionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("match_session"),
          Buffer.from(new anchor.BN(sessionId).toArray("le", 8))
        ],
        program.programId
      );
      
      const nonce = Date.now() + i * 1000;
      const initMatchComputationOffset = new anchor.BN(randomBytes(8), "hex");
      const computationAccountPDA = getComputationAccAddress(
        program.programId,
        initMatchComputationOffset
      );
      
      //console.log(`    Initializing match session...`);
      await program.methods
        .initMatchSession(
          initMatchComputationOffset,
          new anchor.BN(sessionId),
          alice.user.publicKey,
          target.user.publicKey,
          new anchor.BN(nonce)
        )
        .accountsPartial({
          matchPairSession: matchSessionPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: computationAccountPDA,
          compDefAccount: initMatchSessionCompDefPDA,
          clusterAccount: arciumEnv.arciumClusterPubkey,
        })
        .signers([owner])
        .rpc();
      
      // Wait for init session finalization
      const initSessionResult = await Promise.race([
        awaitComputationFinalization(
          provider as anchor.AnchorProvider,
          initMatchComputationOffset,
          program.programId,
          "confirmed"
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Init timeout")), 15000)
        )
      ]);
      
      //console.log(`    Session initialized: ${initSessionResult}`);
      
      // Alice likes target
      //console.log(`    Alice likes ${target.profileData.username}...`);
      
      const aliceMpcPrivateKey = x25519.utils.randomSecretKey();
      const aliceMpcPublicKey = x25519.getPublicKey(aliceMpcPrivateKey);
      const mxePublicKey = await getMXEPublicKeyWithRetry(
        provider as anchor.AnchorProvider,
        program.programId
      );
      const aliceSharedSecret = x25519.getSharedSecret(aliceMpcPrivateKey, mxePublicKey);
      const aliceCipher = new RescueCipher(aliceSharedSecret);
      
      const aliceUserId = new anchor.BN(alice.user.publicKey.toBuffer().slice(0, 8), "le");
      const targetId = new anchor.BN(target.user.publicKey.toBuffer().slice(0, 8), "le");
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      const aliceNonce = randomBytes(16);
      const aliceCiphertext = aliceCipher.encrypt(
        [BigInt(aliceUserId.toString()), BigInt(targetId.toString()), BigInt(1), BigInt(currentTimestamp)],
        aliceNonce
      );
      
      const aliceLikeComputationOffset = new anchor.BN(randomBytes(8), "hex");
      const aliceComputationAccountPDA = getComputationAccAddress(
        program.programId,
        aliceLikeComputationOffset
      );
      
      await program.methods
        .submitLike(
          aliceLikeComputationOffset,
          Array.from(aliceCiphertext[0]),
          Array.from(aliceCiphertext[1]),
          Array.from(aliceCiphertext[2]),
          Array.from(aliceCiphertext[3]),
          Array.from(aliceMpcPublicKey),
          new anchor.BN(deserializeLE(aliceNonce).toString())
        )
        .accountsPartial({
          matchPairSession: matchSessionPDA,
          user: alice.user.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: aliceComputationAccountPDA,
          compDefAccount: submitLikeCompDefPDA,
          clusterAccount: arciumEnv.arciumClusterPubkey,
        })
        .signers([alice.user])
        .rpc();
      
      // Wait for Alice's like finalization
      const aliceResult = await Promise.race([
        awaitComputationFinalization(
          provider as anchor.AnchorProvider,
          aliceLikeComputationOffset,
          program.programId,
          "confirmed"
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Alice like timeout")), 15000)
        )
      ]);
      
      //console.log(`    Alice's like processed: ${aliceResult}`);
      
      // Target likes Alice back
      //console.log(`    ${target.profileData.username} likes Alice back...`);
      
      const targetMpcPrivateKey = x25519.utils.randomSecretKey();
      const targetMpcPublicKey = x25519.getPublicKey(targetMpcPrivateKey);
      const targetSharedSecret = x25519.getSharedSecret(targetMpcPrivateKey, mxePublicKey);
      const targetCipher = new RescueCipher(targetSharedSecret);
      
      const targetUserId = new anchor.BN(target.user.publicKey.toBuffer().slice(0, 8), "le");
      const aliceTargetId = new anchor.BN(alice.user.publicKey.toBuffer().slice(0, 8), "le");
      const targetTimestamp = Math.floor(Date.now() / 1000);
      
      const targetNonce = randomBytes(16);
      const targetCiphertext = targetCipher.encrypt(
        [BigInt(targetUserId.toString()), BigInt(aliceTargetId.toString()), BigInt(1), BigInt(targetTimestamp)],
        targetNonce
      );
      
      const targetLikeComputationOffset = new anchor.BN(randomBytes(8), "hex");
      const targetComputationAccountPDA = getComputationAccAddress(
        program.programId,
        targetLikeComputationOffset
      );
      
      await program.methods
        .submitLike(
          targetLikeComputationOffset,
          Array.from(targetCiphertext[0]),
          Array.from(targetCiphertext[1]),
          Array.from(targetCiphertext[2]),
          Array.from(targetCiphertext[3]),
          Array.from(targetMpcPublicKey),
          new anchor.BN(deserializeLE(targetNonce).toString())
        )
        .accountsPartial({
          matchPairSession: matchSessionPDA,
          user: target.user.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: targetComputationAccountPDA,
          compDefAccount: submitLikeCompDefPDA,
          clusterAccount: arciumEnv.arciumClusterPubkey,
        })
        .signers([target.user])
        .rpc();
      
      // Wait for target's like finalization
      const targetResult = await Promise.race([
        awaitComputationFinalization(
          provider as anchor.AnchorProvider,
          targetLikeComputationOffset,
          program.programId,
          "confirmed"
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Target like timeout")), 15000)
        )
      ]);
      
      //console.log(`    ${target.profileData.username}'s like processed: ${targetResult}`);
      
      // Check for mutual match
      //console.log(`    Checking for mutual match...`);
      
      const checkMatchComputationOffset = new anchor.BN(randomBytes(8), "hex");
      const checkMatchComputationAccountPDA = getComputationAccAddress(
        program.programId,
        checkMatchComputationOffset
      );
      
      await program.methods
        .checkMutualMatch(checkMatchComputationOffset)
        .accountsPartial({
          matchPairSession: matchSessionPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: checkMatchComputationAccountPDA,
          compDefAccount: checkMutualMatchCompDefPDA,
          clusterAccount: arciumEnv.arciumClusterPubkey,
        })
        .signers([owner])
        .rpc();
      
      // Wait for match check finalization
      const checkMatchResult = await Promise.race([
        awaitComputationFinalization(
          provider as anchor.AnchorProvider,
          checkMatchComputationOffset,
          program.programId,
          "confirmed"
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Match check timeout")), 20000)
        )
      ]);
      
      //console.log(`    Match check completed: ${checkMatchResult}`);
      
      // Verify final match state
      const finalSession = await program.account.matchPairSession.fetch(matchSessionPDA);
      
      matches.push({
        sessionId,
        alice: alice.profileData.username,
        target: target.profileData.username,
        isFinalized: finalSession.isFinalized,
        matchFound: finalSession.matchFound,
        sessionPDA: matchSessionPDA
      });
      
      if (finalSession.isFinalized && finalSession.matchFound) {
        //console.log(`    MUTUAL MATCH CONFIRMED: Alice + ${target.profileData.username} +`);
      } else {
        //console.log(`    No mutual match detected`);
      }
      
      // Small delay between matches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // === STEP 5: Final Results Summary ===

    //console.log(`\n Alice's Matches:`);
    matches.forEach((match, index) => {
      const status = match.matchFound ? " MATCHED" : " NO MATCH";
      console.log(`   ${index + 1}. Alice + ${match.target}: ${status}`);
    });
    
    //console.log(`\n All 10 Profiles Created:`);
    profiles.forEach((profile, index) => {
      const isAlice = index === 0;
      const isLikedByAlice = aliceTargets.some(t => t.user.publicKey.equals(profile.user.publicKey));
      const matchStatus = isAlice ? "( Main Character)" : 
                         isLikedByAlice ? "( Liked by Alice)" : 
                         "( Available)";
      console.log(`   ${index + 1}. ${profile.profileData.username} (${profile.profileData.age}, ${profile.profileData.locationCity}) ${matchStatus}`);
    });
    
    const successfulMatches = matches.filter(m => m.matchFound);
    expect(successfulMatches.length).to.equal(3);
    expect(profiles.length).to.equal(10);
    
    console.log("Multi-profile matching test completed with 3 successful matches");
    
  });
});


