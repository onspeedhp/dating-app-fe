'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Wallet, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WalletConnectButton } from '@/components/wallet-connect-button';
import { useWalletInfo } from '@/hooks/use-wallet';
import { useContract } from '@/hooks/use-contract';

interface AuthScreenProps {
  onSuccess: (userData: any) => void;
  onBack: () => void;
}

export function AuthScreen({
  onSuccess,
  onBack,
}: AuthScreenProps) {
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [authStep, setAuthStep] = useState<'connect' | 'checking' | 'ready'>('connect');
  const { toast } = useToast();
  const { walletInfo } = useWalletInfo();
  const { hasProfile, getUserProfile } = useContract();

  // Check for profile when wallet connects
  useEffect(() => {
    const checkUserProfile = async () => {
      if (!walletInfo.isConnected || !walletInfo.address) {
        setAuthStep('connect');
        return;
      }

      setAuthStep('checking');
      setIsCheckingProfile(true);

      try {
        // Check if user has a profile
        const profileExists = await hasProfile();
        
        if (profileExists) {
          // Get the profile data
          const profileData = await getUserProfile();
          
          // User has profile, proceed to main app
          const userData = {
            id: walletInfo.address,
            walletAddress: walletInfo.address,
            name: profileData?.profile?.username || '',
            onboardingComplete: true,
            profile: profileData?.profile,
          };

          toast({
            title: 'Welcome back!',
            description: 'Successfully connected with existing profile.',
          });

          onSuccess(userData);
        } else {
          // No profile found, user needs to create one
          const userData = {
            id: walletInfo.address,
            walletAddress: walletInfo.address,
            name: '',
            onboardingComplete: false,
            profile: null,
          };

          setAuthStep('ready');
          
          toast({
            title: 'Wallet Connected!',
            description: 'Please create your profile to continue.',
          });

          onSuccess(userData);
        }
      } catch (error) {
        // Profile check failed - will show appropriate UI
        toast({
          title: 'Error',
          description: 'Failed to check profile. Please try again.',
          variant: 'destructive',
        });
        setAuthStep('connect');
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [walletInfo.isConnected, walletInfo.address, hasProfile, getUserProfile, onSuccess, toast]);

  const renderContent = () => {
    if (authStep === 'checking' || isCheckingProfile) {
      return (
        <div className='flex flex-col items-center justify-center space-y-6'>
          <div className='relative'>
            <div className='w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center'>
              <Loader2 className='w-8 h-8 text-primary animate-spin' />
            </div>
          </div>
          <div className='text-center space-y-2'>
            <h3 className='text-lg font-semibold'>Checking Profile...</h3>
            <p className='text-sm text-muted-foreground'>
              We're verifying your account details
            </p>
          </div>
        </div>
      );
    }

    if (authStep === 'ready' && walletInfo.isConnected) {
      return (
        <div className='flex flex-col items-center justify-center space-y-6'>
          <div className='relative'>
            <div className='w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center'>
              <CheckCircle className='w-8 h-8 text-green-600 dark:text-green-400' />
            </div>
          </div>
          <div className='text-center space-y-2'>
            <h3 className='text-lg font-semibold'>Wallet Connected!</h3>
            <p className='text-sm text-muted-foreground'>
              Redirecting to profile creation...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className='space-y-6'>
        <div className='text-center space-y-4'>
          <div className='w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto'>
            <Wallet className='w-8 h-8 text-primary' />
          </div>
          <div>
            <h3 className='text-lg font-semibold mb-2'>Connect Your Wallet</h3>
            <p className='text-sm text-muted-foreground'>
              Use your Solana wallet to sign in securely. No email or password required.
            </p>
          </div>
        </div>

        <WalletConnectButton
          variant="default"
          className="h-12 rounded-xl"
          fullWidth
        />

        <div className='text-center'>
          <p className='text-xs text-muted-foreground'>
            Your wallet address will be used as your unique identifier.
            <br />
            We'll check if you have an existing profile automatically.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between p-4'>
        <Button
          variant='ghost'
          size='icon'
          onClick={onBack}
          className='rounded-full'
        >
          <ArrowLeft className='w-5 h-5' />
        </Button>
        <h1 className='text-lg font-semibold'>
          Welcome to Violet
        </h1>
        <div className='w-10' />
      </div>

      {/* Content */}
      <div className='flex-1 flex items-center justify-center px-6'>
        <Card className='w-full max-w-sm border-0 shadow-none'>
          <CardHeader className='text-center pb-6'>
            <CardTitle className='text-2xl'>
              Secure Authentication
            </CardTitle>
            <CardDescription>
              Connect your wallet to get started with Violet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
