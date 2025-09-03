'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Check, Loader2 } from 'lucide-react';
import { useWalletInfo } from '@/hooks/use-wallet';
import { cn } from '@/lib/utils';

interface WalletConnectButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  showBalance?: boolean;
  fullWidth?: boolean;
}

export function WalletConnectButton({
  variant = 'default',
  size = 'default',
  className,
  showBalance = false,
  fullWidth = false,
}: WalletConnectButtonProps) {
  const { walletInfo, isLoading, connect, disconnect, formatAddress } = useWalletInfo();

  if (walletInfo.isConnected) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={disconnect}
        className={cn(
          'transition-all duration-200',
          fullWidth && 'w-full',
          className
        )}
      >
        <Check className="w-4 h-4 mr-2" />
        <div className="flex flex-col items-start">
          <span className="font-medium">
            {formatAddress(walletInfo.address)}
          </span>
          {showBalance && (
            <span className="text-xs opacity-75">
              {walletInfo.balance.toFixed(4)} SOL
            </span>
          )}
        </div>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={connect}
      disabled={walletInfo.isConnecting || isLoading}
      className={cn(
        'transition-all duration-200',
        fullWidth && 'w-full',
        className
      )}
    >
      {walletInfo.isConnecting || isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4 mr-2" />
      )}
      {walletInfo.isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}
