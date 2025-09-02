'use client';

import { useState, useEffect } from 'react';
import { LandingScreen } from '@/components/landing-screen';
import { AuthScreen } from '@/components/auth-screen';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { MainApp } from '@/components/main-app';
import { Toaster } from '@/components/ui/toaster';
import {
  getFakeUser,
  setFakeUser,
  removeFakeUser,
} from '@/lib/utils';
import { fakeUser } from '@/lib/mock-data';

type AppState = 'landing' | 'auth' | 'onboarding' | 'main';
type AuthMode = 'login' | 'signup';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<any>(null);
  const [hasFakeUserActive, setHasFakeUserActive] = useState<boolean>(false);

  // Check for fake user on mount
  useEffect(() => {
    const storedFakeUser = getFakeUser();
    if (storedFakeUser) {
      setUser(storedFakeUser);
      setAppState('main');
      setHasFakeUserActive(true);
    }
  }, []);

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setAppState('onboarding');
  };

  const handleOnboardingComplete = (profileData: any) => {
    const updatedUser = { ...user, ...profileData, onboardingComplete: true };
    setUser(updatedUser);
    setAppState('main');

    // Save to localStorage if it's a fake user
    if (hasFakeUserActive) {
      setFakeUser(updatedUser);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAppState('landing');
    // Remove fake user from localStorage
    removeFakeUser();
    setHasFakeUserActive(false);
  };

  const handleDeleteProfile = () => {
    setUser(null);
    setAppState('landing');
    // Remove fake user from localStorage
    removeFakeUser();
    setHasFakeUserActive(false);
  };

  const handleUpdateProfile = (updates: any) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);

    // Save to localStorage if it's a fake user
    if (hasFakeUserActive) {
      setFakeUser(updatedUser);
    }
  };

  // Function to enable fake user for testing
  const enableFakeUser = () => {
    setFakeUser(fakeUser);
    setUser(fakeUser);
    setAppState('main');
    setHasFakeUserActive(true);
  };

  // Function to disable fake user
  const disableFakeUser = () => {
    removeFakeUser();
    setUser(null);
    setAppState('landing');
    setHasFakeUserActive(false);
  };

  return (
    <div className='min-h-screen bg-background'>
      {appState === 'landing' && (
        <LandingScreen
          onLogin={() => {
            setAuthMode('login');
            setAppState('auth');
          }}
          onSignup={() => {
            setAuthMode('signup');
            setAppState('auth');
          }}
          onFakeUser={enableFakeUser}
          hasFakeUser={hasFakeUserActive}
        />
      )}

      {appState === 'auth' && (
        <AuthScreen
          mode={authMode}
          onSuccess={handleAuthSuccess}
          onBack={() => setAppState('landing')}
          onSwitchMode={() =>
            setAuthMode(authMode === 'login' ? 'signup' : 'login')
          }
        />
      )}

      {appState === 'onboarding' && (
        <OnboardingFlow onComplete={handleOnboardingComplete} user={user} />
      )}

      {appState === 'main' && (
        <MainApp
          user={user}
          onLogout={handleLogout}
          onDeleteProfile={handleDeleteProfile}
          onUpdateProfile={handleUpdateProfile}
          onDisableFakeUser={hasFakeUserActive ? disableFakeUser : undefined}
        />
      )}

      <Toaster />
    </div>
  );
}
