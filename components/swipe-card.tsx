'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

import type { Profile } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (direction: 'left' | 'right') => void;
  onPass?: () => void;
  onLike?: () => void;
  onSuperLike?: () => void;
  isTop: boolean;
  zIndex: number;
  scale: number;
  translateY: number;
  disabled: boolean;
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
}: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number, clientY: number) => {
    if (!isTop || disabled) return;
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !isTop || disabled) return;

    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;

    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleEnd = () => {
    if (!isDragging || !isTop || disabled) return;

    const threshold = 100;
    const { x } = dragOffset;

    if (Math.abs(x) > threshold) {
      onSwipe(x > 0 ? 'right' : 'left');
    }

    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
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
        isDragging && 'transition-none',
        !isDragging && 'transition-all duration-400 ease-out'
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
            <div className='flex items-center justify-center gap-4'>
              <button
                className='w-16 h-16 rounded-full border-2 border-red-500/60 hover:border-red-500 bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all duration-200'
                onClick={(e) => {
                  e.stopPropagation();
                  // Trigger swipe left animation with red overlay
                  setDragOffset({ x: -200, y: 0 });
                  // Keep the red overlay visible for a moment
                  setTimeout(() => {
                    onPass?.();
                  }, 500);
                }}
              >
                <span className='text-red-500 text-3xl font-bold'>×</span>
              </button>

              <button
                className='w-14 h-14 rounded-full border-2 border-blue-500/60 hover:border-blue-500 bg-blue-500/20 hover:bg-blue-500/30 flex items-center justify-center transition-all duration-200'
                onClick={(e) => {
                  e.stopPropagation();
                  onSuperLike?.();
                }}
              >
                <span className='text-blue-500 text-2xl'>⭐</span>
              </button>

              <button
                className='w-16 h-16 rounded-full border-2 border-green-500/60 hover:border-green-500 bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-all duration-200'
                onClick={(e) => {
                  e.stopPropagation();
                  // Trigger swipe right animation with green overlay
                  setDragOffset({ x: 200, y: 0 });
                  // Keep the green overlay visible for a moment
                  setTimeout(() => {
                    onLike?.();
                  }, 500);
                }}
              >
                <span className='text-green-500 text-3xl'>♥</span>
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
