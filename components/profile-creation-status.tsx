'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export interface ProfileCreationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

interface ProfileCreationStatusProps {
  steps: ProfileCreationStep[];
  transactionSignature?: string;
  onRetry?: () => void;
  onComplete?: () => void;
}

export function ProfileCreationStatus({
  steps,
  transactionSignature,
  onRetry,
  onComplete,
}: ProfileCreationStatusProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const processingIndex = steps.findIndex(step => step.status === 'processing');
    if (processingIndex !== -1) {
      setCurrentStepIndex(processingIndex);
    }
  }, [steps]);

  const getStatusIcon = (status: ProfileCreationStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const allCompleted = steps.every(step => step.status === 'completed');
  const hasError = steps.some(step => step.status === 'error');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Creating Your Profile</h2>
        <p className="text-muted-foreground">
          We're setting up your encrypted profile on the blockchain
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{step.title}</h3>
                    {step.status === 'processing' && (
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-75" />
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse delay-150" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.status === 'error' && step.errorMessage && (
                    <p className="text-xs text-red-600 mt-1">{step.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {transactionSignature && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium text-sm">Transaction Confirmed</span>
            </div>
            <div className="mt-2 text-xs text-green-700">
              <a
                href={`https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                View on Solana Explorer
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {hasError && onRetry && (
          <Button onClick={onRetry} variant="outline" className="flex-1">
            Retry
          </Button>
        )}
        {allCompleted && onComplete && (
          <Button onClick={onComplete} className="flex-1">
            Continue to App
          </Button>
        )}
      </div>
    </div>
  );
}
