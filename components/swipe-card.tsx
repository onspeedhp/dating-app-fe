'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, GraduationCap } from 'lucide-react';
import type { FrontendProfile } from '@/lib/profile-utils';
import { cn } from '@/lib/utils';

interface SwipeCardProps {
  profile: FrontendProfile;
  onSwipe: (direction: 'left' | 'right') => void;
  onPass?: () => void;
  onLike?: () => void;
  onSuperLike?: () => void;
  isTop: boolean;
  zIndex: number;
  scale: number;
  translateY: number;
  disabled: boolean;
  isProcessing?: boolean;
}

export function SwipeCard({
  profile,
  onSwipe,
  onPass,
  onLike,
  onSuperLike,
  isTop,
  zIndex,
  scale,
  translateY,
  disabled,
  isProcessing = false,
}: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [showActionHint, setShowActionHint] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number, clientY: number) => {
    if (!isTop || disabled || isProcessing) return;
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !isTop || disabled || isProcessing) return;

    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;

    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleEnd = () => {
    if (!isDragging || !isTop || disabled || isProcessing) return;

    const threshold = 100;
    const { x } = dragOffset;

    if (Math.abs(x) > threshold) {
      onSwipe(x > 0 ? 'right' : 'left');
    }

    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  // Enhanced desktop interactions
  useEffect(() => {
    if (isTop && !disabled) {
      const timer = setTimeout(() => setShowActionHint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isTop, disabled]);

  // Keyboard navigation for desktop
  useEffect(() => {
    if (!isTop || disabled || isProcessing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSwipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSwipe('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSuperLike?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTop, disabled, isProcessing, onSwipe, onSuperLike]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't start drag if touching buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY);
      };

      const handleGlobalMouseUp = () => {
        handleEnd();
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, startPos]);

  const rotation = isDragging ? dragOffset.x * 0.1 : 0;
  const opacity = Math.abs(dragOffset.x) > 50 ? 0.8 : 1;

  return (
    <Card
      ref={cardRef}
      className={cn(
        'absolute top-0 left-0 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden border-0 !p-0 !m-0',
        'hover:shadow-2xl hover:scale-[1.02] transition-all duration-300',
        isDragging && 'transition-none !shadow-2xl',
        !isDragging && 'transition-all duration-400 ease-out',
        isTop && 'ring-2 ring-primary/20'
      )}
      style={{
        transform: `translate(${dragOffset.x}px, ${
          dragOffset.y + translateY
        }px) rotate(${rotation}deg) scale(${scale})`,
        zIndex,
        opacity,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className='!p-0 h-full w-full'>
        <div className='relative h-full w-full'>
          {/* Main Photo */}
          <div className='absolute inset-0 overflow-hidden rounded-xl'>
            <img
              src={
                profile.photos[0] ||
                '/placeholder.svg?height=600&width=400&query=profile photo'
              }
              alt={profile.name}
              className='w-full h-full object-cover object-center'
              draggable={false}
            />

            {/* Swipe Indicators */}
            {isDragging && (
              <>
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center transition-opacity',
                    dragOffset.x > 50 ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}
                >
                  <div className='text-white text-4xl font-bold transform rotate-12'>
                    LIKE
                  </div>
                </div>
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center transition-opacity',
                    dragOffset.x < -50 ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }}
                >
                  <div className='text-white text-4xl font-bold transform -rotate-12'>
                    PASS
                  </div>
                </div>
              </>
            )}

            {/* Button Click Overlays */}
            {dragOffset.x > 100 && (
              <div className='absolute inset-0 flex items-center justify-center transition-opacity bg-green-500/80'>
                <div className='text-white text-4xl font-bold transform rotate-12'>
                  LIKE
                </div>
              </div>
            )}
            {dragOffset.x < -100 && (
              <div className='absolute inset-0 flex items-center justify-center transition-opacity bg-red-500/80'>
                <div className='text-white text-4xl font-bold transform -rotate-12'>
                  PASS
                </div>
              </div>
            )}
          </div>

                      {/* Processing Overlay */}
          {isProcessing && (
            <div className='absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-50'>
              <div className='flex flex-col items-center gap-3 text-center px-4'>
                <div className='w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                <div className='text-white text-sm font-medium space-y-1'>
                  <p>🔒 Encrypting your action...</p>
                  <p className='text-xs opacity-80'>Using MPC encryption for privacy</p>
                </div>
              </div>
            </div>
          )}

          {/* Profile Info */}
          <div className='absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent'>
            {/* Basic Info */}
            <div className='flex items-center gap-2 mb-3'>
              <h3 className='text-2xl font-bold text-white'>
                {profile.name}
              </h3>
              <span className='text-xl text-white/80'>
                {profile.age}
              </span>
              {/* Verification Badge */}
              <div className='w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center'>
                <svg className='w-3 h-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                </svg>
              </div>
            </div>

            {/* Interest Tags */}
            <div className='flex flex-wrap gap-2 mb-4'>
              {profile.interests.slice(0, 4).map((interest) => (
                <span
                  key={interest}
                  className='px-3 py-1 bg-white/20 text-white text-xs rounded-full border border-white/30'
                >
                  {interest}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className='flex items-center justify-center gap-4 relative z-10'>
              <button
                className={cn(
                  'w-16 h-16 rounded-full border-2 border-red-500/60 hover:border-red-500 bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95',
                  (isProcessing || disabled) && 'opacity-50 cursor-not-allowed',
                  !isProcessing && !disabled && 'cursor-pointer hover:shadow-lg'
                )}
                disabled={isProcessing || disabled}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Pass button clicked!'); // Debug log
                  if (!isProcessing && !disabled && isTop) {
                    onPass?.();
                  }
                }}
              >
                <span className='text-red-500 text-3xl font-bold pointer-events-none'>×</span>
              </button>

              <button
                className={cn(
                  'w-14 h-14 rounded-full border-2 border-blue-500/60 hover:border-blue-500 bg-blue-500/20 hover:bg-blue-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95',
                  (isProcessing || disabled) && 'opacity-50 cursor-not-allowed',
                  !isProcessing && !disabled && 'cursor-pointer hover:shadow-lg'
                )}
                disabled={isProcessing || disabled}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Super like button clicked!'); // Debug log
                  if (!isProcessing && !disabled && isTop) {
                    onSuperLike?.();
                  }
                }}
              >
                <span className='text-blue-500 text-2xl pointer-events-none'>⭐</span>
              </button>

              <button
                className={cn(
                  'w-16 h-16 rounded-full border-2 border-green-500/60 hover:border-green-500 bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95',
                  (isProcessing || disabled) && 'opacity-50 cursor-not-allowed',
                  !isProcessing && !disabled && 'cursor-pointer hover:shadow-lg'
                )}
                disabled={isProcessing || disabled}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Like button clicked!'); // Debug log
                  if (!isProcessing && !disabled && isTop) {
                    onLike?.();
                  }
                }}
              >
                <span className='text-green-500 text-3xl pointer-events-none'>♥</span>
              </button>
            </div>
          </div>

          {/* Desktop Action Hints */}
          {isTop && !disabled && (isHovered || showActionHint) && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-all duration-300">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 text-center max-w-xs">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Desktop Controls
                </p>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>← Left Arrow: Pass</div>
                  <div>→ Right Arrow: Like</div>
                  <div>↑ Up Arrow: Super Like</div>
                  <div className="text-gray-500 mt-2">Or drag to swipe</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
