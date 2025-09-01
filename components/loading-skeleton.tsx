'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className='bg-muted rounded-md h-4 w-full'></div>
    </div>
  );
}

export function ProfileCardSkeleton() {
  return (
    <Card className='absolute top-0 left-0 w-full h-full border-0 !p-0 !m-0'>
      <CardContent className='!p-0 h-full w-full'>
        <div className='relative h-full w-full'>
          {/* Full Photo Background Skeleton */}
          <div className='absolute inset-0 bg-muted rounded-xl animate-pulse'></div>

          {/* Profile Info Overlay Skeleton */}
          <div className='absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent'>
            <div className='animate-pulse'>
              {/* Name and Age */}
              <div className='flex items-center gap-2 mb-3'>
                <div className='h-6 bg-white/30 rounded w-24'></div>
                <div className='h-6 bg-white/30 rounded w-8'></div>
                <div className='w-5 h-5 bg-white/30 rounded-full'></div>
              </div>

              {/* Interest Tags */}
              <div className='flex flex-wrap gap-2 mb-4'>
                <div className='h-6 bg-white/30 rounded-full w-16'></div>
                <div className='h-6 bg-white/30 rounded-full w-20'></div>
                <div className='h-6 bg-white/30 rounded-full w-14'></div>
                <div className='h-6 bg-white/30 rounded-full w-18'></div>
              </div>

              {/* Action Buttons */}
              <div className='flex items-center justify-center gap-4'>
                <div className='w-16 h-16 bg-white/20 rounded-full'></div>
                <div className='w-14 h-14 bg-white/20 rounded-full'></div>
                <div className='w-16 h-16 bg-white/20 rounded-full'></div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChatListSkeleton() {
  return (
    <div className='space-y-2 p-4'>
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} className='border-0 bg-card/50'>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3 animate-pulse'>
              <div className='w-14 h-14 bg-muted rounded-full'></div>
              <div className='flex-1 space-y-2'>
                <div className='flex justify-between'>
                  <div className='h-4 bg-muted rounded w-24'></div>
                  <div className='h-3 bg-muted rounded w-12'></div>
                </div>
                <div className='h-3 bg-muted rounded w-32'></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
