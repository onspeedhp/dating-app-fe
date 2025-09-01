'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from './ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, User, Camera, MapPin, Heart, Target, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useContract } from '@/hooks/use-contract';
import { 
  generatePrivateProfileData,
  generateMatchingPreferences,
  convertProfileDataForBlockchain,
  generateEncryptionKey,
  validateProfileData
} from '@/lib/profile-utils';
import { decryptProfileData } from '@/lib/decrypt-utils';
import { ProfileCreationStatus, ProfileCreationStep } from './profile-creation-status';

interface FormData {
  // Required fields for CreateProfileData
  username: string;
  avatarUrl: string;
  age: number;
  locationCity: string;
  
  // Private data (encrypted)
  income: string;
  
  // Matching preferences (encrypted) 
  preferredAgeMin: number;
  preferredAgeMax: number;
  preferredDistanceKm: number;
  interests: string[];
  relationshipType: string;
  
  // Additional preferences
  lookingForSeriousRelationship: boolean;
  openToLongDistance: boolean;
}

interface ComprehensiveProfileFormProps {
  onComplete: (data: any) => void;
}

// Sample data based on contract types
const INCOME_OPTIONS = ["$30K", "$40K", "$50K", "$60K", "$75K", "$100K", "$125K", "$150K", "$200K+"] as const;
const RELATIONSHIP_TYPES = ["casual", "serious", "friendship", "networking", "open"] as const;
const INTERESTS_OPTIONS = [
  "Music", "Travel", "Sports", "Technology", "Art", "Food", "Books", "Movies",
  "Photography", "Fitness", "Gaming", "Dancing", "Cooking", "Nature", "Fashion",
  "Business", "Science", "History", "Politics", "Meditation", "Yoga", "Volunteering"
] as const;

export function ComprehensiveProfileForm({ onComplete }: ComprehensiveProfileFormProps) {
  const [formData, setFormData] = useState<FormData>({
    // Required fields
    username: '',
    avatarUrl: '',
    age: 25,
    locationCity: '',
    
    // Private data
    income: INCOME_OPTIONS[2], // Default to $50K
    
    // Matching preferences  
    preferredAgeMin: 22,
    preferredAgeMax: 32,
    preferredDistanceKm: 25,
    interests: [],
    relationshipType: 'serious',
    
    // Additional preferences
    lookingForSeriousRelationship: true,
    openToLongDistance: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [creationSteps, setCreationSteps] = useState<ProfileCreationStep[]>([]);
  const [transactionSignature, setTransactionSignature] = useState('');
  const [profileExists, setProfileExists] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [decryptedData, setDecryptedData] = useState<any>(null);
  
  const { toast } = useToast();
  const { createProfile, isConnected, hasProfile, getUserProfile } = useContract();

  // Check if profile exists when wallet connects
  useEffect(() => {
    async function checkExistingProfile() {
      if (isConnected) {
        setCheckingProfile(true);
        try {
          const exists = await hasProfile();
          setProfileExists(exists);
          
          if (exists) {
            // Fetch existing profile data
            const profileData = await getUserProfile();
            if (profileData) {
              setExistingProfile(profileData.profile);
              
              // Try to decrypt private data
              const decrypted = decryptProfileData(profileData.profile);
              setDecryptedData(decrypted);
              
              // Populate form with existing data
              const updatedFormData = {
                username: profileData.profile.username || formData.username,
                avatarUrl: profileData.profile.avatarUrl || formData.avatarUrl,
                age: profileData.profile.age || formData.age,
                locationCity: profileData.profile.locationCity || formData.locationCity,
                
                // From decrypted private data (with type safety)
                income: INCOME_OPTIONS.includes(decrypted.privateData?.income as any) 
                  ? decrypted.privateData.income 
                  : formData.income,
                
                // From decrypted preferences
                preferredAgeMin: decrypted.preferences?.preferred_age_min || formData.preferredAgeMin,
                preferredAgeMax: decrypted.preferences?.preferred_age_max || formData.preferredAgeMax,
                preferredDistanceKm: decrypted.preferences?.preferred_distance_km || formData.preferredDistanceKm,
                interests: decrypted.preferences?.interests || formData.interests,
                relationshipType: decrypted.preferences?.relationship_type || formData.relationshipType,
                
                // Keep existing additional preferences
                lookingForSeriousRelationship: formData.lookingForSeriousRelationship,
                openToLongDistance: formData.openToLongDistance,
              };
              
              setFormData(updatedFormData);
              
              if (decrypted.error) {
                toast({
                  title: 'Profile Found',
                  description: `Profile loaded but private data couldn't be decrypted: ${decrypted.error}`,
                  variant: 'destructive',
                });
              } else {
                toast({
                  title: 'Profile Found & Decrypted',
                  description: 'Your existing profile and private data have been loaded successfully.',
                });
              }
            }
          }
        } catch (error) {
          // Profile check failed - will show in UI
          toast({
            title: 'Error',
            description: 'Failed to check existing profile',
            variant: 'destructive',
          });
        } finally {
          setCheckingProfile(false);
        }
      } else {
        setProfileExists(false);
        setExistingProfile(null);
      }
    }

    checkExistingProfile();
  }, [isConnected, hasProfile, getUserProfile, toast]);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts fixing it
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate username (based on contract validation)
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username too short (minimum 3 characters)';
    } else if (formData.username.length > 32) {
      newErrors.username = 'Username too long (maximum 32 characters)';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers and underscores';
    }

    // Validate avatar URL
    if (!formData.avatarUrl.trim()) {
      newErrors.avatarUrl = 'Avatar URL is required';
    } else {
      try {
        new URL(formData.avatarUrl);
      } catch {
        newErrors.avatarUrl = 'Invalid avatar URL';
      }
    }

    // Validate age (18-99 as per contract)
    if (formData.age < 18 || formData.age > 99) {
      newErrors.age = 'Age must be between 18-99';
    }

    // Validate location
    if (!formData.locationCity.trim()) {
      newErrors.locationCity = 'Location city is required';
    }

    // Validate matching preferences
    if (formData.preferredAgeMin < 18) {
      newErrors.preferredAgeMin = 'Minimum preferred age must be at least 18';
    }
    if (formData.preferredAgeMax > 99) {
      newErrors.preferredAgeMax = 'Maximum preferred age cannot exceed 99';
    }
    if (formData.preferredAgeMin >= formData.preferredAgeMax) {
      newErrors.preferredAgeRange = 'Minimum age must be less than maximum age';
    }

    if (formData.preferredDistanceKm < 1) {
      newErrors.preferredDistanceKm = 'Distance preference must be at least 1 km';
    }

    if (formData.interests.length === 0) {
      newErrors.interests = 'Please select at least one interest';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleInterest = (interest: string) => {
    const current = formData.interests;
    if (current.includes(interest)) {
      updateFormData('interests', current.filter(i => i !== interest));
    } else {
      updateFormData('interests', [...current, interest]);
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
        description: 'Checking all profile information and matching preferences',
        status: 'processing',
      },
      {
        id: 'encryption',
        title: 'Generating Encryption Keys',
        description: 'Creating secure encryption for private data and preferences',
        status: 'pending',
      },
      {
        id: 'blockchain',
        title: 'Creating On-Chain Profile',
        description: 'Submitting your complete profile to the blockchain',
        status: 'pending',
      },
      {
        id: 'confirmation',
        title: 'Confirming Transaction',
        description: 'Waiting for blockchain confirmation and finalizing',
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateCreationStep('validation', { status: 'completed' });
      updateCreationStep('encryption', { status: 'processing' });

      // Step 2: Generate encryption and data structures
      const encryptionKey = generateEncryptionKey();
      
      // Create private data exactly matching contract struct
      const privateData = {
        income: formData.income
      };

      // Create matching preferences exactly matching contract struct  
      const preferences = {
        preferred_age_min: formData.preferredAgeMin,
        preferred_age_max: formData.preferredAgeMax,
        preferred_distance_km: formData.preferredDistanceKm,
        interests: formData.interests,
        relationship_type: formData.relationshipType,
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      updateCreationStep('encryption', { status: 'completed' });
      updateCreationStep('blockchain', { status: 'processing' });

      // Step 3: Create blockchain data exactly matching CreateProfileData struct
      const profileForBlockchain = {
        name: formData.username,
        age: formData.age.toString(),
        city: formData.locationCity,
        bio: `Hello! I'm ${formData.username}, ${formData.age} years old, living in ${formData.locationCity}. Looking for ${formData.relationshipType} connections.`,
        photos: [formData.avatarUrl],
      };

      const blockchainData = convertProfileDataForBlockchain(
        profileForBlockchain,
        privateData,
        preferences,
        encryptionKey
      );

      // Call smart contract createProfile function
      const result = await createProfile(blockchainData);
      
      updateCreationStep('blockchain', { status: 'completed' });
      updateCreationStep('confirmation', { status: 'processing' });
      setTransactionSignature(result.signature);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateCreationStep('confirmation', { status: 'completed' });

      toast({
        title: 'Profile Created Successfully!',
        description: 'Your dating profile with matching preferences is now live on-chain!',
      });

      // Store encryption key for future matching operations
      localStorage.setItem('profileEncryptionKey', Array.from(encryptionKey).join(','));
      localStorage.setItem('profilePreferences', JSON.stringify(preferences));
      localStorage.setItem('profilePrivateData', JSON.stringify(privateData));

      // Auto-complete after delay
      setTimeout(() => {
        onComplete({
          ...formData,
          signature: result.signature,
          encryptionKey: Array.from(encryptionKey),
          profilePDA: result.profilePDA.toString(),
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
        description: error.message || 'Please check your data and try again.',
        variant: 'destructive',
      });
    } finally {
      if (!creationSteps.some(step => step.status === 'error')) {
        // Only reset if no errors
        // setIsCreatingProfile(false);
      }
    }
  };

  const handleRetry = () => {
    setIsCreatingProfile(false);
    setCreationSteps([]);
    setTransactionSignature('');
  };

  if (isCreatingProfile) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <ProfileCreationStatus
          steps={creationSteps}
          transactionSignature={transactionSignature}
          onRetry={handleRetry}
          onComplete={() => {
            onComplete({
              ...formData,
              signature: transactionSignature,
              encryptionKey: localStorage.getItem('profileEncryptionKey')?.split(',').map(Number),
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Create Dating Profile</CardTitle>
          <p className="text-muted-foreground">
            Complete your profile with matching preferences for encrypted on-chain dating
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* Existing Profile Info */}
          {profileExists && existingProfile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900">Existing Profile Found</h4>
                  <div className="text-sm text-blue-800 mt-1">
                    <p><strong>Username:</strong> {existingProfile.username}</p>
                    <p><strong>Age:</strong> {existingProfile.age} years old</p>
                    <p><strong>Location:</strong> {existingProfile.locationCity}</p>
                    <p><strong>Created:</strong> {new Date(existingProfile.createdAt.toNumber() * 1000).toLocaleDateString()}</p>
                    <p><strong>Profile PDA:</strong> <code className="text-xs bg-blue-200 px-1 rounded">{existingProfile.profilePda?.toString().slice(0, 20)}...</code></p>
                    
                    {/* Decrypted Private Data */}
                    {decryptedData && !decryptedData.error && (
                      <div className="mt-3 pt-2 border-t border-blue-300">
                        <p className="text-xs font-medium text-blue-900 mb-1">🔓 Decrypted Private Data:</p>
                        {decryptedData.privateData && (
                          <p className="text-xs"><strong>Income:</strong> {decryptedData.privateData.income}</p>
                        )}
                        {decryptedData.preferences && (
                          <div className="text-xs space-y-1">
                            <p><strong>Age Range:</strong> {decryptedData.preferences.preferred_age_min}-{decryptedData.preferences.preferred_age_max}</p>
                            <p><strong>Distance:</strong> {decryptedData.preferences.preferred_distance_km} km</p>
                            <p><strong>Relationship Type:</strong> {decryptedData.preferences.relationship_type}</p>
                            <p><strong>Interests:</strong> {decryptedData.preferences.interests?.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {decryptedData && decryptedData.error && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                        <strong>Decryption Error:</strong> {decryptedData.error}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    Your form has been pre-filled with existing data. You can update it or continue with current values.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading Profile Check */}
          {checkingProfile && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                <span className="text-sm text-gray-700">Checking for existing profile...</span>
              </div>
            </div>
          )}
          
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <User className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Basic Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username" className="flex items-center gap-2">
                  Username *
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => updateFormData('username', e.target.value)}
                  placeholder="e.g. alice_chef_25"
                  className="mt-2"
                />
                {errors.username && (
                  <p className="text-sm text-destructive mt-1">{errors.username}</p>
                )}
              </div>

              <div>
                <Label htmlFor="age" className="flex items-center gap-2">
                  Age: <Badge variant="outline">{formData.age} years old</Badge>
                </Label>
                <Slider
                  value={[formData.age]}
                  onValueChange={(value) => updateFormData('age', value[0])}
                  max={99}
                  min={18}
                  step={1}
                  className="mt-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>18</span>
                  <span>99</span>
                </div>
                {errors.age && (
                  <p className="text-sm text-destructive mt-1">{errors.age}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="avatarUrl" className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Avatar Image URL *
              </Label>
              <Input
                id="avatarUrl"
                value={formData.avatarUrl}
                onChange={(e) => updateFormData('avatarUrl', e.target.value)}
                placeholder="https://example.com/your-photo.jpg"
                className="mt-2"
              />
              {errors.avatarUrl && (
                <p className="text-sm text-destructive mt-1">{errors.avatarUrl}</p>
              )}
            </div>

            <div>
              <Label htmlFor="locationCity" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                City *
              </Label>
              <Input
                id="locationCity"
                value={formData.locationCity}
                onChange={(e) => updateFormData('locationCity', e.target.value)}
                placeholder="e.g. San Francisco"
                className="mt-2"
              />
              {errors.locationCity && (
                <p className="text-sm text-destructive mt-1">{errors.locationCity}</p>
              )}
            </div>
          </div>

          {/* SECTION 2: PRIVATE INFORMATION (ENCRYPTED) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Settings className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Private Information</h3>
              <Badge variant="secondary" className="text-xs">Encrypted</Badge>
            </div>
            
            <div>
              <Label className="text-sm font-medium">
                Income Level: <Badge variant="outline">{formData.income}</Badge>
              </Label>
              <Slider
                value={[Math.max(0, INCOME_OPTIONS.indexOf(formData.income as any))]}
                onValueChange={(value) => updateFormData('income', INCOME_OPTIONS[value[0]])}
                max={INCOME_OPTIONS.length - 1}
                min={0}
                step={1}
                className="mt-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{INCOME_OPTIONS[0]}</span>
                <span>{INCOME_OPTIONS[INCOME_OPTIONS.length - 1]}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: MATCHING PREFERENCES (ENCRYPTED) */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
              <Heart className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Matching Preferences</h3>
              <Badge variant="secondary" className="text-xs">Encrypted</Badge>
            </div>

            {/* Age Preference Range */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                Preferred Age Range: <Badge variant="outline">{formData.preferredAgeMin} - {formData.preferredAgeMax} years</Badge>
              </Label>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Minimum Age</Label>
                  <Slider
                    value={[formData.preferredAgeMin]}
                    onValueChange={(value) => updateFormData('preferredAgeMin', value[0])}
                    max={formData.preferredAgeMax - 1}
                    min={18}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Maximum Age</Label>
                  <Slider
                    value={[formData.preferredAgeMax]}
                    onValueChange={(value) => updateFormData('preferredAgeMax', value[0])}
                    max={99}
                    min={formData.preferredAgeMin + 1}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>
              {errors.preferredAgeRange && (
                <p className="text-sm text-destructive">{errors.preferredAgeRange}</p>
              )}
            </div>

            {/* Distance Preference */}
            <div>
              <Label className="text-sm font-medium">
                Preferred Distance: <Badge variant="outline">{formData.preferredDistanceKm} km</Badge>
              </Label>
              <Slider
                value={[formData.preferredDistanceKm]}
                onValueChange={(value) => updateFormData('preferredDistanceKm', value[0])}
                max={500}
                min={1}
                step={5}
                className="mt-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 km</span>
                <span>500 km</span>
              </div>
            </div>

            {/* Relationship Type */}
            <div>
              <Label className="text-sm font-medium">Relationship Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {RELATIONSHIP_TYPES.map((type) => (
                  <Button
                    key={type}
                    variant={formData.relationshipType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateFormData('relationshipType', type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <Label className="text-sm font-medium">
                Interests ({formData.interests.length} selected)
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-48 overflow-y-auto">
                {INTERESTS_OPTIONS.map((interest) => (
                  <Button
                    key={interest}
                    variant={formData.interests.includes(interest) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleInterest(interest)}
                    className="text-xs"
                  >
                    {interest}
                  </Button>
                ))}
              </div>
              {errors.interests && (
                <p className="text-sm text-destructive mt-1">{errors.interests}</p>
              )}
            </div>

            {/* Additional Preferences */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Additional Preferences</Label>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Looking for serious relationship</Label>
                  <p className="text-xs text-muted-foreground">Prioritize long-term connections</p>
                </div>
                <Switch
                  checked={formData.lookingForSeriousRelationship}
                  onCheckedChange={(checked) => updateFormData('lookingForSeriousRelationship', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Open to long distance</Label>
                  <p className="text-xs text-muted-foreground">Consider matches beyond distance preference</p>
                </div>
                <Switch
                  checked={formData.openToLongDistance}
                  onCheckedChange={(checked) => updateFormData('openToLongDistance', checked)}
                />
              </div>
            </div>
          </div>

          {/* Wallet connection status */}
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Please connect your wallet to create your encrypted dating profile
              </div>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!isConnected || checkingProfile}
            className="w-full h-12 text-base font-semibold"
          >
            {checkingProfile ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Checking Profile...
              </>
            ) : !isConnected ? (
              'Connect Wallet First'
            ) : profileExists ? (
              <>
                Update Existing Profile
                <Settings className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Create Complete Dating Profile
                <CheckCircle className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
