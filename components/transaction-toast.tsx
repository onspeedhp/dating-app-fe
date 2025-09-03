'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  Clock,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface TransactionInfo {
  signature: string;
  type: 'session_created' | 'like_submitted' | 'match_check' | 'profile_created';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  description: string;
}

interface TransactionToastProps {
  transaction: TransactionInfo;
  onDismiss?: () => void;
}

export function TransactionToast({ transaction, onDismiss }: TransactionToastProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'session_created': return 'Match Session';
      case 'like_submitted': return 'Like Submitted';
      case 'match_check': return 'Match Check';
      case 'profile_created': return 'Profile Created';
      default: return 'Transaction';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'session_created': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'like_submitted': return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
      case 'match_check': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'profile_created': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
      case 'failed': return <X className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const copySignature = async () => {
    try {
      await navigator.clipboard.writeText(transaction.signature);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Transaction signature copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy transaction signature",
        variant: "destructive",
      });
    }
  };

  const openInExplorer = () => {
    const explorerUrl = `https://explorer.solana.com/tx/${transaction.signature}?cluster=devnet`;
    window.open(explorerUrl, '_blank');
  };

  const truncateSignature = (signature: string) => {
    return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-lg min-w-[320px] max-w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(transaction.status)}
          <Badge variant="outline" className={getTypeColor(transaction.type)}>
            {getTypeLabel(transaction.type)}
          </Badge>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-foreground mb-3">
        {transaction.description}
      </p>

      {/* Transaction Signature */}
      <div className="bg-muted/50 rounded-md p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Transaction</span>
          <span className="text-xs text-muted-foreground">
            {new Date(transaction.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-foreground bg-background px-2 py-1 rounded flex-1">
            {truncateSignature(transaction.signature)}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={copySignature}
            className="h-6 w-6 p-0"
          >
            {copied ? (
              <CheckCircle className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openInExplorer}
          className="flex-1"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          View on Explorer
        </Button>
        {transaction.status === 'pending' && (
          <Badge variant="secondary" className="px-2 py-1">
            Processing...
          </Badge>
        )}
        {transaction.status === 'confirmed' && (
          <Badge variant="default" className="px-2 py-1 bg-green-500/10 text-green-600">
            Confirmed
          </Badge>
        )}
      </div>
    </div>
  );
}

// Hook for managing transaction notifications
export function useTransactionNotifications() {
  const { toast } = useToast();

  const showTransactionNotification = (transaction: TransactionInfo) => {
    toast({
      title: `${getTypeLabel(transaction.type)} ${transaction.status === 'confirmed' ? 'Confirmed' : 'Processing'}`,
      description: (
        <TransactionToast 
          transaction={transaction} 
        />
      ),
      duration: 5000, // Always show for 5 seconds
    });
  };

  const showTransactionSuccess = (
    type: TransactionInfo['type'], 
    signature: string, 
    description: string
  ) => {
    showTransactionNotification({
      signature,
      type,
      status: 'confirmed',
      timestamp: Date.now(),
      description,
    });
  };

  const showTransactionPending = (
    type: TransactionInfo['type'], 
    signature: string, 
    description: string
  ) => {
    showTransactionNotification({
      signature,
      type,
      status: 'pending',
      timestamp: Date.now(),
      description,
    });
  };

  const showTransactionFailed = (
    type: TransactionInfo['type'], 
    signature: string, 
    description: string
  ) => {
    showTransactionNotification({
      signature,
      type,
      status: 'failed',
      timestamp: Date.now(),
      description,
    });
  };

  return {
    showTransactionNotification,
    showTransactionSuccess,
    showTransactionPending,
    showTransactionFailed,
  };
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'session_created': return 'Match Session';
    case 'like_submitted': return 'Like';
    case 'match_check': return 'Match Check';
    case 'profile_created': return 'Profile';
    default: return 'Transaction';
  }
}
