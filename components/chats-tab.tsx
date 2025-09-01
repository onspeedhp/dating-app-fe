'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Heart } from 'lucide-react';
import { ChatThread } from '@/components/chat-thread';
import type { FrontendProfile } from '@/lib/profile-utils';

// Temporary chat interfaces until we implement onchain messaging
interface Chat {
  id: string;
  matchId: string;
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
}
import { cn } from '@/lib/utils';
import { ChatListSkeleton } from '@/components/loading-skeleton';

interface ChatsTabProps {
  user: any;
}

export function ChatsTab({ user }: ChatsTabProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Implement onchain messaging system
  // For now, we'll show an empty state since messaging is not yet implemented

  const getMatchProfile = (matchId: string): FrontendProfile | null => {
    // TODO: Get profile from onchain data based on matchId
    return null;
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return timestamp.toLocaleDateString();
  };

  const handleSendMessage = (chatId: string, message: string) => {
    const newMessage = {
      id: Date.now().toString(),
      senderId: 'me',
      text: message,
      timestamp: new Date(),
    };

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, newMessage],
              lastMessage: newMessage,
            }
          : chat
      )
    );

    // Update selected chat if it's the current one
    if (selectedChat?.id === chatId) {
      setSelectedChat((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, newMessage],
              lastMessage: newMessage,
            }
          : null
      );
    }
  };

  const handleChatSelect = (chat: Chat) => {
    // Mark as read
    const updatedChat = { ...chat, unreadCount: 0 };
    setChats((prevChats) =>
      prevChats.map((c) => (c.id === chat.id ? updatedChat : c))
    );
    setSelectedChat(updatedChat);
  };

  if (selectedChat) {
    const matchProfile = getMatchProfile(selectedChat.matchId);
    return (
      <ChatThread
        chat={selectedChat}
        matchProfile={matchProfile}
        onBack={() => setSelectedChat(null)}
        onSendMessage={(message) => handleSendMessage(selectedChat.id, message)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col'>
        <div className='flex items-center justify-between p-4'>
          <div>
            <h1 className='text-2xl font-bold'>Messages</h1>
            <p className='text-sm text-muted-foreground'>
              Loading your matches...
            </p>
          </div>
          <div className='w-10 h-10 bg-primary rounded-full flex items-center justify-center'>
            <MessageCircle className='w-5 h-5 text-primary-foreground' />
          </div>
        </div>
        <div className='flex-1 overflow-y-auto'>
          <ChatListSkeleton />
        </div>
      </div>
    );
  }

  // Always show empty state since messaging is not implemented yet
  return (
    <div className='flex-1 flex flex-col items-center justify-center p-6 text-center'>
      <div className='w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6'>
        <MessageCircle className='w-12 h-12 text-primary' />
      </div>
      <h2 className='text-2xl font-bold mb-2'>Messaging Coming Soon</h2>
      <p className='text-muted-foreground mb-8 max-w-sm'>
        Onchain messaging is under development. When you match with someone,
        you'll be able to start secure, encrypted conversations here.
      </p>
      <div className='space-y-3 w-full max-w-xs opacity-50'>
        <div className='h-12 bg-muted/50 rounded-xl animate-pulse' />
        <div className='h-12 bg-muted/30 rounded-xl animate-pulse' />
        <div className='h-12 bg-muted/20 rounded-xl animate-pulse' />
      </div>
    </div>
  );
}
