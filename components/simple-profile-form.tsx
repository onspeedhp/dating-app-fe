'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from './ui/slider';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, User, Camera, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useContract } from '@/hooks/use-contract';
import { 
  generatePrivateProfileData, 
  generateMatchingPreferences, 
  convertProfileDataForBlockchain,
  generateEncryptionKey,
  validateProfileData,
  SAMPLE_INCOMES
} from '@/lib/profile-utils';
import { ProfileCreationStatus, ProfileCreationStep } from './profile-creation-status';

interface SimpleProfileFormProps {
  onComplete: (profileData: any) => void;
}

export function SimpleProfileForm({ onComplete }: SimpleProfileFormProps) {
  // Basic form fields
  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: '',
    city: '',
  });

  // Auto-generated fields with sliders
  const [age, setAge] = useState([25]);
  const [incomeIndex, setIncomeIndex] = useState([2]); // Default to $100K
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Profile creation states
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [creationSteps, setCreationSteps] = useState<ProfileCreationStep[]>([]);
  const [transactionSignature, setTransactionSignature] = useState<string>('');
  
  const { toast } = useToast();
  const { createProfile, isConnected } = useContract();

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (formData.name.length > 32) {
      newErrors.name = 'Name must be less than 32 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, numbers and underscores';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.avatarUrl.trim()) {
      newErrors.avatarUrl = 'Avatar URL is required';
    } else {
      // Basic URL validation
      try {
        new URL(formData.avatarUrl);
      } catch {
        newErrors.avatarUrl = 'Invalid avatar URL';
      }
    }

    if (age[0] < 18 || age[0] > 99) {
      newErrors.age = 'Age must be between 18 and 99';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

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
      // Step 1: Validation
      updateCreationStep('validation', { status: 'processing' });
      await new Promise(resolve => setTimeout(resolve, 500));
      updateCreationStep('validation', { status: 'completed' });

      // Step 2: Generate encryption and data
      updateCreationStep('encryption', { status: 'processing' });
      
      const encryptionKey = generateEncryptionKey();
      
      // Generate private data with income from slider
      const privateData = generatePrivateProfileData(
        formData.name,
        age[0],
        { smoking: false, drinking: false } // Default habits
      );
      
      // Override income with selected value
      privateData.income = SAMPLE_INCOMES[incomeIndex[0]];
      
      const preferences = generateMatchingPreferences(age[0], []);
      
      // Create profile data for blockchain
      const profileForValidation = {
        name: formData.name,
        age: age[0].toString(),
        city: formData.city,
        bio: `Hello! I'm ${formData.name}, ${age[0]} years old, living in ${formData.city}.`,
        photos: [formData.avatarUrl],
      };

      const blockchainData = convertProfileDataForBlockchain(
        profileForValidation,
        privateData,
        preferences,
        encryptionKey
      );

      updateCreationStep('encryption', { status: 'completed' });

      // Step 3: Create on blockchain
      updateCreationStep('blockchain', { status: 'processing' });
      
      const result = await createProfile(blockchainData);
      
      updateCreationStep('blockchain', { status: 'completed' });

      // Step 4: Confirmation
      updateCreationStep('confirmation', { status: 'processing' });
      setTransactionSignature(result.signature);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateCreationStep('confirmation', { status: 'completed' });

      toast({
        title: 'Profile Created Successfully!',
        description: 'Welcome to Violet!',
      });

      // Store encryption key
      localStorage.setItem('profileEncryptionKey', Array.from(encryptionKey).join(','));

      // Auto-complete after delay
      setTimeout(() => {
        onComplete({
          ...formData,
          age: age[0],
          income: SAMPLE_INCOMES[incomeIndex[0]],
          signature: result.signature,
          profilePDA: result.profilePDA.toBase58(),
          encryptionKey: Array.from(encryptionKey),
        });
      }, 2000);

    } catch (error: any) {
      // Profile creation failed - showing error to user
      
      const currentProcessingStep = creationSteps.find(step => step.status === 'processing');
      if (currentProcessingStep) {
        updateCreationStep(currentProcessingStep.id, { 
          status: 'error', 
          errorMessage: error.message || 'An unexpected error occurred' 
        });
      }

      toast({
        title: 'Profile Creation Failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRetry = () => {
    setIsCreatingProfile(false);
    setCreationSteps([]);
    setTransactionSignature('');
  };

  if (isCreatingProfile) {
    return (
      <div className="max-w-md mx-auto p-6">
        <ProfileCreationStatus
          steps={creationSteps}
          transactionSignature={transactionSignature}
          onRetry={handleRetry}
          onComplete={() => {
            onComplete({
              ...formData,
              age: age[0],
              income: SAMPLE_INCOMES[incomeIndex[0]],
              signature: transactionSignature,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Profile</CardTitle>
          <p className="text-muted-foreground">
            Enter basic information to create your onchain profile
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Your Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="e.g. Alice"
                className="mt-2"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="avatarUrl" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Avatar Image URL
              </Label>
              <Input
                id="avatarUrl"
                value={formData.avatarUrl}
                onChange={(e) => updateFormData('avatarUrl', e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="mt-2"
              />
              {errors.avatarUrl && (
                <p className="text-sm text-destructive mt-1">{errors.avatarUrl}</p>
              )}
            </div>

            <div>
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                City
              </Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateFormData('city', e.target.value)}
                placeholder="e.g. San Francisco"
                className="mt-2"
              />
              {errors.city && (
                <p className="text-sm text-destructive mt-1">{errors.city}</p>
              )}
            </div>
          </div>

          {/* Auto-generated fields with sliders */}
          <div className="space-y-6 pt-6 border-t">
            <h3 className="font-medium text-sm text-muted-foreground">
              Auto-generated Information
            </h3>
            
            <div>
              <Label className="text-sm font-medium">
                Age: <Badge variant="outline">{age[0]} years old</Badge>
              </Label>
              <Slider
                value={age}
                onValueChange={setAge}
                max={99}
                min={18}
                step={1}
                className="mt-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>18</span>
                <span>99</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Income: <Badge variant="outline">{SAMPLE_INCOMES[incomeIndex[0]]}</Badge>
              </Label>
              <Slider
                value={incomeIndex}
                onValueChange={setIncomeIndex}
                max={SAMPLE_INCOMES.length - 1}
                min={0}
                step={1}
                className="mt-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{SAMPLE_INCOMES[0]}</span>
                <span>{SAMPLE_INCOMES[SAMPLE_INCOMES.length - 1]}</span>
              </div>
            </div>
          </div>

          {/* Wallet connection status */}
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Please connect your wallet to create an onchain profile
              </div>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!isConnected}
            className="w-full h-12 text-base font-semibold"
          >
            {!isConnected ? (
              'Connect Wallet First'
            ) : (
              <>
                Create Onchain Profile
                <CheckCircle className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
