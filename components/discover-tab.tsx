'use client';

import { useState, useEffect, useMemo } from 'react';
import { SwipeCard } from '@/components/swipe-card';
import { MatchOverlay } from '@/components/match-overlay';
import { ProfileCardSkeleton } from '@/components/loading-skeleton';
import { Button } from '@/components/ui/button';
import { X, Heart, Star, RotateCcw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useContract } from '@/hooks/use-contract';
import { useDatingService } from '@/hooks/use-dating-service';
import { 
  transformOnChainProfilesToFrontend, 
  type FrontendProfile,
  type OnChainProfile 
} from '@/lib/profile-utils';

interface DiscoverTabProps {
  user: any;
}

export function DiscoverTab({ user }: DiscoverTabProps) {
  const [profiles, setProfiles] = useState<FrontendProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<FrontendProfile | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentMatches, setRecentMatches] = useState<string[]>([]);
  const { toast } = useToast();
  const { getActiveProfiles, isConnected } = useContract();
  const { 
    state: datingState, 
    submitLike, 
    checkMutualMatch, 
    isLiking, 
    hasActiveSession,
    getSessionByProfileId,
    getRecentEvents,
    getMatches
  } = useDatingService();

  // Fetch onchain profiles
  useEffect(() => {
    async function fetchProfiles() {
      if (!isConnected) {
        setError('Wallet not connected');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch active profiles from blockchain
        const onchainProfiles = await getActiveProfiles(20);
        
        // Filter out current user's profile
        const filteredProfiles = onchainProfiles.filter(
          profile => profile.account.owner.toString() !== user?.walletAddress
        );
        
        // Transform to frontend format
        const frontendProfiles = transformOnChainProfilesToFrontend(filteredProfiles);
        
        // Add some randomness to isMatch for demo
        const profilesWithMatches = frontendProfiles.map(profile => ({
          ...profile,
          isMatch: Math.random() > 0.7 // 30% chance of match
        }));
        
        setProfiles(profilesWithMatches);
        setCurrentIndex(0);
      } catch (err: any) {
        setError(err.message || 'Failed to load profiles');
        toast({
          title: 'Error loading profiles',
          description: 'Failed to fetch profiles from blockchain. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfiles();
  }, [isConnected, getActiveProfiles, user?.walletAddress, toast]);

  // Monitor dating service events for real-time match notifications
  useEffect(() => {
    const matches = getMatches();
    const recentMatches = matches.filter(match => 
      Date.now() - match.timestamp < 10000 // Within last 10 seconds
    );
    
    recentMatches.forEach(matchEvent => {
      if (!recentMatches.includes(matchEvent.sessionId)) {
        setRecentMatches(prev => [...prev, matchEvent.sessionId]);
        
        // Find the profile that was matched
        const matchedProfileFromEvent = profiles.find(p => 
          p.walletAddress === matchEvent.userA || 
          p.walletAddress === matchEvent.userB
        );
        
        if (matchedProfileFromEvent) {
          setMatchedProfile(matchedProfileFromEvent);
          setShowMatch(true);
          
          toast({
            title: "🎉 Real-time Match!",
            description: `You matched with ${matchedProfileFromEvent.name}!`,
          });
        }
      }
    });
  }, [getMatches, profiles, recentMatches, toast]);

  const currentProfile = profiles[currentIndex];

  const handleSwipe = async (direction: 'left' | 'right', profile: FrontendProfile) => {
    if (isAnimating || isLiking(profile.id)) return;

    setIsAnimating(true);

    try {
      if (direction === 'right') {
        // Submitting like action
        
        // Submit encrypted like
        await submitLike(profile, true);
        
        // Check for existing session to see if we should check for mutual match
        const existingSession = getSessionByProfileId(profile.id);
        if (existingSession) {
          // Found existing session, checking for mutual match
          
          // Wait a bit for the like to be processed, then check for mutual match
          setTimeout(async () => {
            try {
              const matchResult = await checkMutualMatch(existingSession.sessionId);
              // Match check completed
              
              if (matchResult?.isMatch) {
                setMatchedProfile(profile);
                setShowMatch(true);
                
                toast({
                  title: "It's a Match! 🎉",
                  description: `You and ${profile.name} liked each other!`,
                });
              }
            } catch (matchError) {
              // Match check failed - will be handled by error state
              toast({
                title: 'Match Check Failed',
                description: 'Could not verify mutual match. The like was still submitted.',
                variant: 'destructive'
              });
            }
          }, 3000); // Wait 3 seconds for MPC computation
        } else {
          // Like submitted - session will be created
        }
        
        toast({
          title: 'Encrypted Like Sent! 🔒',
          description: `Your like for ${profile.name} has been encrypted and submitted securely.`,
        });
      } else {
        // Passing on profile
        
        // Submit unlike (dislike)
        await submitLike(profile, false);
        
        toast({
          title: 'Pass',
          description: `You passed on ${profile.name}.`,
        });
      }
    } catch (error) {
      // Swipe action failed - showing user feedback
      
      let errorMessage = 'Could not submit your action. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('not initialized')) {
          errorMessage = 'Dating service not ready. Please wait for initialization to complete.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Network timeout. Your action may still be processing.';
        }
      }
      
      toast({
        title: 'Action Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }

    // Move to next profile after animation
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsAnimating(false);
    }, 300);
  };

  const handleButtonAction = (action: 'pass' | 'like' | 'superlike') => {
    if (!currentProfile || isAnimating) return;

    switch (action) {
      case 'pass':
        handleSwipe('left', currentProfile);
        break;
      case 'like':
        handleSwipe('right', currentProfile);
        break;
      case 'superlike':
        // Super like action - no toast notification for now
        break;
    }
  };

  const handleMatchClose = () => {
    setShowMatch(false);
    setMatchedProfile(null);
  };

  const resetStack = async () => {
    setIsLoading(true);
    try {
      // Fetch fresh profiles from blockchain
      const onchainProfiles = await getActiveProfiles(20);
      
      // Filter out current user's profile
      const filteredProfiles = onchainProfiles.filter(
        profile => profile.account.owner.toString() !== user?.walletAddress
      );
      
      // Transform to frontend format
      const frontendProfiles = transformOnChainProfilesToFrontend(filteredProfiles);
      
      // Add some randomness to isMatch for demo
      const profilesWithMatches = frontendProfiles.map(profile => ({
        ...profile,
        isMatch: Math.random() > 0.7 // 30% chance of match
      }));
      
      setProfiles(profilesWithMatches);
      setCurrentIndex(0);
      
      toast({
        title: 'Stack refreshed!',
        description: 'Fresh profiles loaded from blockchain',
      });
    } catch (err: any) {
      // Refresh failed - maintaining current state
      toast({
        title: 'Refresh failed',
        description: 'Failed to load fresh profiles. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Memoize the profile cards to prevent unnecessary re-renders
  const profileCards = useMemo(() => {
    return profiles
      .slice(currentIndex, currentIndex + 3)
      .map((profile, index) => (
        <SwipeCard
          key={profile.id}
          profile={profile}
          onSwipe={(direction) => handleSwipe(direction, profile)}
          onPass={() => handleButtonAction('pass')}
          onLike={() => handleButtonAction('like')}
          onSuperLike={() => handleButtonAction('superlike')}
          isTop={index === 0}
          zIndex={3 - index}
          scale={1 - index * 0.05}
          translateY={index * 8}
          disabled={index !== 0 || isAnimating || isLiking(profile.id)}
          isProcessing={isLiking(profile.id)}
        />
      ));
  }, [currentIndex, profiles, isAnimating, handleSwipe, handleButtonAction]);

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col'>
        <div className='flex items-center justify-between p-4'>
          <div>
            <h1 className='text-2xl font-bold'>Discover</h1>
            <p className='text-sm text-muted-foreground'>
              Loading profiles from blockchain...
            </p>
          </div>
          <div className='w-10 h-10 bg-primary rounded-full flex items-center justify-center'>
            <Heart className='w-5 h-5 text-primary-foreground fill-current' />
          </div>
        </div>

        <div className='flex-1 relative px-4 pb-20 overflow-hidden'>
          <div
            className='relative w-full h-full'
            style={{ height: 'calc(100vh - 180px)' }}
          >
            <ProfileCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error || !isConnected) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center p-6 text-center'>
        <div className='w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-6'>
          <X className='w-12 h-12 text-destructive' />
        </div>
        <h2 className='text-2xl font-bold mb-2'>
          {!isConnected ? 'Wallet not connected' : 'Error loading profiles'}
        </h2>
        <p className='text-muted-foreground mb-8 max-w-sm'>
          {!isConnected 
            ? 'Please connect your wallet to discover profiles'
            : error || 'Failed to load profiles from blockchain. Please try again.'
          }
        </p>
        <Button onClick={() => window.location.reload()} size='lg' className='rounded-2xl'>
          <RotateCcw className='w-5 h-5 mr-2' />
          Try Again
        </Button>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center p-6 text-center'>
        <div className='w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6'>
          <Heart className='w-12 h-12 text-primary' />
        </div>
        <h2 className='text-2xl font-bold mb-2'>
          {profiles.length === 0 ? 'No profiles found!' : 'No more profiles!'}
        </h2>
        <p className='text-muted-foreground mb-8 max-w-sm'>
          {profiles.length === 0 
            ? 'No profiles available on the blockchain yet. Be the first to create one or check back later!'
            : "You've seen everyone available. Check back later for new profiles or refresh to see them again."
          }
        </p>
        <Button onClick={resetStack} size='lg' className='rounded-2xl'>
          <RotateCcw className='w-5 h-5 mr-2' />
          Refresh Stack
        </Button>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* Header */}
      <div className='flex items-center justify-between p-4'>
        <div>
          <h1 className='text-2xl font-bold'>Discover</h1>
          <div className='flex items-center gap-2'>
            <p className='text-sm text-muted-foreground'>
              Find your perfect match
            </p>
            {datingState.isInitialized && (
              <div className='flex items-center gap-1 text-xs text-green-600'>
                <Zap className='w-3 h-3' />
                <span>Encrypted</span>
              </div>
            )}
            {datingState.isInitializing && (
              <div className='flex items-center gap-1 text-xs text-yellow-600'>
                <Zap className='w-3 h-3 animate-pulse' />
                <span>Initializing...</span>
              </div>
            )}
            {datingState.error && !datingState.isInitializing && (
              <div className='flex items-center gap-1 text-xs text-red-600'>
                <Zap className='w-3 h-3' />
                <span>MPC Error</span>
              </div>
            )}
            {/* Real-time activity indicator */}
            {datingState.recentEvents.length > 0 && (
              <div className='flex items-center gap-1 text-xs text-blue-600'>
                <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse'></div>
                <span>{datingState.recentEvents.length} events</span>
              </div>
            )}
          </div>
        </div>
        <div className='w-10 h-10 bg-primary rounded-full flex items-center justify-center'>
          <Heart className='w-5 h-5 text-primary-foreground fill-current' />
        </div>
      </div>

      {/* Card Stack Container */}
      <div className='flex-1 flex justify-center items-center px-4 lg:px-8 pb-20 lg:pb-8'>
        <div className='relative w-full max-w-md lg:max-w-lg'>
          <div
            className='relative w-full'
            style={{ aspectRatio: '3/4', maxHeight: 'calc(100vh - 200px)' }}
          >
            {profileCards}
          </div>
        </div>
      </div>

      {/* Match Overlay */}
      {showMatch && matchedProfile && (
        <MatchOverlay profile={matchedProfile} onClose={handleMatchClose} />
      )}
    </div>
  );
}
