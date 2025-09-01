// Use crypto for Node.js environment or fallback for browser
const getRandomBytes = (size: number): Uint8Array => {
  if (typeof window !== 'undefined') {
    // Browser environment - use Web Crypto API
    return globalThis.crypto.getRandomValues(new Uint8Array(size));
  } else {
    // Node.js environment
    const crypto = require('crypto');
    return new Uint8Array(crypto.randomBytes(size));
  }
};

// Encryption limits based on contract constraints
export const ENCRYPTION_LIMITS = {
  PRIVATE_DATA_MAX_SIZE: 800,
  PREFERENCES_MAX_SIZE: 300,
  MARGIN_BYTES: 50,
} as const;

// Sample data for testing
export const SAMPLE_INCOMES = ['$50K', '$75K', '$100K', '$150K', '$200K+'] as const;

// Exact match with smart contract struct
export interface PrivateProfileData {
  income: string;  // Simplified to match contract exactly
}

// Exact match with smart contract struct
export interface MatchingPreferences {
  preferred_age_min: number;
  preferred_age_max: number;
  preferred_distance_km: number;
  interests: string[];
  relationship_type: string;
}

// Generate realistic private profile data - exactly matching contract struct
export function generatePrivateProfileData(
  username: string,
  age: number,
  habits?: { smoking: boolean; drinking: boolean }
): PrivateProfileData {
  return {
    income: SAMPLE_INCOMES[Math.floor(Math.random() * SAMPLE_INCOMES.length)],
  };
}

// Generate matching preferences based on user data - exactly matching contract struct
export function generateMatchingPreferences(
  userAge: number,
  interests: string[] = []
): MatchingPreferences {
  return {
    preferred_age_min: Math.max(18, userAge - 5),
    preferred_age_max: Math.min(99, userAge + 10),
    preferred_distance_km: 50,
    interests: interests.length > 0 ? interests : ['Music', 'Travel', 'Food'],
    relationship_type: 'serious',
  };
}

// Simple XOR encryption for demonstration
// In production, use proper encryption libraries
export function encryptSensitiveData(
  data: any,
  userPrivateKey: Uint8Array,
  maxSize: number = ENCRYPTION_LIMITS.PRIVATE_DATA_MAX_SIZE
): Uint8Array {
  let jsonData = JSON.stringify(data);

  // Truncate data if too large - updated for new struct format
  if (jsonData.length > maxSize - ENCRYPTION_LIMITS.MARGIN_BYTES) {
    const truncatedData = {
      income: data.income?.substring(0, 20) || '',
      preferred_age_min: data.preferred_age_min || 18,
      preferred_age_max: data.preferred_age_max || 65,
      relationship_type: data.relationship_type?.substring(0, 20) || '',
      interests: data.interests?.slice(0, 5) || [],
      preferred_distance_km: data.preferred_distance_km || 25,
    };

    jsonData = JSON.stringify(truncatedData);
  }

  const dataBytes = Buffer.from(jsonData, 'utf8');
  const finalSize = Math.min(dataBytes.length, maxSize);
  const encryptedData = new Uint8Array(finalSize);

  // Simple XOR encryption
  for (let i = 0; i < finalSize; i++) {
    const keyByte = userPrivateKey[i % userPrivateKey.length];
    const dataByte = i < dataBytes.length ? dataBytes[i] : 0;
    encryptedData[i] = dataByte ^ keyByte;
  }

  return encryptedData;
}

// Generate a random encryption key
export function generateEncryptionKey(): Uint8Array {
  return getRandomBytes(32);
}

// Convert profile data from frontend format to blockchain format
export function convertProfileDataForBlockchain(
  profileData: any,
  privateData: PrivateProfileData,
  preferences: MatchingPreferences,
  encryptionKey: Uint8Array
) {
  const encryptedPrivateData = encryptSensitiveData(
    privateData,
    encryptionKey,
    ENCRYPTION_LIMITS.PRIVATE_DATA_MAX_SIZE
  );

  const encryptedPreferences = encryptSensitiveData(
    preferences,
    encryptionKey,
    ENCRYPTION_LIMITS.PREFERENCES_MAX_SIZE
  );

  // Generate avatar URL if not provided
  const avatarUrl =
    profileData.photos?.[0] ||
    `https://api.dicebear.com/7.x/avatars/svg?seed=${profileData.name}`;

  return {
    username: profileData.name,
    avatarUrl,
    age: parseInt(profileData.age),
    locationCity: profileData.city,
    encryptedPrivateData: Buffer.from(encryptedPrivateData),
    encryptedPreferences: Buffer.from(encryptedPreferences),
    encryptionPubkey: Array.from(encryptionKey),
    profileVersion: 1,
  };
}

// Validate profile data before blockchain submission
export function validateProfileData(profileData: any): string[] {
  const errors: string[] = [];

  if (!profileData.name || profileData.name.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (!profileData.name || profileData.name.length > 32) {
    errors.push('Username must be less than 32 characters long');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(profileData.name)) {
    errors.push('Username can only contain letters, numbers and underscores');
  }

  const age = parseInt(profileData.age);
  if (!age || age < 18 || age > 99) {
    errors.push('Age must be between 18 and 99');
  }

  if (!profileData.city || profileData.city.trim().length === 0) {
    errors.push('Location is required');
  }

  if (!profileData.bio || profileData.bio.trim().length === 0) {
    errors.push('Bio is required');
  }

  return errors;
}

// Helper to generate a sample avatar URL
export function generateAvatarUrl(name: string): string {
  return `https://api.dicebear.com/7.x/avatars/svg?seed=${encodeURIComponent(name)}`;
}

// Transform onchain profile to frontend format
export interface OnChainProfile {
  account: {
    owner: any;
    bump: number;
    username: string;
    avatarUrl: string;
    age: number;
    locationCity: string;
    isActive: boolean;
    createdAt: any;
    lastUpdated: any;
    profileVersion: number;
    encryptionPubkey: number[];
    encryptedPrivateData: any;
    encryptedPreferences: any;
    encryptedLikesGiven: any;
    encryptedLikesReceived: any;
    encryptedMatches: any;
    totalLikesGiven: number;
    totalLikesReceived: number;
    totalMatches: number;
  };
  publicKey: any;
  profilePDA: any;
}

export interface FrontendProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  bio: string;
  interests: string[];
  habits: { smoking: boolean; drinking: boolean };
  work?: string;
  company?: string;
  school?: string;
  isMatch?: boolean;
  walletAddress: string;
  createdAt?: Date;
  lastUpdated?: Date;
  totalLikes?: number;
  totalMatches?: number;
}

export function transformOnChainProfileToFrontend(onchainProfile: OnChainProfile): FrontendProfile {
  // Create a meaningful bio based on available data
  const bio = `Hi! I'm ${onchainProfile.account.username} from ${onchainProfile.account.locationCity}. Looking forward to meeting new people!`;
  
  // Generate some interests based on username/age (for demo purposes)
  const interests = generateInterestsFromProfile(onchainProfile.account.username, onchainProfile.account.age);
  
  // Default habits (could be decrypted from private data in the future)
  const habits = { smoking: false, drinking: Math.random() > 0.5 };
  
  // Handle timestamp conversion from BN to number if needed
  const createdAtMs = typeof onchainProfile.account.createdAt === 'object' && 'toNumber' in onchainProfile.account.createdAt
    ? onchainProfile.account.createdAt.toNumber() * 1000
    : Number(onchainProfile.account.createdAt) * 1000;
    
  const lastUpdatedMs = typeof onchainProfile.account.lastUpdated === 'object' && 'toNumber' in onchainProfile.account.lastUpdated
    ? onchainProfile.account.lastUpdated.toNumber() * 1000
    : Number(onchainProfile.account.lastUpdated) * 1000;
  
  return {
    id: onchainProfile.publicKey.toString(),
    name: onchainProfile.account.username,
    age: onchainProfile.account.age,
    city: onchainProfile.account.locationCity,
    photos: onchainProfile.account.avatarUrl ? [onchainProfile.account.avatarUrl] : ['/placeholder.svg?height=600&width=400'],
    bio,
    interests,
    habits,
    walletAddress: onchainProfile.account.owner.toString(),
    createdAt: new Date(createdAtMs),
    lastUpdated: new Date(lastUpdatedMs),
    totalLikes: onchainProfile.account.totalLikesReceived,
    totalMatches: onchainProfile.account.totalMatches,
    isMatch: false // This would be determined by matching logic
  };
}

// Generate interests based on profile data (demo function)
function generateInterestsFromProfile(username: string, age: number): string[] {
  const allInterests = [
    'hiking', 'coffee', 'photography', 'travel', 'yoga', 'music', 'cooking',
    'concerts', 'guitar', 'craft beer', 'art', 'painting', 'farmers markets',
    'vintage shopping', 'indie films', 'rock climbing', 'camping', 'fitness',
    'adventure sports', 'reading', 'dancing', 'wine tasting', 'board games',
    'cycling', 'surfing', 'meditation', 'volunteering'
  ];
  
  // Generate 3-6 interests based on username hash and age
  const nameHash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = nameHash + age;
  const numInterests = 3 + (seed % 4); // 3-6 interests
  
  const selectedInterests: string[] = [];
  for (let i = 0; i < numInterests; i++) {
    const index = (seed + i * 7) % allInterests.length;
    if (!selectedInterests.includes(allInterests[index])) {
      selectedInterests.push(allInterests[index]);
    }
  }
  
  return selectedInterests;
}

// Transform multiple onchain profiles to frontend format
export function transformOnChainProfilesToFrontend(onchainProfiles: OnChainProfile[]): FrontendProfile[] {
  return onchainProfiles.map(profile => transformOnChainProfileToFrontend(profile));
}
