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
import { useTransactionNotifications } from '@/components/transaction-toast';

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
  const txNotifications = useTransactionNotifications();
  
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
  const checkingMutualMatchRef = useRef<Set<number>>(new Set()); // Track sessions being checked
  const processedEventsRef = useRef<Set<string>>(new Set()); // Track processed events to prevent duplicates
  
  // Static event handlers reference to prevent recreation
  const eventHandlersRef = useRef<DatingServiceEvents | null>(null);

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

  // Event handlers for blockchain events - using regular object to avoid Rules of Hooks violation
  const eventHandlers: DatingServiceEvents = {
    onProfileCreated: (event: any) => {
      // Profile created event received
      console.log(`👤 Profile created for user ${event.user?.toString()}`);
      console.log('✅ Profile created successfully');
    },

    onMatchSessionCreated: (event: any) => {
      // Match session created event received
      console.log('📄 Match session created event received');
    },

    onLikeSubmitted: (event: any) => {
      // Like submitted event received
      console.log('💕 Like submitted event received');
    },

    onMutualInterestDetected: (event: any) => {
      // Mutual interest detected from blockchain event
      const sessionId = event.sessionId?.toString();
      const eventKey = `mutual_interest_${sessionId}`;
      
      // Prevent duplicate processing of same event
      if (processedEventsRef.current.has(eventKey)) {
        console.log(`⚠️ Duplicate onMutualInterestDetected event for session ${sessionId} - skipping`);
        return;
      }
      
      processedEventsRef.current.add(eventKey);
      console.log(`💕 Mutual interest detected for session ${sessionId}`);
      console.log('🎉 It\'s a Match! Both users liked each other! Checking final match...');
      
      // Auto-trigger final match check when receiving blockchain event
      if (sessionId && publicKey && datingServiceRef.current) {
        // Prevent duplicate calls for same session
        if (checkingMutualMatchRef.current.has(parseInt(sessionId))) {
          console.log(`⚠️ checkMutualMatch already in progress for session ${sessionId}`);
          return;
        }

        setTimeout(async () => {
          try {
            checkingMutualMatchRef.current.add(parseInt(sessionId));
            console.log(`🔍 Starting checkMutualMatch for session ${sessionId}`);
            
            // Call checkMutualMatch directly through service
            const sessionPDA = datingServiceRef.current!.getSessionPDA(parseInt(sessionId));
            const finalResult = await datingServiceRef.current!.checkMutualMatch(sessionPDA, publicKey);
            
            if (finalResult?.isMatch) {
              console.log(`✅ Match confirmed for session ${sessionId}`);
            }
          } catch (error) {
            console.error(`❌ checkMutualMatch failed for session ${sessionId}:`, error);
          } finally {
            checkingMutualMatchRef.current.delete(parseInt(sessionId));
          }
        }, 1500);
      }
    },

    onMutualMatchFound: (event: any) => {
      // Mutual match found - final confirmation from blockchain
      const sessionId = event.sessionId?.toString() || '';
      const eventKey = `match_found_${sessionId}`;
      
      // Prevent duplicate processing of same event
      if (processedEventsRef.current.has(eventKey)) {
        console.log(`⚠️ Duplicate onMutualMatchFound event for session ${sessionId} - skipping`);
        return;
      }
      
      processedEventsRef.current.add(eventKey);
      console.log(`🎉 Mutual match found confirmed for session ${sessionId}`);
      console.log('💕 Match Confirmed! You can now start chatting!');
    },

    onNoMutualMatch: (event: any) => {
      // No mutual match
      const sessionId = event.sessionId?.toString() || '';
      
      console.log(`❌ No mutual match for session ${sessionId}`);
      console.log('❌ No mutual match confirmed');
    },
  };



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

      // Check SOL balance for user wallet
      const userBalance = await provider.connection.getBalance(publicKey);
      const minBalance = 0.1 * 1000000000; // 0.1 SOL minimum
      
      if (userBalance < minBalance) {
        throw new Error('Insufficient SOL balance. Please ensure your wallet has at least 0.1 SOL for MPC operations.');
      }

      // Initialize MPC environment with retry
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await service.initializeMPCEnvironment();
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

      // Load existing sessions after initialization  
      loadExistingSessions();

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
      }, [program, provider, publicKey, state.isInitialized, state.isInitializing, toast, eventHandlers]);

  // Create a match session with another user
  const createMatchSession = useCallback(async (
    targetProfile: FrontendProfile
  ): Promise<MatchSession | null> => {
    if (!datingServiceRef.current || !publicKey) {
      throw new Error('Dating service not initialized or wallet not connected');
    }

    try {
      const targetPublicKey = new PublicKey(targetProfile.walletAddress || targetProfile.id);
      
      const session = await datingServiceRef.current.createMatchSession(
        publicKey,
        targetPublicKey
      );

      // Handle session creation event
      const sessionEvent = eventManager.handleSessionCreated(
        session.sessionId.toString(),
        publicKey.toString(),
        targetPublicKey.toString(),
        '', // TX signature will be updated later
        Date.now()
      );

              // Mark as completed with 5-second delay for MPC confirmation
        setTimeout(() => {
          eventManager.updateTransactionStatus(
            sessionEvent.id,
            session.txSignature || 'session_creation_tx',
            true,
            'completed'
          );

          // Show transaction notification for 5 seconds
          txNotifications.showTransactionSuccess(
            'session_created',
            session.txSignature || 'session_creation_tx',
            `Match session created with ${targetProfile.name}`
          );
        }, 5000); // Wait 5 seconds for MPC confirmation

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
      // First check local state for performance
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

      // If not found locally, query blockchain for existing session
      if (!session) {
        console.log(`🔍 No local session found, checking blockchain...`);
        const targetPublicKey = new PublicKey(targetProfile.walletAddress || targetProfile.id);
        
        const existingSession = await datingServiceRef.current.findExistingSession(
          publicKey,
          targetPublicKey
        );
        
        if (existingSession) {
          console.log(`✅ Found existing session ${existingSession.sessionId} on blockchain`);
          session = existingSession;
          
          // Add to local state for future use
          setState(prev => ({
            ...prev,
            currentSessions: [...prev.currentSessions, existingSession]
          }));
        } else {
          // No existing session found, create new one
          console.log(`🆕 Creating new match session`);
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
        }
      } else {
        console.log(`✅ Using existing local session ${session.sessionId}`);
      }

      const targetPublicKey = new PublicKey(targetProfile.walletAddress || targetProfile.id);
      
      // Handle unlike locally without blockchain submission
      if (!isLike) {
        // Unlike is handled locally - no need for onchain transaction
        const likeEvent = eventManager.handleLikeSubmitted(
          session.sessionId.toString(),
          publicKey.toString(),
          targetPublicKey.toString(),
          false,
          targetProfile.name,
          '' // No transaction for unlike
        );

        toast({
          title: "Unlike sent",
          description: `Removed like for ${targetProfile.name}`,
        });
      } else {
        // Only submit likes to blockchain
        if (!connected || !sendTransaction) {
          throw new Error('Wallet not connected or does not support transaction signing');
        }

        const result = await datingServiceRef.current.submitLikeWithWallet(
          session.sessionPDA,
          publicKey,
          targetPublicKey,
          true
        );

        // Handle like submission event
        const likeEvent = eventManager.handleLikeSubmitted(
          session.sessionId.toString(),
          publicKey.toString(),
          targetPublicKey.toString(),
          true,
          targetProfile.name,
          result.txSignature
        );

        // Mark as completed and show notification (delayed by 5 seconds for MPC confirmation)
        setTimeout(() => {
          eventManager.updateTransactionStatus(
            likeEvent.id,
            result.txSignature,
            true,
            'completed'
          );

          // Show transaction notification for 5 seconds
          txNotifications.showTransactionSuccess(
            'like_submitted',
            result.txSignature,
            `Like sent to ${targetProfile.name}`
          );
        }, 5000); // Wait 5 seconds for MPC confirmation
      }

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

      // Local check removed - will rely on blockchain events for mutual interest detection

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
    if (!datingServiceRef.current || !publicKey) {
      throw new Error('Dating service not initialized or wallet not connected');
    }

    try {
      // Checking mutual match
      
      const sessionPDA = datingServiceRef.current.getSessionPDA(sessionId);
      const result = await datingServiceRef.current.checkMutualMatch(
        sessionPDA,
        publicKey
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
  }, [publicKey, toast]);

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



  // Load user's existing sessions from blockchain
  const loadExistingSessions = useCallback(async () => {
    if (!datingServiceRef.current || !publicKey) return;
    
    try {
      const userSessions = await datingServiceRef.current.getUserSessions(publicKey);
      
      // Update state with existing sessions
      setState(prev => ({
        ...prev,
        currentSessions: userSessions
      }));
      
    } catch (error) {
      console.error("❌ Failed to load existing sessions:", error);
    }
  }, [publicKey]);

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
