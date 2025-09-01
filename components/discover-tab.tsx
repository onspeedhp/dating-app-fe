'use client';

import { useState, useEffect, useMemo } from 'react';
import { SwipeCard } from '@/components/swipe-card';
import { MatchOverlay } from '@/components/match-overlay';
import { ProfileCardSkeleton } from '@/components/loading-skeleton';
import { Button } from '@/components/ui/button';
import { X, Heart, Star, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockProfiles, type Profile } from '@/lib/mock-data';

interface DiscoverTabProps {
  user: any;
}

export function DiscoverTab({ user }: DiscoverTabProps) {
  const [profiles, setProfiles] = useState<Profile[]>(mockProfiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const currentProfile = profiles[currentIndex];

  const handleSwipe = (direction: 'left' | 'right', profile: Profile) => {
    if (isAnimating) return;

    setIsAnimating(true);

    if (direction === 'right') {
      // Like action - no toast notification
      // Check if it's a match
      if (profile.isMatch) {
        setMatchedProfile(profile);
        setShowMatch(true);
      }
    } else {
      // Pass action - no toast notification
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

  const resetStack = () => {
    setCurrentIndex(0);
    setProfiles([...mockProfiles]);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: 'Stack refreshed!',
        description: 'New profiles are ready to discover',
      });
    }, 1000);
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
          disabled={index !== 0 || isAnimating}
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
              Loading new profiles...
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

  if (currentIndex >= profiles.length) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center p-6 text-center'>
        <div className='w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6'>
          <Heart className='w-12 h-12 text-primary' />
        </div>
        <h2 className='text-2xl font-bold mb-2'>No more profiles!</h2>
        <p className='text-muted-foreground mb-8 max-w-sm'>
          You've seen everyone in your area. Check back later for new profiles
          or expand your search radius.
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
          <p className='text-sm text-muted-foreground'>
            Find your perfect match
          </p>
        </div>
        <div className='w-10 h-10 bg-primary rounded-full flex items-center justify-center'>
          <Heart className='w-5 h-5 text-primary-foreground fill-current' />
        </div>
      </div>

      {/* Card Stack */}
      <div className='flex-1 relative px-4 pb-20 overflow-hidden'>
        <div
          className='relative w-full h-full'
          style={{ height: 'calc(100vh - 180px)' }}
        >
          {/* Show next 2 cards in background for depth */}
          {profileCards}
        </div>
      </div>

      {/* Match Overlay */}
      {showMatch && matchedProfile && (
        <MatchOverlay profile={matchedProfile} onClose={handleMatchClose} />
      )}
    </div>
  );
}
