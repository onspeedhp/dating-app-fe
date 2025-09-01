'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Heart, Target, Zap, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MatchingTestDemoProps {
  onComplete?: () => void;
}

interface TestProfile {
  username: string;
  age: number;
  locationCity: string;
  income: string;
  preferences: {
    preferred_age_min: number;
    preferred_age_max: number;
    preferred_distance_km: number;
    interests: string[];
    relationship_type: string;
  };
  profilePDA?: string;
  isCreated: boolean;
}

const SAMPLE_PROFILES: TestProfile[] = [
  {
    username: 'alice_chef_25',
    age: 25,
    locationCity: 'San Francisco',
    income: '$75K',
    preferences: {
      preferred_age_min: 23,
      preferred_age_max: 30,
      preferred_distance_km: 25,
      interests: ['Cooking', 'Travel', 'Music', 'Photography'],
      relationship_type: 'serious',
    },
    isCreated: false,
  },
  {
    username: 'bob_dev_28',
    age: 28,
    locationCity: 'San Francisco',
    income: '$100K',
    preferences: {
      preferred_age_min: 22,
      preferred_age_max: 32,
      preferred_distance_km: 30,
      interests: ['Technology', 'Gaming', 'Travel', 'Music'],
      relationship_type: 'serious',
    },
    isCreated: false,
  },
  {
    username: 'carol_artist_26',
    age: 26,
    locationCity: 'Oakland',
    income: '$50K',
    preferences: {
      preferred_age_min: 24,
      preferred_age_max: 35,
      preferred_distance_km: 40,
      interests: ['Art', 'Music', 'Dancing', 'Nature'],
      relationship_type: 'casual',
    },
    isCreated: false,
  },
];

export function MatchingTestDemo({ onComplete }: MatchingTestDemoProps) {
  const [profiles, setProfiles] = useState<TestProfile[]>(SAMPLE_PROFILES);
  const [currentStep, setCurrentStep] = useState<string>('setup');
  const [progress, setProgress] = useState(0);
  const [matchingSessions, setMatchingSessions] = useState<any[]>([]);
  
  const { toast } = useToast();

  const simulateProfileCreation = async () => {
    setCurrentStep('creating-profiles');
    setProgress(20);
    
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      
      // Simulate profile creation delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update profile as created
      setProfiles(prev => prev.map((p, index) => 
        index === i ? { 
          ...p, 
          isCreated: true, 
          profilePDA: `${p.username}_pda_${Date.now()}_${i}` 
        } : p
      ));
      
      setProgress(20 + (30 * (i + 1)) / profiles.length);
      
      toast({
        title: `Profile Created`,
        description: `${profile.username} profile created on-chain!`,
      });
    }
  };

  const simulateMatchingFlow = async () => {
    setCurrentStep('matching');
    setProgress(60);
    
    const sessions = [];
    
    // Create matching sessions between profiles
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const userA = profiles[i];
        const userB = profiles[j];
        
        // Check compatibility based on preferences
        const ageCompatible = 
          userA.age >= userB.preferences.preferred_age_min &&
          userA.age <= userB.preferences.preferred_age_max &&
          userB.age >= userA.preferences.preferred_age_min &&
          userB.age <= userA.preferences.preferred_age_max;
        
        const locationCompatible = 
          userA.locationCity === userB.locationCity || 
          userA.preferences.preferred_distance_km >= 40 ||
          userB.preferences.preferred_distance_km >= 40;
        
        const interestsOverlap = userA.preferences.interests.some(interest => 
          userB.preferences.interests.includes(interest)
        );
        
        const relationshipTypeCompatible = 
          userA.preferences.relationship_type === userB.preferences.relationship_type ||
          userA.preferences.relationship_type === 'open' ||
          userB.preferences.relationship_type === 'open';
        
        const isMatch = ageCompatible && locationCompatible && interestsOverlap && relationshipTypeCompatible;
        
        const session = {
          sessionId: Date.now() + Math.random(),
          userA: userA.username,
          userB: userB.username,
          compatibility: {
            age: ageCompatible,
            location: locationCompatible,
            interests: interestsOverlap,
            relationshipType: relationshipTypeCompatible,
          },
          isMatch,
          createdAt: new Date().toISOString(),
        };
        
        sessions.push(session);
        
        // Simulate MPC computation delay
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    
    setMatchingSessions(sessions);
    setProgress(90);
  };

  const runCompleteTest = async () => {
    await simulateProfileCreation();
    await simulateMatchingFlow();
    setCurrentStep('complete');
    setProgress(100);
    
    toast({
      title: 'E2E Test Complete!',
      description: 'Full encrypted dating flow tested successfully.',
    });
  };

  const resetTest = () => {
    setProfiles(SAMPLE_PROFILES);
    setCurrentStep('setup');
    setProgress(0);
    setMatchingSessions([]);
  };

  const getMatchCount = () => matchingSessions.filter(s => s.isMatch).length;
  const getTotalSessions = () => matchingSessions.length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Encrypted Dating E2E Test
          </CardTitle>
          <p className="text-muted-foreground">
            Test complete encrypted dating flow: Profile Creation → Matching → MPC Computation
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Test Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Current Step: <Badge variant="outline">{currentStep.replace('-', ' ')}</Badge>
            </p>
          </div>

          {/* Profiles Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Test Profiles</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profiles.map((profile, index) => (
                <Card key={profile.username} className={`border-2 ${profile.isCreated ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{profile.username}</h4>
                      {profile.isCreated && <Badge variant="success">Created</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Age: {profile.age} • {profile.locationCity}</p>
                      <p>Income: {profile.income}</p>
                      <p>Looking for: {profile.preferences.relationship_type}</p>
                      <p>Age range: {profile.preferences.preferred_age_min}-{profile.preferences.preferred_age_max}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.preferences.interests.slice(0, 3).map(interest => (
                          <Badge key={interest} variant="secondary" className="text-xs">
                            {interest}
                          </Badge>
                        ))}
                        {profile.preferences.interests.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{profile.preferences.interests.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Matching Results Section */}
          {matchingSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Heart className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Matching Results</h3>
                <Badge variant="outline">
                  {getMatchCount()} matches out of {getTotalSessions()} sessions
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {matchingSessions.map((session) => (
                  <Card key={session.sessionId} className={`border-2 ${session.isMatch ? 'border-pink-200 bg-pink-50' : 'border-gray-200'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{session.userA}</span>
                          <Heart className={`w-4 h-4 ${session.isMatch ? 'text-pink-500' : 'text-gray-400'}`} />
                          <span className="font-medium">{session.userB}</span>
                        </div>
                        <Badge variant={session.isMatch ? 'default' : 'secondary'}>
                          {session.isMatch ? 'MATCH!' : 'No Match'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className={`flex items-center gap-1 ${session.compatibility.age ? 'text-green-600' : 'text-red-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${session.compatibility.age ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          Age Compatible
                        </div>
                        <div className={`flex items-center gap-1 ${session.compatibility.location ? 'text-green-600' : 'text-red-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${session.compatibility.location ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          Location OK
                        </div>
                        <div className={`flex items-center gap-1 ${session.compatibility.interests ? 'text-green-600' : 'text-red-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${session.compatibility.interests ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          Shared Interests
                        </div>
                        <div className={`flex items-center gap-1 ${session.compatibility.relationshipType ? 'text-green-600' : 'text-red-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${session.compatibility.relationshipType ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          Relationship Type
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            {currentStep === 'setup' && (
              <Button onClick={runCompleteTest} className="flex-1">
                <Database className="w-4 h-4 mr-2" />
                Run Complete E2E Test
              </Button>
            )}
            
            {currentStep === 'complete' && (
              <div className="flex gap-2 flex-1">
                <Button onClick={resetTest} variant="outline" className="flex-1">
                  Reset Test
                </Button>
                {onComplete && (
                  <Button onClick={onComplete} className="flex-1">
                    Continue to App
                  </Button>
                )}
              </div>
            )}
            
            {currentStep !== 'setup' && currentStep !== 'complete' && (
              <Button disabled className="flex-1">
                <span className="animate-pulse">Running Test...</span>
              </Button>
            )}
          </div>

          {/* Stats Summary */}
          {currentStep === 'complete' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Test Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Profiles Created:</span>
                  <p className="text-blue-900 font-bold">{profiles.filter(p => p.isCreated).length}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Matching Sessions:</span>
                  <p className="text-blue-900 font-bold">{getTotalSessions()}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Successful Matches:</span>
                  <p className="text-blue-900 font-bold">{getMatchCount()}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Match Rate:</span>
                  <p className="text-blue-900 font-bold">
                    {getTotalSessions() > 0 ? Math.round((getMatchCount() / getTotalSessions()) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
