'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WalletConnectButton } from '@/components/wallet-connect-button';
import {
  Heart,
  Users,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

interface LandingScreenProps {
  onGetStarted: () => void;
}

export function LandingScreen({
  onGetStarted,
}: LandingScreenProps) {
  return (
    <div className='min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col'>
      {/* Header */}
      <div className='flex-1 flex flex-col items-center justify-center px-6 py-8'>
        {/* Logo */}
        <div className='mb-8 text-center'>
          <div className='flex items-center justify-center mb-4'>
            <div className='w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg'>
              <Heart className='w-8 h-8 text-primary-foreground fill-current' />
            </div>
          </div>
          <h1 className='text-4xl font-bold text-foreground mb-2'>Encrypted Match</h1>
          <p className='text-lg text-muted-foreground max-w-sm'>
            Find meaningful connections with people who share your interests
          </p>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-3 gap-4 mb-12 w-full max-w-sm'>
          <Card className='p-4 text-center border-0 bg-card/50 backdrop-blur-sm'>
            <div className='flex items-center justify-center mb-2'>
              <Users className='w-5 h-5 text-primary' />
            </div>
            <div className='text-2xl font-bold text-foreground'>1.2M</div>
            <div className='text-xs text-muted-foreground'>Active users</div>
          </Card>
          <Card className='p-4 text-center border-0 bg-card/50 backdrop-blur-sm'>
            <div className='flex items-center justify-center mb-2'>
              <Heart className='w-5 h-5 text-primary fill-current' />
            </div>
            <div className='text-2xl font-bold text-foreground'>850K</div>
            <div className='text-xs text-muted-foreground'>Matches made</div>
          </Card>
          <Card className='p-4 text-center border-0 bg-card/50 backdrop-blur-sm'>
            <div className='flex items-center justify-center mb-2'>
              <MessageCircle className='w-5 h-5 text-primary' />
            </div>
            <div className='text-2xl font-bold text-foreground'>2.1M</div>
            <div className='text-xs text-muted-foreground'>Messages sent</div>
          </Card>
        </div>

        {/* Hero Mock */}
        <div className='mb-12 relative'>
          <div className='w-64 h-96 bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl border border-border/50 shadow-2xl overflow-hidden'>
            <div className='p-6 h-full flex flex-col'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-2 h-2 bg-primary rounded-full'></div>
                <div className='text-xs font-medium text-muted-foreground'>
                  Encrypted Match
                </div>
                <div className='w-2 h-2 bg-accent rounded-full'></div>
              </div>
              <div className='flex-1 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl mb-4 flex items-center justify-center'>
                <Sparkles className='w-12 h-12 text-primary/60' />
              </div>
              <div className='space-y-2'>
                <div className='h-3 bg-foreground/10 rounded-full w-3/4'></div>
                <div className='h-3 bg-foreground/10 rounded-full w-1/2'></div>
              </div>
              <div className='flex justify-center gap-4 mt-4'>
                <div className='w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center'>
                  <span className='text-destructive text-xl'>×</span>
                </div>
                <div className='w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center'>
                  <Heart className='w-6 h-6 text-primary fill-current' />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='px-6 pb-8 space-y-3'>
        <Button
          onClick={onGetStarted}
          size='lg'
          className='w-full h-14 text-lg font-semibold rounded-2xl'
        >
          Connect Wallet & Get Started
        </Button>
        
        <div className='text-center'>
          <p className='text-xs text-muted-foreground'>
            Secure authentication with your Solana wallet
            <br />
            No email or password required
          </p>
        </div>
      </div>
    </div>
  );
}
