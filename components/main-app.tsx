'use client';

import { useState } from 'react';
import { DiscoverTab } from '@/components/discover-tab';
import { ChatsTab } from '@/components/chats-tab';
import { ProfileTab } from '@/components/profile-tab';
import { ActivityTab } from '@/components/activity-tab';
import { ActivitySidebar } from '@/components/activity-sidebar';
import { MessageCircle, User, Compass, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainAppProps {
  user: any;
  onLogout: () => void;
  onDeleteProfile: () => void;
  onUpdateProfile: (updates: any) => void;
}

type Tab = 'discover' | 'chats' | 'activity' | 'profile';

export function MainApp({
  user,
  onLogout,
  onDeleteProfile,
  onUpdateProfile,
}: MainAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>('discover');

  const tabs = [
    { id: 'discover' as Tab, label: 'Discover', icon: Compass },
    { id: 'chats' as Tab, label: 'Chats', icon: MessageCircle },
    { id: 'activity' as Tab, label: 'Activity', icon: Activity },
    { id: 'profile' as Tab, label: 'Profile', icon: User },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'discover':
        return <DiscoverTab user={user} />;
      case 'chats':
        return <ChatsTab user={user} />;
      case 'activity':
        return <ActivityTab user={user} />;
      case 'profile':
        return (
          <ProfileTab
            user={user}
            onLogout={onLogout}
            onDeleteProfile={onDeleteProfile}
            onUpdateProfile={onUpdateProfile}
          />
        );
      default:
        return <DiscoverTab user={user} />;
    }
  };

  return (
    <div className='min-h-screen bg-background flex overflow-hidden'>
      {/* Desktop Sidebar Navigation */}
      <div className='hidden lg:flex lg:flex-col lg:w-80 border-r border-border bg-card/50 backdrop-blur-sm custom-scrollbar'>
        {/* App Header */}
        <div className='p-6 border-b border-border bg-gradient-to-r from-background to-primary/5'>
          <h1 className='text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent'>
            Violet
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>Find your perfect match</p>
        </div>
        
        {/* Desktop Navigation */}
        <div className='flex-1 p-4 space-y-2'>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 sidebar-item desktop-focus',
                  isActive
                    ? 'text-primary bg-primary/10 shadow-sm border border-primary/20 active'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                <span className='font-medium'>{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        {/* Desktop User Info */}
        <div className='p-4 border-t border-border bg-gradient-to-r from-background to-muted/20'>
          <div className='flex items-center gap-3 p-3 rounded-lg bg-muted/30 desktop-hover-scale glass-card'>
            <div className='w-10 h-10 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-lg'>
              <User className='w-5 h-5 text-white' />
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium truncate'>{user?.name || user?.username || 'User'}</p>
              <p className='text-xs text-muted-foreground'>{user?.city || user?.location || 'Online'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        {/* Mobile Header */}
        <div className='lg:hidden flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-background via-card/80 to-primary/5 backdrop-blur-sm'>
          <h1 className='text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent'>
            Violet
          </h1>
          <div className='w-8 h-8 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-lg'>
            <User className='w-4 h-4 text-white' />
          </div>
        </div>
        
        {/* Desktop Layout with Main Content and Sidebar */}
        <div className='flex-1 flex overflow-hidden'>
          {/* Tab Content */}
          <div className='flex-1 overflow-hidden'>
            {renderActiveTab()}
          </div>

          {/* Desktop Activity Sidebar */}
          <div className='hidden lg:block'>
            <ActivitySidebar />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className='lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm z-50 shadow-lg'>
        <div className='flex items-center justify-around py-3 px-4'>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'text-primary bg-primary/10 scale-105'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-1', isActive && 'text-primary')} />
                <span className='text-xs font-medium'>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
