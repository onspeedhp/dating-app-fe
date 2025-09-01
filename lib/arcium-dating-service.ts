/**
 * Arcium MPC Dating Service
 * Handles encrypted matching, likes, and match sessions using Arcium MPC
 * Updated to match test implementation with proper event handling
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Contract } from "./contract";
import { FrontendProfile } from "./profile-utils";
import {
  awaitComputationFinalization,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  buildFinalizeCompDefTx,
  RescueCipher,
  deserializeLE,
  getMXEPublicKey,
  getMXEAccAddress,
  getMempoolAccAddress,
  getComputationAccAddress,
  getExecutingPoolAccAddress,
  getClusterAccAddress,
  x25519,
} from "@arcium-hq/client";
import { randomBytes } from "crypto";

export interface MatchSession {
  sessionId: number;
  sessionPDA: PublicKey;
  userA: PublicKey;
  userB: PublicKey;
  isFinalized: boolean;
  matchFound: boolean;
  createdAt: Date;
  lastUpdated: Date;
}

export interface LikeAction {
  userId: PublicKey;
  targetId: PublicKey;
  isLike: boolean;
  timestamp: number;
}

export interface MatchResult {
  isMatch: boolean;
  sessionId: number;
  canStartConversation: boolean;
  matchedAt?: Date;
  computationResult?: any;
}

export interface DatingServiceEvents {
  onProfileCreated?: (event: any) => void;
  onMatchSessionCreated?: (event: any) => void;
  onLikeSubmitted?: (event: any) => void;
  onMutualInterestDetected?: (event: any) => void;
  onMutualMatchFound?: (event: any) => void;
  onNoMutualMatch?: (event: any) => void;
}

export class ArciumDatingService {
  private program: anchor.Program<Contract>;
  private provider: anchor.AnchorProvider;
  private clusterOffset: number;
  private clusterAccount: PublicKey;
  private mxePublicKey: Uint8Array | null = null;
  private eventListeners: Map<string, number> = new Map();
  private eventCallbacks: DatingServiceEvents = {};

  // PDAs for computation definitions
  private initMatchSessionCompDefPDA!: PublicKey;
  private submitLikeCompDefPDA!: PublicKey;
  private checkMutualMatchCompDefPDA!: PublicKey;

  constructor(
    program: anchor.Program<Contract>,
    provider: anchor.AnchorProvider,
    clusterOffset: number = 1116522165, // DEVNET CLUSTER OFFSET
    eventCallbacks?: DatingServiceEvents
  ) {
    this.program = program;
    this.provider = provider;
    this.clusterOffset = clusterOffset; // Use provided cluster offset (always devnet)
    this.clusterAccount = getClusterAccAddress(clusterOffset);
    this.eventCallbacks = eventCallbacks || {};
    this.initializeCompDefPDAs();
    this.setupEventListeners();
  }

  private initializeCompDefPDAs() {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    
    // Initialize all computation definition PDAs
    const initMatchSessionOffset = getCompDefAccOffset("init_match_session");
    this.initMatchSessionCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, this.program.programId.toBuffer(), initMatchSessionOffset],
      getArciumProgAddress()
    )[0];

    const submitLikeOffset = getCompDefAccOffset("submit_like");
    this.submitLikeCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, this.program.programId.toBuffer(), submitLikeOffset],
      getArciumProgAddress()
    )[0];

    const checkMutualMatchOffset = getCompDefAccOffset("check_mutual_match");
    this.checkMutualMatchCompDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, this.program.programId.toBuffer(), checkMutualMatchOffset],
      getArciumProgAddress()
    )[0];
  }

  /**
   * Setup event listeners for blockchain events
   */
  private setupEventListeners() {
    const events = [
      { name: 'profileCreatedEvent', callback: this.eventCallbacks.onProfileCreated },
      { name: 'matchSessionCreatedEvent', callback: this.eventCallbacks.onMatchSessionCreated },
      { name: 'likeSubmittedEvent', callback: this.eventCallbacks.onLikeSubmitted },
      { name: 'mutualInterestDetectedEvent', callback: this.eventCallbacks.onMutualInterestDetected },
      { name: 'mutualMatchFoundEvent', callback: this.eventCallbacks.onMutualMatchFound },
      { name: 'noMutualMatchEvent', callback: this.eventCallbacks.onNoMutualMatch }
    ];

    events.forEach(({ name, callback }) => {
      if (callback) {
        try {
          const listenerId = this.program.addEventListener(name as any, callback);
          this.eventListeners.set(name, listenerId);
          console.log(`✅ Event listener setup for ${name}`);
        } catch (error) {
          console.warn(`⚠️ Could not setup event listener for ${name}:`, error);
        }
      }
    });
  }

  /**
   * Update event callbacks
   */
  updateEventCallbacks(callbacks: DatingServiceEvents) {
    // Remove existing listeners
    this.removeEventListeners();
    
    // Update callbacks
    this.eventCallbacks = { ...this.eventCallbacks, ...callbacks };
    
    // Setup new listeners
    this.setupEventListeners();
  }

  /**
   * Remove all event listeners
   */
  private removeEventListeners() {
    this.eventListeners.forEach((listenerId, eventName) => {
      try {
        this.program.removeEventListener(listenerId);
        console.log(`🔄 Removed event listener for ${eventName}`);
      } catch (error) {
        console.warn(`⚠️ Could not remove event listener for ${eventName}:`, error);
      }
    });
    this.eventListeners.clear();
  }

  /**
   * Cleanup method to remove all event listeners
   */
  cleanup() {
    this.removeEventListeners();
  }

  /**
   * Initialize MPC environment and validate computation definitions
   */
  async initializeMPCEnvironment(owner: Keypair): Promise<void> {
    try {
      // Get MXE public key
      this.mxePublicKey = await this.getMXEPublicKeyWithRetry();
      
      console.log("✅ MPC environment initialized successfully");
      console.log("ℹ️  Note: Computation definitions should be initialized separately by the program deployer");
      
      // Validate that computation definitions exist (don't try to create them)
      await this.validateComputationDefinitions();
      
    } catch (error) {
      console.error("❌ Failed to initialize MPC environment:", error);
      
      if (error instanceof Error && error.message.includes('not initialized')) {
        throw new Error(
          "Computation definitions not found. Please run the initialization script first:\n" +
          "npm run init-comp-defs\n\n" +
          "This script must be run by the program deployer with proper authority."
        );
      }
      
      throw error;
    }
  }

  private async initializeComputationDefinitions(owner: Keypair, mxeAccountPDA: PublicKey) {
    const compDefs = [
      { 
        name: "init_match_session", 
        method: "initInitMatchSessionCompDef", 
        pda: this.initMatchSessionCompDefPDA, 
        offset: getCompDefAccOffset("init_match_session") 
      },
      { 
        name: "submit_like", 
        method: "initSubmitLikeCompDef", 
        pda: this.submitLikeCompDefPDA, 
        offset: getCompDefAccOffset("submit_like") 
      },
      { 
        name: "check_mutual_match", 
        method: "initCheckMutualMatchCompDef", 
        pda: this.checkMutualMatchCompDefPDA, 
        offset: getCompDefAccOffset("check_mutual_match") 
      }
    ];

    for (const compDef of compDefs) {
      try {
        // Check if account already exists
        const accountInfo = await this.provider.connection.getAccountInfo(compDef.pda);
        if (accountInfo) {
          console.log(`✅ ${compDef.name} computation definition already exists`);
          continue;
        }

        console.log(`🔄 Initializing ${compDef.name} computation definition...`);
        
        await (this.program.methods as any)[compDef.method]()
          .accounts({
            compDefAccount: compDef.pda,
            payer: owner.publicKey,
            mxeAccount: mxeAccountPDA,
          })
          .signers([owner])
          .rpc();
        
        console.log(`📝 ${compDef.name} account created, finalizing...`);
        
        // Finalize the computation definition
        const finalizeTx = await buildFinalizeCompDefTx(
          this.provider,
          Buffer.from(compDef.offset).readUInt32LE(),
          this.program.programId
        );
        
        const latestBlockhash = await this.provider.connection.getLatestBlockhash();
        finalizeTx.recentBlockhash = latestBlockhash.blockhash;
        finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
        finalizeTx.sign(owner);
        await this.provider.sendAndConfirm(finalizeTx);
        
        console.log(`✅ ${compDef.name} computation definition initialized and finalized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${compDef.name}:`, error);
        // Don't throw here, continue with other definitions
      }
    }
  }

  /**
   * Check if computation definitions are initialized
   */
  private async validateComputationDefinitions(): Promise<void> {
    const compDefs = [
      { name: "init_match_session", pda: this.initMatchSessionCompDefPDA },
      { name: "submit_like", pda: this.submitLikeCompDefPDA },
      { name: "check_mutual_match", pda: this.checkMutualMatchCompDefPDA }
    ];

    for (const compDef of compDefs) {
      const accountInfo = await this.provider.connection.getAccountInfo(compDef.pda);
      if (!accountInfo) {
        throw new Error(
          `Computation definition '${compDef.name}' not initialized. ` +
          `Please ensure MPC environment is properly set up. ` +
          `Try refreshing the page or contact support.`
        );
      }
    }
  }

  /**
   * Create a new match session between two users
   * Updated to match test implementation with proper event handling
   */
  async createMatchSession(
    userA: PublicKey,
    userB: PublicKey,
    owner: Keypair
  ): Promise<MatchSession> {
    const sessionId = Date.now();
    const nonce = Date.now() + Math.floor(Math.random() * 1000);
    
    console.log(`🔄 Creating match session ${sessionId}:`, {
      userA: userA.toString().slice(0, 8) + '...',
      userB: userB.toString().slice(0, 8) + '...',
      owner: owner.publicKey.toString().slice(0, 8) + '...',
      nonce
    });
    
    const [matchSessionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("match_session"),
        Buffer.from(new anchor.BN(sessionId).toArray("le", 8))
      ],
      this.program.programId
    );

    const mxeAccountPDA = getMXEAccAddress(this.program.programId);
    const mempoolPDA = getMempoolAccAddress(this.program.programId);
    const executingPoolPDA = getExecutingPoolAccAddress(this.program.programId);

    const initMatchComputationOffset = new anchor.BN(randomBytes(8));
    const computationAccountPDA = getComputationAccAddress(
      this.program.programId,
      initMatchComputationOffset
    );

    console.log(`📊 Match session PDAs:`, {
      sessionPDA: matchSessionPDA.toString().slice(0, 8) + '...',
      computationPDA: computationAccountPDA.toString().slice(0, 8) + '...',
      computationOffset: initMatchComputationOffset.toString(),
      compDefPDA: this.initMatchSessionCompDefPDA.toString().slice(0, 8) + '...',
      clusterAccount: this.clusterAccount.toString().slice(0, 8) + '...',
      clusterOffset: this.clusterOffset
    });

    // Validate cluster account exists
    try {
      const clusterAccountInfo = await this.provider.connection.getAccountInfo(this.clusterAccount);
      if (!clusterAccountInfo) {
        throw new Error(`Cluster account not found: ${this.clusterAccount.toString()}`);
      }
      console.log(`✅ Cluster account verified: ${this.clusterAccount.toString().slice(0, 8)}...`);
    } catch (error) {
      console.error(`❌ Cluster account validation failed:`, error);
      throw error;
    }

    try {
      // Validate computation definitions are initialized
      await this.validateComputationDefinitions();
      
      // Setup event listener for this session creation
      const sessionEventPromise = this.awaitEvent('matchSessionCreatedEvent');
      
      // Create match session
      const txSignature = await this.program.methods
        .initMatchSession(
          initMatchComputationOffset,
          new anchor.BN(sessionId),
          userA,
          userB,
          new anchor.BN(nonce)
        )
        .accountsPartial({
          matchPairSession: matchSessionPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: computationAccountPDA,
          compDefAccount: this.initMatchSessionCompDefPDA,
          clusterAccount: this.clusterAccount,
        })
        .signers([owner])
        .rpc();

      console.log(`📝 Match session transaction: ${txSignature}`);

      // Wait for session creation event (with timeout)
      try {
        const sessionEvent = await Promise.race([
          sessionEventPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Session event timeout")), 5000)
          )
        ]);
        console.log(`📡 Match session created event:`, sessionEvent);
      } catch (eventError) {
        console.warn(`⚠️ Session event not received:`, eventError);
      }

      // Check if computation account exists first
      try {
        const compAccountInfo = await this.provider.connection.getAccountInfo(computationAccountPDA);
        console.log(`💾 Computation account status:`, {
          exists: !!compAccountInfo,
          owner: compAccountInfo?.owner?.toString(),
          lamports: compAccountInfo?.lamports,
          dataLength: compAccountInfo?.data?.length
        });
      } catch (error) {
        console.warn(`⚠️ Could not check computation account:`, error);
      }

      // Simple approach: Just wait for transaction confirmation + small delay
      console.log(`⚡ Transaction confirmed, allowing time for Arcium processing...`);
      
      // Give Arcium some time to process (much faster than polling)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Just 2 seconds
      
      // Quick verification that session account exists
      try {
        const sessionAccountInfo = await this.provider.connection.getAccountInfo(matchSessionPDA);
        if (sessionAccountInfo && sessionAccountInfo.data.length > 0) {
          console.log(`✅ Session account confirmed with ${sessionAccountInfo.data.length} bytes`);
        } else {
          console.warn(`⚠️ Session account not found, but transaction was confirmed. Proceeding...`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not verify session account, but proceeding:`, error);
      }
      console.log(`✅ Match session created: ${sessionId}`);

      return {
        sessionId,
        sessionPDA: matchSessionPDA,
        userA,
        userB,
        isFinalized: false,
        matchFound: false,
        createdAt: new Date(),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error("❌ Failed to create match session:", error);
      throw error;
    }
  }

  /**
   * Submit a like (or unlike) action
   * Updated to match test implementation with proper event handling
   */
  async submitLike(
    sessionPDA: PublicKey,
    userId: PublicKey,
    targetId: PublicKey,
    isLike: boolean,
    userKeypair: Keypair
  ): Promise<void> {
    if (!this.mxePublicKey) {
      throw new Error("MXE public key not available. Initialize MPC environment first.");
    }

    try {
      // Generate MPC encryption keys
      const userMpcPrivateKey = x25519.utils.randomSecretKey();
      const userMpcPublicKey = x25519.getPublicKey(userMpcPrivateKey);
      const sharedSecret = x25519.getSharedSecret(userMpcPrivateKey, this.mxePublicKey);
      const cipher = new RescueCipher(sharedSecret);

      // Convert user IDs to u64 format (match test implementation)
      const userIdU64 = new anchor.BN(new Uint8Array(userId.toBuffer().slice(0, 8)), "le");
      const targetIdU64 = new anchor.BN(new Uint8Array(targetId.toBuffer().slice(0, 8)), "le");
      const currentTimestamp = Math.floor(Date.now() / 1000);

      console.log(`📝 Submitting ${isLike ? 'like' : 'unlike'} from ${userId.toString().slice(0, 8)}... to ${targetId.toString().slice(0, 8)}...`);

      // Encrypt the like action data (match test implementation)
      const nonce = new Uint8Array(randomBytes(16));
      const ciphertext = cipher.encrypt(
        [
          BigInt(userIdU64.toString()),
          BigInt(targetIdU64.toString()),
          isLike ? BigInt(1) : BigInt(0),
          BigInt(currentTimestamp)
        ],
        nonce
      );

      // Generate computation account
      const likeComputationOffset = new anchor.BN(randomBytes(8));
      const computationAccountPDA = getComputationAccAddress(
        this.program.programId,
        likeComputationOffset
      );

      const mxeAccountPDA = getMXEAccAddress(this.program.programId);
      const mempoolPDA = getMempoolAccAddress(this.program.programId);
      const executingPoolPDA = getExecutingPoolAccAddress(this.program.programId);

      // Setup event listeners for like submission
      const likeEventPromise = this.awaitEvent('likeSubmittedEvent');
      const mutualInterestPromise = this.awaitEvent('mutualInterestDetectedEvent');

      // Submit like transaction
      const txSignature = await this.program.methods
        .submitLike(
          likeComputationOffset,
          Array.from(ciphertext[0]), // encrypted_user_id
          Array.from(ciphertext[1]), // encrypted_target_id
          Array.from(ciphertext[2]), // encrypted_like_action
          Array.from(ciphertext[3]), // encrypted_timestamp
          Array.from(userMpcPublicKey),
          new anchor.BN(deserializeLE(nonce).toString())
        )
        .accountsPartial({
          matchPairSession: sessionPDA,
          user: userKeypair.publicKey, // Must match the signer
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: computationAccountPDA,
          compDefAccount: this.submitLikeCompDefPDA,
          clusterAccount: this.clusterAccount,
        })
        .signers([userKeypair])
        .rpc();

      console.log(`📝 ${isLike ? 'Like' : 'Unlike'} transaction: ${txSignature}`);

      // Wait for events (non-blocking)
      Promise.all([
        this.safeAwaitEvent(likeEventPromise, 'likeSubmittedEvent'),
        this.safeAwaitEvent(mutualInterestPromise, 'mutualInterestDetectedEvent')
      ]).then(([likeEvent, mutualEvent]) => {
        if (likeEvent) console.log(`📡 Like submitted event:`, likeEvent);
        if (mutualEvent) console.log(`💕 Mutual interest detected event:`, mutualEvent);
      }).catch(() => {
        // Events are optional, don't fail the operation
      });

      // Wait for computation finalization
      await this.awaitComputationWithTimeout(
        likeComputationOffset,
        `${isLike ? "Like" : "Unlike"} submission`,
        15000
      );

      console.log(`✅ ${isLike ? "Like" : "Unlike"} submitted successfully`);
    } catch (error) {
      console.error(`❌ Failed to submit ${isLike ? "like" : "unlike"}:`, error);
      throw error;
    }
  }

  /**
   * Submit a like using wallet adapter (no keypair needed)
   */
  async submitLikeWithWallet(
    sessionPDA: PublicKey,
    userId: PublicKey,
    targetId: PublicKey,
    isLike: boolean
  ): Promise<void> {
    if (!this.mxePublicKey) {
      throw new Error("MXE public key not available. Initialize MPC environment first.");
    }

    try {
      // Generate MPC encryption keys
      const userMpcPrivateKey = x25519.utils.randomSecretKey();
      const userMpcPublicKey = x25519.getPublicKey(userMpcPrivateKey);
      const sharedSecret = x25519.getSharedSecret(userMpcPrivateKey, this.mxePublicKey);
      const cipher = new RescueCipher(sharedSecret);

      // Convert user IDs to u64 format (match test implementation)
      const userIdU64 = new anchor.BN(new Uint8Array(userId.toBuffer().slice(0, 8)), "le");
      const targetIdU64 = new anchor.BN(new Uint8Array(targetId.toBuffer().slice(0, 8)), "le");
      const currentTimestamp = Math.floor(Date.now() / 1000);

      console.log(`📝 Submitting ${isLike ? 'like' : 'unlike'} from ${userId.toString().slice(0, 8)}... to ${targetId.toString().slice(0, 8)}...`);

      // Encrypt the like action data (match test implementation)
      const nonce = new Uint8Array(randomBytes(16));
      const ciphertext = cipher.encrypt(
        [
          BigInt(userIdU64.toString()),
          BigInt(targetIdU64.toString()),
          isLike ? BigInt(1) : BigInt(0),
          BigInt(currentTimestamp)
        ],
        nonce
      );

      // Generate computation account
      const likeComputationOffset = new anchor.BN(randomBytes(8));
      const computationAccountPDA = getComputationAccAddress(
        this.program.programId,
        likeComputationOffset
      );

      const mxeAccountPDA = getMXEAccAddress(this.program.programId);
      const mempoolPDA = getMempoolAccAddress(this.program.programId);
      const executingPoolPDA = getExecutingPoolAccAddress(this.program.programId);

      // Setup event listeners for like submission
      const likeEventPromise = this.awaitEvent('likeSubmittedEvent');
      const mutualInterestPromise = this.awaitEvent('mutualInterestDetectedEvent');

      // Submit like transaction using wallet adapter
      const txSignature = await this.program.methods
        .submitLike(
          likeComputationOffset,
          Array.from(ciphertext[0]), // encrypted_user_id
          Array.from(ciphertext[1]), // encrypted_target_id
          Array.from(ciphertext[2]), // encrypted_like_action
          Array.from(ciphertext[3]), // encrypted_timestamp
          Array.from(userMpcPublicKey),
          new anchor.BN(deserializeLE(nonce).toString())
        )
        .accountsPartial({
          matchPairSession: sessionPDA,
          user: userId, // Connected wallet public key
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: computationAccountPDA,
          compDefAccount: this.submitLikeCompDefPDA,
          clusterAccount: this.clusterAccount,
        })
        .rpc(); // Uses provider's wallet for signing automatically

      console.log(`📝 ${isLike ? 'Like' : 'Unlike'} transaction: ${txSignature}`);

      // Wait for events (non-blocking)
      Promise.all([
        this.safeAwaitEvent(likeEventPromise, 'likeSubmittedEvent'),
        this.safeAwaitEvent(mutualInterestPromise, 'mutualInterestDetectedEvent')
      ]).then(([likeEvent, mutualEvent]) => {
        if (likeEvent) console.log(`📡 Like submitted event:`, likeEvent);
        if (mutualEvent) console.log(`💕 Mutual interest detected event:`, mutualEvent);
      }).catch(() => {
        // Events are optional, don't fail the operation
      });

      // Simple delay instead of heavy polling
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`✅ ${isLike ? "Like" : "Unlike"} submitted successfully`);
    } catch (error) {
      console.error(`❌ Failed to submit ${isLike ? "like" : "unlike"}:`, error);
      throw error;
    }
  }

  /**
   * Check for mutual match
   * Updated to match test implementation with proper event handling
   */
  async checkMutualMatch(
    sessionPDA: PublicKey,
    owner: Keypair
  ): Promise<MatchResult> {
    try {
      const checkMatchComputationOffset = new anchor.BN(randomBytes(8));
      const checkMatchComputationAccountPDA = getComputationAccAddress(
        this.program.programId,
        checkMatchComputationOffset
      );

      const mxeAccountPDA = getMXEAccAddress(this.program.programId);
      const mempoolPDA = getMempoolAccAddress(this.program.programId);
      const executingPoolPDA = getExecutingPoolAccAddress(this.program.programId);

      console.log(`🔍 Checking for mutual match...`);

      // Setup event listeners for match result
      const matchResultEventPromise = Promise.race([
        this.awaitEvent('mutualMatchFoundEvent'),
        this.awaitEvent('noMutualMatchEvent')
      ]);

      // Submit mutual match check
      const txSignature = await this.program.methods
        .checkMutualMatch(checkMatchComputationOffset)
        .accountsPartial({
          matchPairSession: sessionPDA,
          payer: owner.publicKey,
          mxeAccount: mxeAccountPDA,
          mempoolAccount: mempoolPDA,
          executingPool: executingPoolPDA,
          computationAccount: checkMatchComputationAccountPDA,
          compDefAccount: this.checkMutualMatchCompDefPDA,
          clusterAccount: this.clusterAccount,
        })
        .signers([owner])
        .rpc();

      console.log(`📝 Match check transaction: ${txSignature}`);

      // Wait for match result event (non-blocking)
      this.safeAwaitEvent(matchResultEventPromise, 'mutualMatchResult').then((matchEvent) => {
        if (matchEvent) console.log(`📡 Match result event:`, matchEvent);
      }).catch(() => {
        // Events are optional
      });

      // Wait for computation finalization
      const computationResult = await this.awaitComputationWithTimeout(
        checkMatchComputationOffset,
        "Mutual match check",
        20000
      );

      console.log(`🔍 Match check computation completed:`, computationResult);

      // Fetch final session state
      const finalSession = await this.program.account.matchPairSession.fetch(sessionPDA);
      const sessionId = finalSession.sessionId.toNumber();

      console.log(`✅ Mutual match check completed. Match found: ${finalSession.matchFound}`);

      return {
        isMatch: finalSession.matchFound,
        sessionId,
        canStartConversation: finalSession.matchFound && finalSession.isFinalized,
        matchedAt: finalSession.matchFound ? new Date() : undefined,
        computationResult
      };
    } catch (error) {
      console.error("❌ Failed to check mutual match:", error);
      throw error;
    }
  }

  /**
   * Get match session details
   */
  async getMatchSession(sessionPDA: PublicKey): Promise<MatchSession | null> {
    try {
      const sessionData = await this.program.account.matchPairSession.fetch(sessionPDA);
      
      return {
        sessionId: sessionData.sessionId.toNumber(),
        sessionPDA,
        userA: sessionData.userA,
        userB: sessionData.userB,
        isFinalized: sessionData.isFinalized,
        matchFound: sessionData.matchFound,
        createdAt: new Date(sessionData.createdAt.toNumber() * 1000),
        lastUpdated: new Date(sessionData.lastUpdated.toNumber() * 1000)
      };
    } catch (error) {
      console.error("❌ Failed to fetch match session:", error);
      return null;
    }
  }

  /**
   * Find session PDA by session ID
   */
  getSessionPDA(sessionId: number): PublicKey {
    const [sessionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("match_session"),
        Buffer.from(new anchor.BN(sessionId).toArray("le", 8))
      ],
      this.program.programId
    );
    return sessionPDA;
  }

  // Helper methods
  private async getMXEPublicKeyWithRetry(maxRetries: number = 10): Promise<Uint8Array> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mxePublicKey = await getMXEPublicKey(this.provider, this.program.programId);
        if (mxePublicKey) {
          return mxePublicKey;
        }
      } catch (error) {
        // Silent retry
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    throw new Error(`Failed to fetch MXE public key after ${maxRetries} attempts`);
  }

  /**
   * Fast session polling - optimized for speed
   * Checks session account creation and updates rapidly
   */
  private async fastSessionPolling(
    sessionPDA: PublicKey,
    operationName: string
  ): Promise<void> {
    console.log(`⚡ Fast polling for ${operationName}...`);
    
    const startTime = Date.now();
    const maxDuration = 15000; // 15 seconds max
    let attempts = 0;
    
    // Phase 1: Rapid polling for account creation (100ms intervals)
    while (Date.now() - startTime < 5000) { // First 5 seconds
      try {
        const sessionAccountInfo = await this.provider.connection.getAccountInfo(sessionPDA);
        
        if (sessionAccountInfo && sessionAccountInfo.data.length > 0) {
          console.log(`🎯 Session account found after ${attempts + 1} attempts (${Date.now() - startTime}ms)`);
          
          // Phase 2: Check for meaningful data (basic validation)
          if (sessionAccountInfo.data.length >= 100) { // Basic session data size
            console.log(`✅ ${operationName} completed - account has sufficient data`);
            return;
          }
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Fast 100ms polling
      } catch (error) {
        console.warn(`⚠️ Fast poll error (attempt ${attempts}):`, error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Phase 2: Medium polling for callback completion (250ms intervals)
    console.log(`🔄 Phase 2: Medium polling for callback completion...`);
    while (Date.now() - startTime < maxDuration) {
      try {
        const sessionAccountInfo = await this.provider.connection.getAccountInfo(sessionPDA);
        
        if (sessionAccountInfo && sessionAccountInfo.data.length >= 100) {
          console.log(`📊 Session account check:`, {
            dataLength: sessionAccountInfo.data.length,
            lamports: sessionAccountInfo.lamports,
            attempts: attempts + 1,
            duration: Date.now() - startTime
          });
          
          // Simple success criteria: account exists with reasonable data
          console.log(`✅ ${operationName} completed successfully!`);
          return;
        }
        
        attempts++;
        if (attempts % 20 === 0) {
          console.log(`🔄 Still polling... attempt ${attempts}, ${Date.now() - startTime}ms elapsed`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 250)); // Medium polling
      } catch (error) {
        console.warn(`⚠️ Medium poll error:`, error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    
    throw new Error(`${operationName} timed out after ${maxDuration}ms`);
  }

  /**
   * Manual computation polling - checks for callback completion
   * Based on smart contract callback pattern that updates last_updated timestamp
   */
  private async manualComputationPolling(
    sessionPDA: PublicKey,
    operationName: string,
    startTimestamp: number,
    maxAttempts: number = 60,
    intervalMs: number = 500
  ): Promise<void> {
    console.log(`⏳ Starting callback completion polling for ${operationName}...`);
    console.log(`📅 Waiting for last_updated > ${startTimestamp}`);
    
    let attempts = 0;
    let isCompleted = false;

    while (attempts < maxAttempts && !isCompleted) {
      try {
        // Check the session account directly (where callback updates happen)
        const sessionAccountInfo = await this.provider.connection.getAccountInfo(sessionPDA);
        
        if (sessionAccountInfo && sessionAccountInfo.data.length > 0) {
          // Parse the session account to check last_updated timestamp
          try {
            const sessionAccount = this.program.account.matchPairSession.coder.accounts.decode(
              'matchPairSession',
              sessionAccountInfo.data
            );
            
            const lastUpdated = sessionAccount.lastUpdated?.toNumber?.() || sessionAccount.lastUpdated;
            
            console.log(`📊 ${operationName} session check (attempt ${attempts + 1}):`, {
              lastUpdated,
              startTimestamp,
              isCallbackComplete: lastUpdated > startTimestamp,
              isFinalized: sessionAccount.isFinalized,
              dataLength: sessionAccountInfo.data.length
            });
            
            // Check if callback has completed (last_updated timestamp changed)
            if (lastUpdated > startTimestamp) {
              console.log(`✅ ${operationName} callback completed! Last updated: ${lastUpdated}`);
              isCompleted = true;
              break;
            }
            
          } catch (parseError) {
            console.warn(`⚠️ Could not parse session account:`, parseError);
            // Fallback to data length check
            if (sessionAccountInfo.data.length > 200) { // Session accounts should be substantial
              console.log(`📊 ${operationName} data found via fallback check`);
              isCompleted = true;
              break;
            }
          }
        }
        
        attempts++;
        if (attempts % 10 === 0) {
          console.log(`🔄 Still waiting for ${operationName} callback completion... (attempt ${attempts}/${maxAttempts})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.warn(`⚠️ Error checking ${operationName} session account (attempt ${attempts}):`, error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    if (!isCompleted) {
      throw new Error(`${operationName} callback did not complete within expected time`);
    }

    console.log(`✅ ${operationName} callback polling completed successfully after ${attempts + 1} attempts`);
  }

  private async awaitComputationWithTimeout(
    computationOffset: anchor.BN,
    operationName: string,
    timeoutMs: number
  ): Promise<any> {
    console.log(`🔄 Starting computation finalization for ${operationName}:`, {
      offset: computationOffset.toString(),
      programId: this.program.programId.toString(),
      timeoutMs
    });

    const finalizationPromise = awaitComputationFinalization(
      this.provider,
      computationOffset,
      this.program.programId,
      "confirmed"
    ).then(result => {
      console.log(`✅ Computation finalization resolved for ${operationName}`);
      return result;
    }).catch(error => {
      console.error(`❌ Computation finalization rejected for ${operationName}:`, error);
      throw error;
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        console.error(`⏰ Computation finalization timeout for ${operationName} after ${timeoutMs}ms`);
        reject(new Error(`${operationName} timeout`));
      }, timeoutMs)
    );

    return Promise.race([finalizationPromise, timeoutPromise]);
  }

  /**
   * Await a specific event with one-time listener
   */
  private async awaitEvent(eventName: string): Promise<any> {
    return new Promise((resolve) => {
      let listenerId: number;
      const timeout = setTimeout(() => {
        try {
          this.program.removeEventListener(listenerId);
        } catch (error) {
          // Ignore cleanup errors
        }
        resolve(null);
      }, 10000); // 10 second timeout

      try {
        listenerId = this.program.addEventListener(eventName as any, (event) => {
          clearTimeout(timeout);
          try {
            this.program.removeEventListener(listenerId);
          } catch (error) {
            // Ignore cleanup errors
          }
          resolve(event);
        });
      } catch (error) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  /**
   * Safely await event with error handling
   */
  private async safeAwaitEvent(eventPromise: Promise<any>, eventName: string): Promise<any> {
    try {
      const event = await Promise.race([
        eventPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${eventName} timeout`)), 5000)
        )
      ]);
      return event;
    } catch (error) {
      console.warn(`⚠️ Event ${eventName} not received:`, error);
      return null;
    }
  }
}

// Utility functions for dating app integration
export async function createDatingService(
  program: anchor.Program<Contract>,
  provider: anchor.AnchorProvider,
  clusterOffset?: number,
  eventCallbacks?: DatingServiceEvents
): Promise<ArciumDatingService> {
  return new ArciumDatingService(program, provider, clusterOffset, eventCallbacks);
}

export function generateSessionId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}
