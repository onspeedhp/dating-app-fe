/**
 * Dating Events Management System
 * Handles tracking and storage of dating app events
 */

export interface DatingEvent {
  id: string;
  type: 'session_created' | 'like_submitted' | 'mutual_interest' | 'match_found' | 'no_match';
  timestamp: number;
  sessionId: string;
  userA: string;
  userB: string;
  data?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txSignature?: string;
}

export interface LikeEvent extends DatingEvent {
  type: 'like_submitted';
  data: {
    liker: string;
    target: string;
    isLike: boolean;
    profileName: string;
  };
}

export interface MatchEvent extends DatingEvent {
  type: 'match_found';
  data: {
    matchedAt: number;
    canStartConversation: boolean;
    profileNames: {
      userA: string;
      userB: string;
    };
  };
}

export interface SessionEvent extends DatingEvent {
  type: 'session_created';
  data: {
    nonce: number;
    createdAt: number;
  };
}

// Local storage keys
const STORAGE_KEYS = {
  EVENTS: 'dating_app_events',
  LIKES: 'dating_app_likes',
  MATCHES: 'dating_app_matches',
  SESSIONS: 'dating_app_sessions',
} as const;

/**
 * Dating Events Manager
 */
export class DatingEventsManager {
  private events: DatingEvent[] = [];
  private likes: Map<string, LikeEvent[]> = new Map();
  private matches: MatchEvent[] = [];
  private sessions: Map<string, SessionEvent> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load events from localStorage
   */
  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    try {
      const storedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (storedEvents) {
        this.events = JSON.parse(storedEvents);
      }

      const storedLikes = localStorage.getItem(STORAGE_KEYS.LIKES);
      if (storedLikes) {
        const likesArray = JSON.parse(storedLikes);
        this.likes = new Map(likesArray);
      }

      const storedMatches = localStorage.getItem(STORAGE_KEYS.MATCHES);
      if (storedMatches) {
        this.matches = JSON.parse(storedMatches);
      }

      const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (storedSessions) {
        const sessionsArray = JSON.parse(storedSessions);
        this.sessions = new Map(sessionsArray);
      }
    } catch (error) {
      console.warn('Failed to load dating events from storage:', error);
    }
  }

  /**
   * Save events to localStorage
   */
  private saveToStorage() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(this.events));
      localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(Array.from(this.likes.entries())));
      localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(this.matches));
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(Array.from(this.sessions.entries())));
    } catch (error) {
      console.warn('Failed to save dating events to storage:', error);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a new event
   */
  addEvent(event: Omit<DatingEvent, 'id' | 'timestamp'>): DatingEvent {
    const newEvent: DatingEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    };

    this.events.push(newEvent);
    this.saveToStorage();

    console.log(`📅 Dating event added:`, newEvent);
    return newEvent;
  }

  /**
   * Handle session creation
   */
  handleSessionCreated(sessionId: string, userA: string, userB: string, txSignature: string, nonce?: number): SessionEvent {
    const sessionEvent: SessionEvent = {
      id: this.generateEventId(),
      type: 'session_created',
      timestamp: Date.now(),
      sessionId,
      userA,
      userB,
      status: 'completed',
      txSignature,
      data: {
        nonce: nonce || Date.now(),
        createdAt: Date.now(),
      },
    };

    this.events.push(sessionEvent);
    this.sessions.set(sessionId, sessionEvent);
    this.saveToStorage();

    console.log(`🔄 Session created:`, sessionEvent);
    return sessionEvent;
  }

  /**
   * Handle like submission
   */
  handleLikeSubmitted(
    sessionId: string,
    liker: string,
    target: string,
    isLike: boolean,
    profileName: string,
    txSignature: string
  ): LikeEvent {
    const likeEvent: LikeEvent = {
      id: this.generateEventId(),
      type: 'like_submitted',
      timestamp: Date.now(),
      sessionId,
      userA: liker,
      userB: target,
      status: 'completed',
      txSignature,
      data: {
        liker,
        target,
        isLike,
        profileName,
      },
    };

    this.events.push(likeEvent);

    // Track likes by target
    if (!this.likes.has(target)) {
      this.likes.set(target, []);
    }
    this.likes.get(target)!.push(likeEvent);

    this.saveToStorage();

    console.log(`💕 Like ${isLike ? 'submitted' : 'withdrawn'}:`, likeEvent);
    return likeEvent;
  }

  /**
   * Handle mutual match detection
   */
  handleMatchFound(
    sessionId: string,
    userA: string,
    userB: string,
    profileNameA: string,
    profileNameB: string,
    txSignature?: string
  ): MatchEvent {
    const matchEvent: MatchEvent = {
      id: this.generateEventId(),
      type: 'match_found',
      timestamp: Date.now(),
      sessionId,
      userA,
      userB,
      status: 'completed',
      txSignature,
      data: {
        matchedAt: Date.now(),
        canStartConversation: true,
        profileNames: {
          userA: profileNameA,
          userB: profileNameB,
        },
      },
    };

    this.events.push(matchEvent);
    this.matches.push(matchEvent);
    this.saveToStorage();

    console.log(`🎉 Match found:`, matchEvent);
    return matchEvent;
  }

  /**
   * Check if there's mutual interest for a session
   */
  checkMutualInterest(sessionId: string): {
    hasMutualInterest: boolean;
    likes: LikeEvent[];
    userALiked: boolean;
    userBLiked: boolean;
  } {
    const sessionLikes = this.events.filter(
      (event): event is LikeEvent => 
        event.type === 'like_submitted' && 
        event.sessionId === sessionId &&
        event.data?.isLike === true
    ) as LikeEvent[];

    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        hasMutualInterest: false,
        likes: sessionLikes,
        userALiked: false,
        userBLiked: false,
      };
    }

    const userALiked = sessionLikes.some(like => like.data.liker === session.userA);
    const userBLiked = sessionLikes.some(like => like.data.liker === session.userB);
    const hasMutualInterest = userALiked && userBLiked;

    return {
      hasMutualInterest,
      likes: sessionLikes,
      userALiked,
      userBLiked,
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 10): DatingEvent[] {
    return this.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get likes for a user
   */
  getLikesForUser(userId: string): LikeEvent[] {
    return this.likes.get(userId) || [];
  }

  /**
   * Get pending likes (likes without responses)
   */
  getPendingLikes(userId: string): LikeEvent[] {
    const userLikes = this.events.filter(
      (event): event is LikeEvent => 
        event.type === 'like_submitted' && 
        event.data?.liker === userId &&
        event.data?.isLike === true
    ) as LikeEvent[];

    // Filter out likes that have been matched
    return userLikes.filter(like => {
      const hasMatch = this.matches.some(match => 
        match.sessionId === like.sessionId
      );
      return !hasMatch;
    });
  }

  /**
   * Get matches for a user
   */
  getMatchesForUser(userId: string): MatchEvent[] {
    return this.matches.filter(match => 
      match.userA === userId || match.userB === userId
    );
  }

  /**
   * Get events by session
   */
  getEventsBySession(sessionId: string): DatingEvent[] {
    return this.events.filter(event => event.sessionId === sessionId);
  }

  /**
   * Clear all events (for testing/debugging)
   */
  clearAllEvents() {
    this.events = [];
    this.likes.clear();
    this.matches = [];
    this.sessions.clear();
    this.saveToStorage();
    console.log('🧹 All dating events cleared');
  }

  /**
   * Get statistics
   */
  getStats(userId?: string) {
    const stats = {
      totalEvents: this.events.length,
      totalSessions: this.sessions.size,
      totalLikes: this.events.filter(e => e.type === 'like_submitted').length,
      totalMatches: this.matches.length,
      recentActivity: this.getRecentEvents(5),
    };

    if (userId) {
      return {
        ...stats,
        userLikes: this.getLikesForUser(userId).length,
        userMatches: this.getMatchesForUser(userId).length,
        pendingLikes: this.getPendingLikes(userId).length,
      };
    }

    return stats;
  }
}

// Global instance
export const datingEvents = new DatingEventsManager();

// Export helper functions
export const useDatingEvents = () => {
  return {
    manager: datingEvents,
    addEvent: datingEvents.addEvent.bind(datingEvents),
    handleSessionCreated: datingEvents.handleSessionCreated.bind(datingEvents),
    handleLikeSubmitted: datingEvents.handleLikeSubmitted.bind(datingEvents),
    handleMatchFound: datingEvents.handleMatchFound.bind(datingEvents),
    checkMutualInterest: datingEvents.checkMutualInterest.bind(datingEvents),
    getRecentEvents: datingEvents.getRecentEvents.bind(datingEvents),
    getPendingLikes: datingEvents.getPendingLikes.bind(datingEvents),
    getLikesForUser: datingEvents.getLikesForUser.bind(datingEvents),
    getMatchesForUser: datingEvents.getMatchesForUser.bind(datingEvents),
    getStats: datingEvents.getStats.bind(datingEvents),
    clearAllEvents: datingEvents.clearAllEvents.bind(datingEvents),
  };
};
