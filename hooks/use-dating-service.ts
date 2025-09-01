/**
 * React hook for Arcium MPC Dating Service
 * Provides encrypted dating functionality with likes, matches, and sessions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey, Keypair } from '@solana/web3.js';
import { useContract } from './use-contract';
import { useWalletInfo } from './use-wallet';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  ArciumDatingService, 
  MatchSession, 
  LikeAction, 
  MatchResult,
  DatingServiceEvents,
  createDatingService 
} from '@/lib/arcium-dating-service';
import { getClusterOffset, logNetworkInfo, getCurrentNetwork } from '@/lib/arcium-config';
import { FrontendProfile } from '@/lib/profile-utils';
import { useToast } from './use-toast';
import { useDatingEvents, DatingEvent, LikeEvent, MatchEvent } from '@/lib/dating-events';

export interface DatingServiceState {
  isInitialized: boolean;
  isInitializing: boolean;
  currentSessions: MatchSession[];
  pendingLikes: Map<string, boolean>; // profileId -> isLiking
  matches: MatchResult[];
  recentEvents: DatingEvent[]; // Store recent dating events
  likesReceived: LikeEvent[]; // Likes received by current user
  pendingLikesWaitingResponse: LikeEvent[]; // Likes sent, waiting for response
  error: string | null;
}

export interface UseDatingServiceReturn {
  // State
  state: DatingServiceState;
  
  // Actions
  initializeService: () => Promise<void>;
  createMatchSession: (targetProfile: FrontendProfile) => Promise<MatchSession | null>;
  submitLike: (targetProfile: FrontendProfile, isLike: boolean) => Promise<void>;
  checkMutualMatch: (sessionId: number) => Promise<MatchResult | null>;
  getMatchSession: (sessionId: number) => Promise<MatchSession | null>;
  
  // Utils
  isLiking: (profileId: string) => boolean;
  hasActiveSession: (profileId: string) => boolean;
  getSessionByProfileId: (profileId: string) => MatchSession | null;
  
  // Session Management
  getActiveSessionsCount: () => number;
  getMatchedSessionsCount: () => number;
  getSessionStats: () => {
    total: number;
    active: number;
    matched: number;
    completed: number;
    pending: number;
  };
  
  // Event handling
  clearRecentEvents: () => void;
  getRecentEvents: () => DatingEvent[];
  
  // New event system functions
  getPendingLikes: () => LikeEvent[];
  getLikesReceived: () => LikeEvent[];
  getMatches: () => MatchEvent[];
  getEventStats: () => any;
  clearAllEvents: () => void;
}

export function useDatingService(): UseDatingServiceReturn {
  const { program, provider, publicKey } = useContract();
  const { walletInfo } = useWalletInfo();
  const { connected, sendTransaction } = useWallet();
  const { toast } = useToast();
  const eventManager = useDatingEvents();
  
  const [state, setState] = useState<DatingServiceState>({
    isInitialized: false,
    isInitializing: false,
    currentSessions: [],
    pendingLikes: new Map(),
    matches: [],
    recentEvents: [],
    likesReceived: [],
    pendingLikesWaitingResponse: [],
    error: null
  });

  const datingServiceRef = useRef<ArciumDatingService | null>(null);
  const ownerKeypairRef = useRef<Keypair | null>(null);

  // Load events from local storage on initialization
  useEffect(() => {
    if (publicKey) {
      const recentEvents = eventManager.getRecentEvents(10);
      const likesReceived = eventManager.getLikesForUser(publicKey.toString());
      const pendingLikes = eventManager.getPendingLikes(publicKey.toString());
      
      setState(prev => ({
        ...prev,
        recentEvents,
        likesReceived,
        pendingLikesWaitingResponse: pendingLikes
      }));
    }
  }, [publicKey]); // Remove eventManager from dependencies to prevent infinite loop

  // Event handlers for blockchain events
  const eventHandlers: DatingServiceEvents = {
    onProfileCreated: useCallback((event: any) => {
      // Profile created event received
      const datingEvent = eventManager.addEvent({
        type: 'session_created', // We'll track this as a general event
        sessionId: `profile_${event.user}`,
        userA: event.user.toString(),
        userB: '',
        status: 'completed',
        data: event
      });
      
      setState(prev => ({
        ...prev,
        recentEvents: [datingEvent, ...prev.recentEvents.slice(0, 9)]
      }));
      
      toast({
        title: "Profile Created",
        description: `New profile created on-chain`,
      });
    }, [toast, eventManager]),

    onMatchSessionCreated: useCallback((event: any) => {
      // Match session created event received
      // This will be handled in createMatchSession function
    }, []),

    onLikeSubmitted: useCallback((event: any) => {
      // Like submitted event received
      // This will be handled in submitLike function
    }, []),

    onMutualInterestDetected: useCallback((event: any) => {
      // Mutual interest detected
      
      toast({
        title: "Mutual Interest! 💕",
        description: "Both users liked each other",
      });
    }, [toast]),

    onMutualMatchFound: useCallback((event: any) => {
      // Mutual match found
      
      // Handle match found with event manager
      const matchEvent = eventManager.handleMatchFound(
        event.sessionId?.toString() || '',
        event.userA?.toString() || '',
        event.userB?.toString() || '',
        'User A', // We'll get actual names later
        'User B'
      );
      
      setState(prev => ({
        ...prev,
        recentEvents: [matchEvent, ...prev.recentEvents.slice(0, 9)]
      }));
      
      toast({
        title: "It's a Match! 🎉",
        description: "You both matched! Start a conversation?",
      });
    }, [toast, eventManager]),

    onNoMutualMatch: useCallback((event: any) => {
      // No mutual match
      
      const noMatchEvent = eventManager.addEvent({
        type: 'no_match',
        sessionId: event.sessionId?.toString() || '',
        userA: event.userA?.toString() || '',
        userB: event.userB?.toString() || '',
        status: 'completed',
        data: event
      });
      
      setState(prev => ({
        ...prev,
        recentEvents: [noMatchEvent, ...prev.recentEvents.slice(0, 9)]
      }));
    }, [eventManager]),
  };

  // Get MXE Owner Keypair (shared for entire dating app)
  const getMXEOwnerKeypair = useCallback(async (): Promise<Keypair> => {
    // In production, this should be loaded from secure environment
    // For demo/testing, use a consistent keypair stored locally
    
    const DEMO_OWNER_KEY = 'dating_app_mxe_owner';
    const savedKeypair = typeof window !== 'undefined' 
      ? localStorage.getItem(DEMO_OWNER_KEY) 
      : null;
      
    if (savedKeypair) {
      try {
        const secretKey = JSON.parse(savedKeypair);
        // Using existing MXE owner keypair
        return Keypair.fromSecretKey(new Uint8Array(secretKey));
      } catch (error) {
        // Failed to load saved owner keypair
      }
    }
    
    // Generate new owner keypair for this dating app instance
    const ownerKeypair = Keypair.generate();
    // Generated new MXE owner keypair
    
    // Save for consistency across app sessions
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_OWNER_KEY, JSON.stringify(Array.from(ownerKeypair.secretKey)));
    }
    
    return ownerKeypair;
  }, []);

  // Initialize the dating service
  const initializeService = useCallback(async () => {
    if (!program || !provider || !publicKey || state.isInitialized || state.isInitializing) {
      return;
    }

    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      // Log network configuration for debugging
      logNetworkInfo();
      
      // Get cluster offset for devnet testing
      const clusterOffset = getClusterOffset();
      
      // Create dating service instance with event callbacks
      const service = await createDatingService(program, provider, clusterOffset, eventHandlers);
      datingServiceRef.current = service;

      // Get the MXE owner keypair (shared for all users of this dating app)
      // In production, this should be the actual MXE operator's keypair
      const ownerKeypair = await getMXEOwnerKeypair();
      ownerKeypairRef.current = ownerKeypair;

      // Check SOL balance for user wallet
      const userBalance = await provider.connection.getBalance(publicKey);
      const minBalance = 0.1 * 1000000000; // 0.1 SOL minimum
      
      if (userBalance < minBalance) {
        throw new Error('Insufficient SOL balance. Please ensure your wallet has at least 0.1 SOL for MPC operations.');
      }

      // Log owner keypair info for debugging
      const ownerBalance = await provider.connection.getBalance(ownerKeypair.publicKey);
      // Owner keypair configured

      // Initialize MPC environment with retry
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await service.initializeMPCEnvironment(ownerKeypair);
          break; // Success, exit retry loop
        } catch (initError) {
          retryCount++;
          
          if (retryCount >= maxRetries) {
            throw initError; // Re-throw if all retries failed
          }
          
          // MPC initialization retry
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false
      }));

      toast({
        title: "Dating Service Ready",
        description: "Encrypted matching system initialized successfully",
      });

    } catch (error) {
      // Failed to initialize dating service
      
      let errorMessage = 'Unknown error';
      let errorDescription = 'Could not initialize encrypted matching system';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('Insufficient SOL')) {
          errorDescription = 'Please add more SOL to your wallet (minimum 0.1 SOL required)';
        } else if (error.message.includes('not initialized')) {
          errorDescription = 'MPC computation definitions need to be set up. Please try again in a few minutes.';
        } else if (error.message.includes('AccountNotInitialized')) {
          errorDescription = 'Blockchain accounts not ready. Please refresh the page and try again.';
        }
      }
      
      setState(prev => ({
        ...prev,
        isInitializing: false,
        error: errorMessage
      }));

      toast({
        title: "Initialization Failed",
        description: errorDescription,
        variant: "destructive"
      });
    }
      }, [program, provider, publicKey, state.isInitialized, state.isInitializing, toast, eventHandlers, getMXEOwnerKeypair]);

  // Create a match session with another user
  const createMatchSession = useCallback(async (
    targetProfile: FrontendProfile
  ): Promise<MatchSession | null> => {
    if (!datingServiceRef.current || !ownerKeypairRef.current || !publicKey) {
      throw new Error('Dating service not initialized');
    }

    try {
      const targetPublicKey = new PublicKey(targetProfile.walletAddress || targetProfile.id);
      
      const session = await datingServiceRef.current.createMatchSession(
        publicKey,
        targetPublicKey,
        ownerKeypairRef.current
      );

      // Handle session creation event
      const sessionEvent = eventManager.handleSessionCreated(
        session.sessionId.toString(),
        publicKey.toString(),
        targetPublicKey.toString(),
        '', // TX signature will be available in the service
        Date.now()
      );

      setState(prev => ({
        ...prev,
        currentSessions: [...prev.currentSessions, session],
        recentEvents: [sessionEvent, ...prev.recentEvents.slice(0, 9)]
      }));

      // Session created and tracked
      return session;
    } catch (error) {
      // Failed to create match session
      toast({
        title: "Session Creation Failed",
        description: "Could not create match session",
        variant: "destructive"
      });
      return null;
    }
  }, [publicKey, toast]);

  // Submit a like or unlike with enhanced session management
  const submitLike = useCallback(async (
    targetProfile: FrontendProfile,
    isLike: boolean
  ) => {
    if (!datingServiceRef.current || !publicKey || !connected) {
      throw new Error('Dating service not initialized or wallet not connected');
    }

    const profileId = targetProfile.id;
    
    // Set pending state
    setState(prev => ({
      ...prev,
      pendingLikes: new Map(prev.pendingLikes).set(profileId, true)
    }));

    try {
      // Enhanced session finding logic - check by multiple criteria
      let session = state.currentSessions.find(s => {
        const targetPubKey = targetProfile.walletAddress || targetProfile.id;
        const userAPubKey = s.userA.toString();
        const userBPubKey = s.userB.toString();
        const currentUserPubKey = publicKey.toString();
        
        // Session exists if current user is userA and target is userB, or vice versa
        return (
          (userAPubKey === currentUserPubKey && userBPubKey === targetPubKey) ||
          (userBPubKey === currentUserPubKey && userAPubKey === targetPubKey)
        );
      });

      if (!session) {
        // Creating new match session
        const newSession = await createMatchSession(targetProfile);
        if (!newSession) {
          throw new Error('Failed to create match session');
        }
        session = newSession;
        
        // Update sessions state immediately
        setState(prev => ({
          ...prev,
          currentSessions: [...prev.currentSessions, newSession]
        }));
      } else {
        // Using existing session
      }

      const targetPublicKey = new PublicKey(targetProfile.walletAddress || targetProfile.id);
      
      // Use wallet adapter for signing (no need for keypair generation)
      if (!connected || !sendTransaction) {
        throw new Error('Wallet not connected or does not support transaction signing');
      }

      await datingServiceRef.current.submitLikeWithWallet(
        session.sessionPDA,
        publicKey,
        targetPublicKey,
        isLike
      );

      // Handle like submission event
      const likeEvent = eventManager.handleLikeSubmitted(
        session.sessionId.toString(),
        publicKey.toString(),
        targetPublicKey.toString(),
        isLike,
        targetProfile.name,
        '' // TX signature will be available
      );

      // Check for mutual interest
      const mutualInterestCheck = eventManager.checkMutualInterest(session.sessionId.toString());
      
      // Like event tracked and mutual interest checked

      // Update session state after successful like submission
      setState(prev => {
        const updatedSessions = prev.currentSessions.map(s => 
          s.sessionId === session!.sessionId 
            ? { ...s, lastUpdated: new Date() }
            : s
        );
        
        // Update events and pending likes
        const recentEvents = eventManager.getRecentEvents(10);
        const pendingLikes = eventManager.getPendingLikes(publicKey.toString());
        
        return {
          ...prev,
          currentSessions: updatedSessions,
          recentEvents,
          pendingLikesWaitingResponse: pendingLikes
        };
      });

      // Check if this creates a mutual match
      const finalMutualCheck = eventManager.checkMutualInterest(session.sessionId.toString());
      if (finalMutualCheck.hasMutualInterest) {
        // Create a match event
        const matchEvent = eventManager.handleMatchFound(
          session.sessionId.toString(),
          publicKey.toString(),
          targetPublicKey.toString(),
          'You', // Current user
          targetProfile.name
        );
        
        // Mutual match detected and tracked
        
        // Show match notification
        setTimeout(() => {
          toast({
            title: "It's a Match! 🎉",
            description: `You and ${targetProfile.name} liked each other!`,
          });
        }, 1000);
      }

      toast({
        title: isLike ? "Like Sent! 💕" : "Unlike Sent",
        description: `Your ${isLike ? 'like' : 'unlike'} for ${targetProfile.name} has been submitted securely`,
      });

    } catch (error) {
      // Failed to submit like/unlike
      toast({
        title: "Action Failed",
        description: `Could not submit ${isLike ? 'like' : 'unlike'}`,
        variant: "destructive"
      });
    } finally {
      // Clear pending state
      setState(prev => {
        const newPendingLikes = new Map(prev.pendingLikes);
        newPendingLikes.delete(profileId);
        return {
          ...prev,
          pendingLikes: newPendingLikes
        };
      });
    }
  }, [publicKey, connected, state.currentSessions, createMatchSession, toast]);

  // Check for mutual match with enhanced state management
  const checkMutualMatch = useCallback(async (
    sessionId: number
  ): Promise<MatchResult | null> => {
    if (!datingServiceRef.current || !ownerKeypairRef.current) {
      throw new Error('Dating service not initialized');
    }

    try {
      // Checking mutual match
      
      const sessionPDA = datingServiceRef.current.getSessionPDA(sessionId);
      const result = await datingServiceRef.current.checkMutualMatch(
        sessionPDA,
        ownerKeypairRef.current
      );

      // Match check completed

      // Update both matches and sessions state
      setState(prev => ({
        ...prev,
        matches: [...prev.matches.filter(m => m.sessionId !== sessionId), result],
        currentSessions: prev.currentSessions.map(s => 
          s.sessionId === sessionId 
            ? { 
                ...s, 
                isFinalized: true, 
                matchFound: result.isMatch,
                lastUpdated: new Date() 
              }
            : s
        )
      }));

      if (result.isMatch) {
        toast({
          title: "It's a Match! 💕",
          description: "You both liked each other! Start a conversation?",
        });
      } else {
        // No mutual match found
      }

      return result;
    } catch (error) {
      // Failed to check mutual match
      toast({
        title: "Match Check Failed",
        description: "Could not check for mutual match",
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  // Get match session details
  const getMatchSession = useCallback(async (
    sessionId: number
  ): Promise<MatchSession | null> => {
    if (!datingServiceRef.current) {
      return null;
    }

    try {
      const sessionPDA = datingServiceRef.current.getSessionPDA(sessionId);
      return await datingServiceRef.current.getMatchSession(sessionPDA);
    } catch (error) {
      // Failed to get match session
      return null;
    }
  }, []);

  // Utility functions
  const isLiking = useCallback((profileId: string): boolean => {
    return state.pendingLikes.get(profileId) || false;
  }, [state.pendingLikes]);

  const hasActiveSession = useCallback((profileId: string): boolean => {
    return state.currentSessions.some(session => {
      const sessionUserA = session.userA.toString();
      const sessionUserB = session.userB.toString();
      return sessionUserA === profileId || sessionUserB === profileId;
    });
  }, [state.currentSessions]);

  const getSessionByProfileId = useCallback((profileId: string): MatchSession | null => {
    return state.currentSessions.find(session => {
      const sessionUserA = session.userA.toString();
      const sessionUserB = session.userB.toString();
      return sessionUserA === profileId || sessionUserB === profileId;
    }) || null;
  }, [state.currentSessions]);

  // Additional session management utilities
  const getActiveSessionsCount = useCallback((): number => {
    return state.currentSessions.filter(s => !s.isFinalized).length;
  }, [state.currentSessions]);

  const getMatchedSessionsCount = useCallback((): number => {
    return state.currentSessions.filter(s => s.isFinalized && s.matchFound).length;
  }, [state.currentSessions]);

  const getSessionStats = useCallback(() => {
    const total = state.currentSessions.length;
    const active = getActiveSessionsCount();
    const matched = getMatchedSessionsCount();
    const completed = state.currentSessions.filter(s => s.isFinalized).length;
    
    return {
      total,
      active,
      matched,
      completed,
      pending: total - completed
    };
  }, [state.currentSessions, getActiveSessionsCount, getMatchedSessionsCount]);

  // Event handling utilities
  const clearRecentEvents = useCallback(() => {
    setState(prev => ({ ...prev, recentEvents: [] }));
  }, []);

  const getRecentEvents = useCallback(() => {
    return eventManager.getRecentEvents(10);
  }, [eventManager]);

  // Additional helper functions for the new event system
  const getPendingLikes = useCallback(() => {
    if (!publicKey) return [];
    return eventManager.getPendingLikes(publicKey.toString());
  }, [publicKey, eventManager]);

  const getLikesReceived = useCallback(() => {
    if (!publicKey) return [];
    return eventManager.getLikesForUser(publicKey.toString());
  }, [publicKey, eventManager]);

  const getMatches = useCallback(() => {
    if (!publicKey) return [];
    return eventManager.getMatchesForUser(publicKey.toString());
  }, [publicKey, eventManager]);

  const getEventStats = useCallback(() => {
    if (!publicKey) return eventManager.getStats();
    return eventManager.getStats(publicKey.toString());
  }, [publicKey, eventManager]);

  const clearAllEvents = useCallback(() => {
    eventManager.clearAllEvents();
    setState(prev => ({
      ...prev,
      recentEvents: [],
      likesReceived: [],
      pendingLikesWaitingResponse: []
    }));
  }, [eventManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (datingServiceRef.current) {
        datingServiceRef.current.cleanup();
      }
    };
  }, []);

  // Auto-initialize when wallet is connected
  useEffect(() => {
    if (publicKey && !state.isInitialized && !state.isInitializing) {
      initializeService();
    }
  }, [publicKey, initializeService, state.isInitialized, state.isInitializing]);

  return {
    state,
    initializeService,
    createMatchSession,
    submitLike,
    checkMutualMatch,
    getMatchSession,
    isLiking,
    hasActiveSession,
    getSessionByProfileId,
    getActiveSessionsCount,
    getMatchedSessionsCount,
    getSessionStats,
    clearRecentEvents,
    getRecentEvents,
    getPendingLikes,
    getLikesReceived,
    getMatches,
    getEventStats,
    clearAllEvents
  };
}
