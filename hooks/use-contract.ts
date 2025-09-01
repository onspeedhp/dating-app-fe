'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useCallback, useMemo } from 'react';
import { useToast } from './use-toast';
import * as anchor from '@coral-xyz/anchor';
import { Contract } from '../lib/contract';
import contractIDL from '../lib/contract.json';

const PROGRAM_ID = new PublicKey('2XTVdn5xYacRCkUq12JLkxAVL7ZNaZFKuTcxEg6tV3Q4');

export interface CreateProfileData {
  username: string;
  avatarUrl: string;
  age: number;
  locationCity: string;
  encryptedPrivateData: Buffer;
  encryptedPreferences: Buffer;
  encryptionPubkey: number[];
  profileVersion: number;
}

export function useContract() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { toast } = useToast();

  // Initialize Anchor provider and program
  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return null;
    }

    return new anchor.AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions || (() => Promise.reject('Not supported')),
      },
      { commitment: 'confirmed' }
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new anchor.Program<Contract>(contractIDL as anchor.Idl, provider);
  }, [provider]);

  // Get user profile PDA
  const getUserProfilePDA = useCallback((userPublicKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), userPublicKey.toBuffer()],
      PROGRAM_ID
    )[0];
  }, []);

  // Create profile on blockchain
  const createProfile = useCallback(async (profileData: CreateProfileData) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      const userProfilePDA = getUserProfilePDA(wallet.publicKey);

      // Check if profile already exists
      try {
        const existingProfile = await program.account.userProfile.fetch(userProfilePDA);
        if (existingProfile) {
          throw new Error('Profile already exists for this wallet');
        }
      } catch (error) {
        // Profile doesn't exist, which is what we want
      }

      const tx = await program.methods
        .createProfile({
          username: profileData.username,
          avatarUrl: profileData.avatarUrl,
          age: profileData.age,
          locationCity: profileData.locationCity,
          encryptedPrivateData: profileData.encryptedPrivateData,
          encryptedPreferences: profileData.encryptedPreferences,
          encryptionPubkey: profileData.encryptionPubkey,
          profileVersion: profileData.profileVersion,
        })
        .accountsPartial({
          user: wallet.publicKey,
          userProfile: userProfilePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });

      toast({
        title: 'Profile Created!',
        description: `Your profile has been created on-chain. Transaction: ${tx.slice(0, 8)}...`,
      });

      return {
        signature: tx,
        profilePDA: userProfilePDA,
      };
    } catch (error: any) {
      console.error('Error creating profile:', error);
      
      // Handle specific contract errors
      if (error.message.includes('UsernameTooShort')) {
        throw new Error('Username must be at least 3 characters long');
      }
      if (error.message.includes('UsernameTooLong')) {
        throw new Error('Username must be less than 32 characters long');
      }
      if (error.message.includes('InvalidAge')) {
        throw new Error('Age must be between 18 and 99');
      }
      if (error.message.includes('ProfileAlreadyExists')) {
        throw new Error('Profile already exists for this wallet');
      }
      if (error.message.includes('AvatarRequired')) {
        throw new Error('Avatar URL is required');
      }
      if (error.message.includes('LocationRequired')) {
        throw new Error('Location is required');
      }
      
      throw new Error(error.message || 'Failed to create profile on blockchain');
    }
  }, [program, wallet.publicKey, getUserProfilePDA, toast]);

  // Get user profile
  const getUserProfile = useCallback(async (userPublicKey?: PublicKey) => {
    if (!program) {
      throw new Error('Program not initialized');
    }

    const targetKey = userPublicKey || wallet.publicKey;
    if (!targetKey) {
      throw new Error('No public key provided');
    }

    try {
      const userProfilePDA = getUserProfilePDA(targetKey);
      const profile = await program.account.userProfile.fetch(userProfilePDA);
      return {
        profile,
        profilePDA: userProfilePDA,
      };
    } catch (error: any) {
      if (error.message.includes('Account does not exist')) {
        return null; // Profile doesn't exist
      }
      throw error;
    }
  }, [program, wallet.publicKey, getUserProfilePDA]);

  // Check if user has profile
  const hasProfile = useCallback(async (userPublicKey?: PublicKey) => {
    try {
      const result = await getUserProfile(userPublicKey);
      return result !== null;
    } catch (error) {
      return false;
    }
  }, [getUserProfile]);

  // Fetch all profiles from blockchain
  const getAllProfiles = useCallback(async () => {
    if (!program) {
      throw new Error('Program not initialized');
    }

    try {
      const profiles = await program.account.userProfile.all();
      return profiles.map(profile => ({
        account: profile.account,
        publicKey: profile.publicKey,
        profilePDA: profile.publicKey,
      }));
    } catch (error: any) {
      console.error('Error fetching all profiles:', error);
      throw new Error('Failed to fetch profiles from blockchain');
    }
  }, [program]);

  // Fetch profiles with pagination (for performance)
  const getProfilesPaginated = useCallback(async (limit = 20, offset = 0) => {
    if (!program) {
      throw new Error('Program not initialized');
    }

    try {
      // Get all profile PDAs first to implement pagination
      const allProfiles = await program.account.userProfile.all();
      
      // Apply pagination
      const paginatedProfiles = allProfiles.slice(offset, offset + limit);
      
      return {
        profiles: paginatedProfiles.map(profile => ({
          account: profile.account,
          publicKey: profile.publicKey,
          profilePDA: profile.publicKey,
        })),
        total: allProfiles.length,
        hasMore: offset + limit < allProfiles.length,
      };
    } catch (error: any) {
      console.error('Error fetching paginated profiles:', error);
      throw new Error('Failed to fetch profiles from blockchain');
    }
  }, [program]);

  // Fetch profiles in a specific city
  const getProfilesByCity = useCallback(async (city: string) => {
    if (!program) {
      throw new Error('Program not initialized');
    }

    try {
      const allProfiles = await program.account.userProfile.all();
      
      // Filter by city (case insensitive)
      const cityProfiles = allProfiles.filter(profile => 
        profile.account.locationCity.toLowerCase() === city.toLowerCase()
      );
      
      return cityProfiles.map(profile => ({
        account: profile.account,
        publicKey: profile.publicKey,
        profilePDA: profile.publicKey,
      }));
    } catch (error: any) {
      console.error('Error fetching profiles by city:', error);
      throw new Error('Failed to fetch profiles by city');
    }
  }, [program]);

  // Get active profiles only
  const getActiveProfiles = useCallback(async (limit = 20) => {
    if (!program) {
      throw new Error('Program not initialized');
    }

    try {
      const allProfiles = await program.account.userProfile.all();
      
      // Filter active profiles and apply limit
      const activeProfiles = allProfiles
        .filter(profile => profile.account.isActive)
        .slice(0, limit);
      
      return activeProfiles.map(profile => ({
        account: profile.account,
        publicKey: profile.publicKey,
        profilePDA: profile.publicKey,
      }));
    } catch (error: any) {
      console.error('Error fetching active profiles:', error);
      throw new Error('Failed to fetch active profiles');
    }
  }, [program]);

  return {
    program,
    provider,
    createProfile,
    getUserProfile,
    hasProfile,
    getUserProfilePDA,
    getAllProfiles,
    getProfilesPaginated,
    getProfilesByCity,
    getActiveProfiles,
    isConnected: !!wallet.connected,
    publicKey: wallet.publicKey,
  };
}
