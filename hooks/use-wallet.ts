import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

export interface WalletInfo {
  address: string;
  balance: number;
  isConnected: boolean;
  isConnecting: boolean;
  walletName?: string;
}

export function useWalletInfo() {
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnect, 
    wallet,
    connect
  } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalance(0);
      return;
    }

    try {
      setIsLoading(true);
      const walletBalance = await connection.getBalance(publicKey);
      setBalance(walletBalance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connected, connection]);

  // Update balance when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      getBalance();
    }
  }, [connected, publicKey, getBalance]);

  // Connect wallet handler
  const handleConnect = useCallback(async () => {
    try {
      if (!connected) {
        setVisible(true);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect wallet. Please try again.',
        variant: 'destructive',
      });
    }
  }, [connected, setVisible, toast]);

  // Disconnect wallet handler
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setBalance(0);
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected successfully.',
      });
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast({
        title: 'Disconnection Error',
        description: 'Failed to disconnect wallet. Please try again.',
        variant: 'destructive',
      });
    }
  }, [disconnect, toast]);

  // Format wallet address
  const formatAddress = useCallback((address: string, chars = 4) => {
    if (!address) return '';
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  }, []);

  const walletInfo: WalletInfo = {
    address: publicKey?.toBase58() || '',
    balance,
    isConnected: connected,
    isConnecting: connecting,
    walletName: wallet?.adapter?.name,
  };

  return {
    walletInfo,
    isLoading,
    connect: handleConnect,
    disconnect: handleDisconnect,
    getBalance,
    formatAddress,
  };
}
