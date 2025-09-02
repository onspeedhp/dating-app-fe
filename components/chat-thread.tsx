'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  ArrowLeft,
  Send,
  MoreVertical,
  Camera,
  Smile,
} from 'lucide-react';
import type { Chat, Profile } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface ChatThreadProps {
  chat: Chat;
  matchProfile?: Profile;
  onBack: () => void;
  onSendMessage: (message: string) => void;
}

export function ChatThread({
  chat,
  matchProfile,
  onBack,
  onSendMessage,
}: ChatThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
      setTimeout(() => {
        scrollToBottom();
        inputRef.current?.focus();
      }, 100);
    }
  };

  const formatMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMessageDate = (timestamp: Date) => {
    const today = new Date();
    const messageDate = new Date(timestamp);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return messageDate.toLocaleDateString();
  };

  const shouldShowDateSeparator = (
    currentMessage: any,
    previousMessage: any
  ) => {
    if (!previousMessage) return true;

    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();

    return currentDate !== previousDate;
  };

  if (!matchProfile) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <p className='text-muted-foreground'>Profile not found</p>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col'>
      {/* Header */}
      <div className='flex items-center gap-3 p-4 border-b border-border bg-background/95 backdrop-blur-sm'>
        <Button
          variant='ghost'
          size='icon'
          onClick={onBack}
          className='rounded-full'
        >
          <ArrowLeft className='w-5 h-5' />
        </Button>

        <div className='flex items-center gap-3 flex-1'>
          <div className='w-10 h-10 rounded-full overflow-hidden'>
            <img
              src={
                matchProfile.photos[0] ||
                '/placeholder.svg?height=40&width=40&query=profile photo'
              }
              alt={matchProfile.name}
              className='w-full h-full object-cover'
            />
          </div>
          <div>
            <h2 className='font-semibold'>{matchProfile.name}</h2>
            <p className='text-xs text-muted-foreground'>Active recently</p>
          </div>
        </div>

        <Button variant='ghost' size='icon' className='rounded-full'>
          <MoreVertical className='w-5 h-5' />
        </Button>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4 pb-32'>
        {chat.messages.map((message, index) => {
          const isMe = message.senderId === 'me';
          const previousMessage = index > 0 ? chat.messages[index - 1] : null;
          const showDateSeparator = shouldShowDateSeparator(
            message,
            previousMessage
          );

          return (
            <div key={message.id}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className='flex items-center justify-center my-4'>
                  <div className='bg-muted px-3 py-1 rounded-full'>
                    <span className='text-xs text-muted-foreground'>
                      {formatMessageDate(message.timestamp)}
                    </span>
                  </div>
                </div>
              )}

              {/* Message */}
              <div
                className={cn(
                  'flex gap-2',
                  isMe ? 'justify-end' : 'justify-start'
                )}
              >
                {!isMe && (
                  <div className='w-8 h-8 rounded-full overflow-hidden flex-shrink-0'>
                    <img
                      src={
                        matchProfile.photos[0] ||
                        '/placeholder.svg?height=32&width=32&query=profile photo'
                      }
                      alt={matchProfile.name}
                      className='w-full h-full object-cover'
                    />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[75%]',
                    isMe && 'flex flex-col items-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2 inline-block',
                      isMe
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <p className='text-sm leading-relaxed break-words'>
                      {message.text}
                    </p>
                  </div>
                  <span className='text-xs text-muted-foreground mt-1 px-1'>
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Always Visible */}
      <div className='fixed bottom-20 left-0 right-0 p-2 border-t border-border bg-background/98 backdrop-blur-sm z-40'>
        <div className='max-w-sm mx-auto px-2'>
          <div className='flex items-end gap-2'>
            {/* Action Buttons */}
            <div className='flex gap-1'>
              <Button
                variant='ghost'
                size='icon'
                className='w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50'
                onClick={() => {
                  // Handle photo upload
                }}
              >
                <Camera className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50'
                onClick={() => {
                  // Handle emoji picker
                }}
              >
                <Smile className='w-4 h-4' />
              </Button>
            </div>

            {/* Message Input Container */}
            <div className='flex-1 relative'>
              <form onSubmit={handleSend} className='relative'>
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${matchProfile.name}...`}
                  className='w-full h-10 rounded-3xl bg-muted border-0 focus-visible:ring-1 focus-visible:ring-ring pr-12 pl-4'
                  maxLength={500}
                />

                {/* Send Button - Inside Input */}
                <Button
                  type='submit'
                  size='icon'
                  className={cn(
                    'absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all duration-200',
                    newMessage.trim()
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 scale-100'
                      : 'bg-transparent text-muted-foreground cursor-not-allowed scale-90'
                  )}
                  disabled={!newMessage.trim()}
                >
                  <Send className='w-3 h-3' />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
