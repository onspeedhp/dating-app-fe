// Utility functions for decrypting on-chain profile data

export function decryptSensitiveData(
  encryptedData: Uint8Array,
  userPrivateKey: Uint8Array
): any {
  try {
    // Simple XOR decryption (matches the encryption in profile-utils)
    const decryptedBytes = new Uint8Array(encryptedData.length);
    
    for (let i = 0; i < encryptedData.length; i++) {
      const keyByte = userPrivateKey[i % userPrivateKey.length];
      decryptedBytes[i] = encryptedData[i] ^ keyByte;
    }
    
    // Convert back to string and parse JSON
    const decryptedString = Buffer.from(decryptedBytes).toString('utf8');
    
    // Remove null bytes and extra padding
    const cleanString = decryptedString.replace(/\x00+$/, '');
    
    return JSON.parse(cleanString);
  } catch (error) {
    console.error('Error decrypting data:', error);
    return null;
  }
}

export function reconstructPrivateKey(encryptionKeyArray: number[]): Uint8Array {
  return new Uint8Array(encryptionKeyArray);
}

export function getStoredEncryptionKey(): Uint8Array | null {
  try {
    const stored = localStorage.getItem('profileEncryptionKey');
    if (!stored) return null;
    
    const keyArray = stored.split(',').map(Number);
    return new Uint8Array(keyArray);
  } catch (error) {
    console.error('Error retrieving encryption key:', error);
    return null;
  }
}

export function decryptProfileData(profile: any) {
  const encryptionKey = getStoredEncryptionKey();
  if (!encryptionKey) {
    console.warn('No encryption key found in localStorage');
    return {
      privateData: null,
      preferences: null,
      error: 'Encryption key not found. Cannot decrypt private data.',
    };
  }

  try {
    // Decrypt private data
    let privateData = null;
    if (profile.encryptedPrivateData && profile.encryptedPrivateData.length > 0) {
      privateData = decryptSensitiveData(
        new Uint8Array(profile.encryptedPrivateData),
        encryptionKey
      );
    }

    // Decrypt preferences
    let preferences = null;
    if (profile.encryptedPreferences && profile.encryptedPreferences.length > 0) {
      preferences = decryptSensitiveData(
        new Uint8Array(profile.encryptedPreferences),
        encryptionKey
      );
    }

    return {
      privateData,
      preferences,
      error: null,
    };
  } catch (error: any) {
    console.error('Error decrypting profile data:', error);
    return {
      privateData: null,
      preferences: null,
      error: `Decryption failed: ${error.message}`,
    };
  }
}
