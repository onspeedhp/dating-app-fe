'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  ArrowRight,
  X,
  Camera,
  User,
  Briefcase,
  Heart,
  ImageIcon,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Interest options for profile creation
const interestOptions = [
  'hiking', 'coffee', 'photography', 'travel', 'yoga', 'music', 'cooking',
  'concerts', 'guitar', 'craft beer', 'art', 'painting', 'farmers markets',
  'vintage shopping', 'indie films', 'rock climbing', 'camping', 'fitness',
  'adventure sports', 'reading', 'dancing', 'wine tasting', 'board games',
  'cycling', 'surfing', 'meditation', 'volunteering'
];
import { useContract } from '@/hooks/use-contract';
import { 
  generatePrivateProfileData, 
  generateMatchingPreferences, 
  convertProfileDataForBlockchain,
  generateEncryptionKey,
  validateProfileData 
} from '@/lib/profile-utils';
import { ProfileCreationStatus, ProfileCreationStep } from './profile-creation-status';

interface OnboardingFlowProps {
  onComplete: (profileData: any) => void;
  user: any;
}

interface ProfileData {
  name: string;
  age: string;
  city: string;
  workTitle: string;
  company: string;
  school: string;
  bio: string;
  interests: string[];
  habits: {
    smoking: boolean;
    drinking: boolean;
  };
  photos: string[];
}

const STEPS = [
  { id: 1, title: 'Basic Info', icon: User },
  { id: 2, title: 'Work & Study', icon: Briefcase },
  { id: 3, title: 'About You', icon: Heart },
  { id: 4, title: 'Interests', icon: Heart },
  { id: 5, title: 'Lifestyle', icon: Heart },
  { id: 6, title: 'Photos', icon: ImageIcon },
];

export function OnboardingFlow({ onComplete, user }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    age: '',
    city: '',
    workTitle: '',
    company: '',
    school: '',
    bio: '',
    interests: [],
    habits: {
      smoking: false,
      drinking: false,
    },
    photos: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [creationSteps, setCreationSteps] = useState<ProfileCreationStep[]>([]);
  const [transactionSignature, setTransactionSignature] = useState<string>('');
  const { toast } = useToast();
  const { createProfile, isConnected } = useContract();

  const updateProfileData = (updates: Partial<ProfileData>) => {
    setProfileData((prev) => ({ ...prev, ...updates }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!profileData.name.trim()) newErrors.name = 'Name is required';
        if (!profileData.age) newErrors.age = 'Age is required';
        else if (Number.parseInt(profileData.age) < 18)
          newErrors.age = 'You must be 18 or older';
        else if (Number.parseInt(profileData.age) > 100)
          newErrors.age = 'Please enter a valid age';
        if (!profileData.city.trim()) newErrors.city = 'City is required';
        break;
      case 2:
        if (!profileData.workTitle.trim())
          newErrors.workTitle = 'Job title or field of study is required';
        break;
      case 3:
        if (!profileData.bio.trim()) newErrors.bio = 'Bio is required';
        else if (profileData.bio.length > 160)
          newErrors.bio = 'Bio must be 160 characters or less';
        break;
      case 4:
        if (profileData.interests.length === 0)
          newErrors.interests = 'Please select at least one interest';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const updateCreationStep = (stepId: string, updates: Partial<ProfileCreationStep>) => {
    setCreationSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  const initializeCreationSteps = () => {
    const steps: ProfileCreationStep[] = [
      {
        id: 'validation',
        title: 'Validating Profile Data',
        description: 'Checking profile information and requirements',
        status: 'processing',
      },
      {
        id: 'encryption',
        title: 'Generating Encryption Keys',
        description: 'Creating secure encryption for your private data',
        status: 'pending',
      },
      {
        id: 'blockchain',
        title: 'Creating On-Chain Profile',
        description: 'Submitting your profile to the blockchain',
        status: 'pending',
      },
      {
        id: 'confirmation',
        title: 'Confirming Transaction',
        description: 'Waiting for blockchain confirmation',
        status: 'pending',
      },
    ];
    setCreationSteps(steps);
  };

  const handleComplete = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    // Check if wallet is connected
    if (!isConnected) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet to create a profile.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingProfile(true);
    initializeCreationSteps();

    try {
      // Step 1: Validate profile data
      updateCreationStep('validation', { status: 'processing' });
      
      const validationErrors = validateProfileData(profileData);
      if (validationErrors.length > 0) {
        updateCreationStep('validation', { 
          status: 'error', 
          errorMessage: validationErrors[0] 
        });
        toast({
          title: 'Validation Error',
          description: validationErrors[0],
          variant: 'destructive',
        });
        return;
      }

      updateCreationStep('validation', { status: 'completed' });

      // Step 2: Generate encryption keys
      updateCreationStep('encryption', { status: 'processing' });
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX

      const encryptionKey = generateEncryptionKey();

      // Generate private data and preferences
      const privateData = generatePrivateProfileData(
        profileData.name,
        parseInt(profileData.age),
        profileData.habits
      );

      const preferences = generateMatchingPreferences(
        parseInt(profileData.age),
        profileData.interests
      );

      // Convert to blockchain format
      const blockchainData = convertProfileDataForBlockchain(
        profileData,
        privateData,
        preferences,
        encryptionKey
      );

      updateCreationStep('encryption', { status: 'completed' });

      // Step 3: Create profile on blockchain
      updateCreationStep('blockchain', { status: 'processing' });

      const result = await createProfile(blockchainData);
      
      updateCreationStep('blockchain', { status: 'completed' });

      // Step 4: Confirm transaction
      updateCreationStep('confirmation', { status: 'processing' });
      setTransactionSignature(result.signature);

      // Small delay to show the confirmation step
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateCreationStep('confirmation', { status: 'completed' });

      toast({
        title: 'Profile Created Successfully!',
        description: `Your profile has been created on-chain. Welcome to Violet!`,
      });

      // Store encryption key locally for future use
      localStorage.setItem('profileEncryptionKey', Array.from(encryptionKey).join(','));

      // Auto-complete after a brief delay
      setTimeout(() => {
        onComplete({
          ...profileData,
          signature: result.signature,
          profilePDA: result.profilePDA.toBase58(),
          encryptionKey: Array.from(encryptionKey),
        });
      }, 2000);

    } catch (error: any) {
      // Profile creation failed - error will be shown to user
      
      // Update the current processing step to error
      const currentProcessingStep = creationSteps.find(step => step.status === 'processing');
      if (currentProcessingStep) {
        updateCreationStep(currentProcessingStep.id, { 
          status: 'error', 
          errorMessage: error.message || 'An unexpected error occurred' 
        });
      }

      toast({
        title: 'Profile Creation Failed',
        description: error.message || 'Failed to create profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRetryCreation = () => {
    setIsCreatingProfile(false);
    setCreationSteps([]);
    setTransactionSignature('');
  };

  const toggleInterest = (interest: string) => {
    const newInterests = profileData.interests.includes(interest)
      ? profileData.interests.filter((i) => i !== interest)
      : [...profileData.interests, interest];
    updateProfileData({ interests: newInterests });
  };

  const addPhoto = () => {
    if (profileData.photos.length < 6) {
      const newPhotos = [
        ...profileData.photos,
        `/placeholder.svg?height=400&width=300&query=profile photo ${
          profileData.photos.length + 1
        }`,
      ];
      updateProfileData({ photos: newPhotos });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = profileData.photos.filter((_, i) => i !== index);
    updateProfileData({ photos: newPhotos });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className='space-y-6'>
            <div className='text-center mb-6'>
              <User className='w-12 h-12 text-primary mx-auto mb-4' />
              <h2 className='text-2xl font-bold'>Let's get to know you</h2>
              <p className='text-muted-foreground'>
                Tell us a bit about yourself
              </p>
            </div>

            <div className='space-y-4'>
              <div>
                <Label htmlFor='name'>What's your name?</Label>
                <Input
                  id='name'
                  value={profileData.name}
                  onChange={(e) => updateProfileData({ name: e.target.value })}
                  placeholder='Enter your first name'
                  className='h-12 rounded-xl'
                />
                {errors.name && (
                  <p className='text-sm text-destructive mt-1'>{errors.name}</p>
                )}
              </div>

              <div>
                <Label htmlFor='age'>How old are you?</Label>
                <Input
                  id='age'
                  type='number'
                  value={profileData.age}
                  onChange={(e) => updateProfileData({ age: e.target.value })}
                  placeholder='Enter your age'
                  className='h-12 rounded-xl'
                  min='18'
                  max='100'
                />
                {errors.age && (
                  <p className='text-sm text-destructive mt-1'>{errors.age}</p>
                )}
              </div>

              <div>
                <Label htmlFor='city'>Where are you located?</Label>
                <Input
                  id='city'
                  value={profileData.city}
                  onChange={(e) => updateProfileData({ city: e.target.value })}
                  placeholder='Enter your city'
                  className='h-12 rounded-xl'
                />
                {errors.city && (
                  <p className='text-sm text-destructive mt-1'>{errors.city}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className='space-y-6'>
            <div className='text-center mb-6'>
              <Briefcase className='w-12 h-12 text-primary mx-auto mb-4' />
              <h2 className='text-2xl font-bold'>What do you do?</h2>
              <p className='text-muted-foreground'>
                Tell us about your work or studies
              </p>
            </div>

            <div className='space-y-4'>
              <div>
                <Label htmlFor='workTitle'>Job title or field of study</Label>
                <Input
                  id='workTitle'
                  value={profileData.workTitle}
                  onChange={(e) =>
                    updateProfileData({ workTitle: e.target.value })
                  }
                  placeholder='e.g., Software Engineer, Psychology Student'
                  className='h-12 rounded-xl'
                />
                {errors.workTitle && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.workTitle}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor='company'>Company or School (optional)</Label>
                <Input
                  id='company'
                  value={profileData.company || profileData.school}
                  onChange={(e) => {
                    if (
                      profileData.workTitle.toLowerCase().includes('student')
                    ) {
                      updateProfileData({
                        school: e.target.value,
                        company: '',
                      });
                    } else {
                      updateProfileData({
                        company: e.target.value,
                        school: '',
                      });
                    }
                  }}
                  placeholder='e.g., Google, Stanford University'
                  className='h-12 rounded-xl'
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className='space-y-6'>
            <div className='text-center mb-6'>
              <Heart className='w-12 h-12 text-primary mx-auto mb-4' />
              <h2 className='text-2xl font-bold'>Tell us about yourself</h2>
              <p className='text-muted-foreground'>
                Write a short bio that represents you
              </p>
            </div>

            <div>
              <Label htmlFor='bio'>Your bio</Label>
              <Textarea
                id='bio'
                value={profileData.bio}
                onChange={(e) => updateProfileData({ bio: e.target.value })}
                placeholder='I love hiking, trying new restaurants, and spending time with friends...'
                className='min-h-32 rounded-xl resize-none'
                maxLength={160}
              />
              <div className='flex justify-between items-center mt-2'>
                {errors.bio && (
                  <p className='text-sm text-destructive'>{errors.bio}</p>
                )}
                <p className='text-sm text-muted-foreground ml-auto'>
                  {profileData.bio.length}/160 characters
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className='space-y-6'>
            <div className='text-center mb-6'>
              <Heart className='w-12 h-12 text-primary mx-auto mb-4' />
              <h2 className='text-2xl font-bold'>What are you into?</h2>
              <p className='text-muted-foreground'>
                Select your interests to find better matches
              </p>
            </div>

            <div>
              <Label>Choose your interests</Label>
              {errors.interests && (
                <p className='text-sm text-destructive mt-1'>
                  {errors.interests}
                </p>
              )}
              <div className='flex flex-wrap gap-2 mt-3'>
                {interestOptions.map((interest) => (
                  <Badge
                    key={interest}
                    variant={
                      profileData.interests.includes(interest)
                        ? 'default'
                        : 'outline'
                    }
                    className='cursor-pointer px-4 py-2 rounded-full text-sm capitalize'
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                    {profileData.interests.includes(interest) && (
                      <X className='w-3 h-3 ml-2' />
                    )}
                  </Badge>
                ))}
              </div>
              <p className='text-sm text-muted-foreground mt-3'>
                Selected: {profileData.interests.length} interests
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div className='space-y-6'>
            <div className='text-center mb-6'>
              <Heart className='w-12 h-12 text-primary mx-auto mb-4' />
              <h2 className='text-2xl font-bold'>Lifestyle preferences</h2>
              <p className='text-muted-foreground'>
                Help others know your lifestyle choices
              </p>
            </div>

            <div className='space-y-6'>
              <Card className='border-0 bg-muted/30'>
                <CardContent className='p-6'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <h3 className='font-semibold'>Smoking</h3>
                      <p className='text-sm text-muted-foreground'>
                        Do you smoke?
                      </p>
                    </div>
                    <Switch
                      checked={profileData.habits.smoking}
                      onCheckedChange={(checked) =>
                        updateProfileData({
                          habits: { ...profileData.habits, smoking: checked },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className='border-0 bg-muted/30'>
                <CardContent className='p-6'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <h3 className='font-semibold'>Drinking</h3>
                      <p className='text-sm text-muted-foreground'>
                        Do you drink alcohol?
                      </p>
                    </div>
                    <Switch
                      checked={profileData.habits.drinking}
                      onCheckedChange={(checked) =>
                        updateProfileData({
                          habits: { ...profileData.habits, drinking: checked },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 6:
        return (
          <div className='space-y-6'>
            <div className='text-center mb-6'>
              <ImageIcon className='w-12 h-12 text-primary mx-auto mb-4' />
              <h2 className='text-2xl font-bold'>Add your photos</h2>
              <p className='text-muted-foreground'>
                Show your best self with up to 6 photos
              </p>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className='aspect-[3/4] relative'>
                  {profileData.photos[index] ? (
                    <div className='relative w-full h-full'>
                      <img
                        src={profileData.photos[index] || '/placeholder.svg'}
                        alt={`Photo ${index + 1}`}
                        className='w-full h-full object-cover rounded-xl'
                      />
                      <Button
                        variant='destructive'
                        size='icon'
                        className='absolute top-2 right-2 w-8 h-8 rounded-full'
                        onClick={() => removePhoto(index)}
                      >
                        <X className='w-4 h-4' />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant='outline'
                      className='w-full h-full rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40'
                      onClick={addPhoto}
                      disabled={index > 0 && !profileData.photos[index - 1]}
                    >
                      <div className='flex flex-col items-center gap-2'>
                        <Camera className='w-8 h-8 text-muted-foreground' />
                        <span className='text-sm text-muted-foreground'>
                          {index === 0 ? 'Add photo' : `Photo ${index + 1}`}
                        </span>
                      </div>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <p className='text-sm text-muted-foreground text-center'>
              {profileData.photos.length}/6 photos added
              {profileData.photos.length === 0 && ' (at least 1 recommended)'}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between p-4'>
        <Button
          variant='ghost'
          size='icon'
          onClick={handleBack}
          className='rounded-full'
          disabled={currentStep === 1}
        >
          <ArrowLeft className='w-5 h-5' />
        </Button>
        <div className='flex-1 mx-4'>
          <Progress
            value={(currentStep / STEPS.length) * 100}
            className='h-2'
          />
        </div>
        <div className='text-sm text-muted-foreground min-w-12 text-right'>
          {currentStep}/{STEPS.length}
        </div>
      </div>

      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className='px-6 py-2'>
          <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800'>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 bg-yellow-500 rounded-full'></div>
              Please connect your wallet to create a profile on-chain
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className='flex-1 px-6 py-4'>
        <Card className='border-0 shadow-none'>
          <CardContent className='p-6'>
            {isCreatingProfile ? (
              <ProfileCreationStatus
                steps={creationSteps}
                transactionSignature={transactionSignature}
                onRetry={handleRetryCreation}
                onComplete={() => {
                  onComplete({
                    ...profileData,
                    signature: transactionSignature,
                    encryptionKey: localStorage.getItem('profileEncryptionKey')?.split(',').map(Number),
                  });
                }}
              />
            ) : (
              renderStep()
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      {!isCreatingProfile && (
        <div className='p-6'>
          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              size='lg'
              className='w-full h-14 text-lg font-semibold rounded-2xl'
            >
              Continue
              <ArrowRight className='w-5 h-5 ml-2' />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              size='lg'
              className='w-full h-14 text-lg font-semibold rounded-2xl'
              disabled={!isConnected}
            >
              {!isConnected ? (
                'Connect Wallet First'
              ) : (
                <>
                  Create Profile
                  <CheckCircle className='w-5 h-5 ml-2' />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
