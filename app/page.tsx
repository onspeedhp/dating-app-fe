'use client';

import { useState } from 'react';
import { LandingScreen } from '@/components/landing-screen';
import { AuthScreen } from '@/components/auth-screen';
import { ComprehensiveProfileForm } from '@/components/comprehensive-profile-form';
import { MainApp } from '@/components/main-app';
import { Toaster } from '@/components/ui/toaster';

type AppState = 'landing' | 'auth' | 'onboarding' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [user, setUser] = useState<any>(null);

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    // If user has onboardingComplete true, go to main app, otherwise go to onboarding
    if (userData.onboardingComplete) {
      setAppState('main');
    } else {
      setAppState('onboarding');
    }
  };

  const handleOnboardingComplete = (profileData: any) => {
    const updatedUser = { ...user, ...profileData, onboardingComplete: true };
    setUser(updatedUser);
    setAppState('main');
  };

  const handleLogout = () => {
    setUser(null);
    setAppState('landing');
  };

  const handleDeleteProfile = () => {
    setUser(null);
    setAppState('landing');
  };

  const handleUpdateProfile = (updates: any) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
  };

  return (
    <div className='min-h-screen bg-background'>
      {appState === 'landing' && (
        <LandingScreen
          onGetStarted={() => setAppState('auth')}
        />
      )}

      {appState === 'auth' && (
        <AuthScreen
          onSuccess={handleAuthSuccess}
          onBack={() => setAppState('landing')}
        />
      )}

      {appState === 'onboarding' && (
        <ComprehensiveProfileForm onComplete={handleOnboardingComplete} />
      )}

      {appState === 'main' && (
        <MainApp
          user={user}
          onLogout={handleLogout}
          onDeleteProfile={handleDeleteProfile}
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      <Toaster />
    </div>
  );
}
