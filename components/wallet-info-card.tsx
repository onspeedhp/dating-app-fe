'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Copy, 
  ExternalLink, 
  RefreshCw,
  Unlink2
} from 'lucide-react';
import { useWalletInfo } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';

interface WalletInfoCardProps {
  className?: string;
}

export function WalletInfoCard({ className }: WalletInfoCardProps) {
  const { walletInfo, isLoading, disconnect, getBalance, formatAddress } = useWalletInfo();
  const { toast } = useToast();

  const copyAddress = async () => {
    if (walletInfo.address) {
      try {
        await navigator.clipboard.writeText(walletInfo.address);
        toast({
          title: 'Copied!',
          description: 'Wallet address copied to clipboard',
        });
      } catch (error) {
        toast({
          title: 'Copy Failed',
          description: 'Could not copy address to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const openExplorer = () => {
    if (walletInfo.address) {
      window.open(
        `https://explorer.solana.com/address/${walletInfo.address}?cluster=devnet`,
        '_blank'
      );
    }
  };

  if (!walletInfo.isConnected) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No wallet connected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Wallet className="w-5 h-5 mr-2" />
            Wallet Info
          </span>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Connected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Name */}
        {walletInfo.walletName && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Wallet
            </label>
            <p className="font-mono text-sm mt-1">{walletInfo.walletName}</p>
          </div>
        )}

        {/* Address */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Address
          </label>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-mono text-sm flex-1">
              {formatAddress(walletInfo.address, 8)}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={copyAddress}
              className="px-2"
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openExplorer}
              className="px-2"
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Balance */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Balance
          </label>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-mono text-lg font-semibold flex-1">
              {walletInfo.balance.toFixed(4)} SOL
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={getBalance}
              disabled={isLoading}
              className="px-2"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            onClick={disconnect}
            className="w-full"
          >
            <Unlink2 className="w-4 h-4 mr-2" />
            Disconnect Wallet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
