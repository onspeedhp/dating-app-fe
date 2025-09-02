'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, X } from 'lucide-react';
import type { Profile } from '@/lib/mock-data';

interface MatchOverlayProps {
  profile: Profile;
  onClose: () => void;
}

export function MatchOverlay({ profile, onClose }: MatchOverlayProps) {
  return (
    <div className='fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4' style={{ height: 'calc(100vh - 100px)' }}>
      <Card className='w-full max-w-sm border-0 bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm'>
        <CardContent className='p-8 text-center'>
          {/* Close Button */}
          <Button
            variant='ghost'
            size='icon'
            className='absolute top-4 right-4 rounded-full'
            onClick={onClose}
          >
            <X className='w-5 h-5' />
          </Button>

          {/* Match Animation */}
          <div className='mb-6'>
            <div className='relative'>
              <div className='w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse'>
                <Heart className='w-12 h-12 text-primary-foreground fill-current' />
              </div>
              <div className='absolute inset-0 w-24 h-24 bg-primary/30 rounded-full mx-auto animate-ping'></div>
            </div>
          </div>

          {/* Match Text */}
          <h2 className='text-3xl font-bold text-primary mb-2'>
            It's a Match!
          </h2>
          <p className='text-muted-foreground mb-6'>
            You and {profile.name} liked each other
          </p>

          {/* Profile Preview */}
          <div className='flex items-center justify-center gap-4 mb-8'>
            <div className='w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20'>
              <img
                src='/diverse-user-avatars.png'
                alt='Your photo'
                className='w-full h-full object-cover'
              />
            </div>
            <Heart className='w-6 h-6 text-primary fill-current' />
            <div className='w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20'>
              <img
                src={
                  profile.photos[0] ||
                  '/placeholder.svg?height=64&width=64&query=profile photo'
                }
                alt={profile.name}
                className='w-full h-full object-cover'
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className='space-y-3'>
            <Button size='lg' className='w-full h-12 rounded-2xl'>
              <MessageCircle className='w-5 h-5 mr-2' />
              Send a message
            </Button>
            <Button
              variant='outline'
              size='lg'
              className='w-full h-12 rounded-2xl bg-transparent'
              onClick={onClose}
            >
              Keep browsing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
