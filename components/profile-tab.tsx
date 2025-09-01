'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EditProfileModal } from '@/components/edit-profile-modal';
import { PhotoManagerModal } from '@/components/photo-manager-modal';
import { WalletInfoCard } from '@/components/wallet-info-card';
import {
  User,
  Edit3,
  Camera,
  Moon,
  Sun,
  Bell,
  LogOut,
  Trash2,
  MapPin,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useToast } from '@/hooks/use-toast';


interface ProfileTabProps {
  user: any;
  onLogout: () => void;
  onDeleteProfile: () => void;
  onUpdateProfile: (updates: any) => void;
}

export function ProfileTab({
  user,
  onLogout,
  onDeleteProfile,
  onUpdateProfile,
}: ProfileTabProps) {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();


  const handleThemeToggle = (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light';
    setTheme(newTheme);
    toast({
      title: `Switched to ${newTheme} mode`,
      description: `The app is now in ${newTheme} theme`,
    });
  };

  const handleLogout = () => {
    toast({
      title: 'Logged out',
      description: "You've been successfully logged out",
    });
    onLogout();
  };

  const handleDeleteProfile = () => {
    toast({
      title: 'Profile deleted',
      description: 'Your profile has been permanently deleted',
    });
    onDeleteProfile();
  };

  const handleProfileUpdate = (updates: any) => {
    onUpdateProfile(updates);
    toast({
      title: 'Profile updated',
      description: 'Your changes have been saved successfully',
    });
  };



  return (
    <div className='flex-1 overflow-y-auto'>
      {/* Header */}
      <div className='flex items-center justify-between p-4'>
        <div>
          <h1 className='text-2xl font-bold'>Profile</h1>
          <p className='text-sm text-muted-foreground'>Manage your account</p>
        </div>
        <div className='w-10 h-10 bg-primary rounded-full flex items-center justify-center'>
          <User className='w-5 h-5 text-primary-foreground' />
        </div>
      </div>

      <div className='px-4 pb-24 space-y-6'>
        {/* Profile Summary */}
        <Card className='border-0 bg-gradient-to-br from-primary/5 to-accent/5'>
          <CardContent className='p-6'>
            {/* Profile Image - Centered */}
            <div className='flex flex-col items-center text-center mb-6'>
              <div className='w-24 h-24 rounded-full overflow-hidden bg-muted mb-4 ring-2 ring-primary/20'>
                <img
                  src={
                    user?.photos?.[0] ||
                    user?.profile?.avatarUrl ||
                    (user?.name ? `https://api.dicebear.com/7.x/avatars/svg?seed=${encodeURIComponent(user.name)}` : '/placeholder.svg?height=96&width=96&query=profile photo')
                  }
                  alt='Profile'
                  className='w-full h-full object-cover'
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = user?.name ? `https://api.dicebear.com/7.x/avatars/svg?seed=${encodeURIComponent(user.name)}` : '/placeholder.svg?height=96&width=96';
                  }}
                />
              </div>
              
              {/* Name and Age */}
              <div className='flex items-center gap-2 mb-2'>
                <h2 className='text-2xl font-bold'>
                  {user.name || 'Your Name'}
                </h2>
                <span className='text-xl text-muted-foreground'>
                  {user.age || '25'}
                </span>
                {/* Verification Badge */}
                <div className='w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center'>
                  <svg className='w-4 h-4 text-white' fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                  </svg>
                </div>
              </div>

              {/* Location */}
              <div className='flex items-center gap-1 mb-3 text-muted-foreground'>
                <MapPin className='w-4 h-4' />
                <span className='text-sm'>{user.city || 'Your City'}</span>
              </div>

              {/* Work/School */}
              {(user.workTitle || user.work) && (
                <div className='flex items-center gap-1 mb-4 text-muted-foreground'>
                  {user.school ? (
                    <GraduationCap className='w-4 h-4' />
                  ) : (
                    <Briefcase className='w-4 h-4' />
                  )}
                  <span className='text-sm'>
                    {user.workTitle || user.work}
                    {(user.company || user.school) &&
                      ` at ${user.company || user.school}`}
                  </span>
                </div>
              )}
            </div>

            {/* Interests - Centered */}
            <div className='flex flex-wrap gap-2 justify-center'>
              {user.interests?.slice(0, 6).map((interest: string) => (
                <Badge
                  key={interest}
                  variant='secondary'
                  className='text-xs px-3 py-1 rounded-full'
                >
                  {interest}
                </Badge>
              ))}
              {user.interests?.length > 6 && (
                <Badge
                  variant='secondary'
                  className='text-xs px-3 py-1 rounded-full'
                >
                  +{user.interests.length - 6}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile Actions */}
        <Card className='border-0 bg-card/50'>
          <CardHeader>
            <CardTitle className='text-lg'>Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Button
              variant='outline'
              className='w-full justify-start h-12 bg-transparent'
              onClick={() => setShowEditProfile(true)}
            >
              <Edit3 className='w-5 h-5 mr-3' />
              Edit Profile
            </Button>

            <Button
              variant='outline'
              className='w-full justify-start h-12 bg-transparent'
              onClick={() => setShowPhotoManager(true)}
            >
              <Camera className='w-5 h-5 mr-3' />
              Manage Photos
            </Button>
          </CardContent>
        </Card>

        {/* Wallet Information */}
        <WalletInfoCard className='border-0 bg-card/50' />







        {/* App Settings */}
        <Card className='border-0 bg-card/50'>
          <CardHeader>
            <CardTitle className='text-lg'>App Settings</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Theme Toggle */}
            <div className='flex items-center justify-between py-2'>
              <div className='flex items-center gap-3'>
                {theme === 'light' ? (
                  <Sun className='w-5 h-5' />
                ) : (
                  <Moon className='w-5 h-5' />
                )}
                <div>
                  <p className='font-medium'>Theme</p>
                  <p className='text-sm text-muted-foreground'>
                    {theme === 'light' ? 'Light mode' : 'Dark mode'}
                  </p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={handleThemeToggle}
              />
            </div>

            {/* Notifications */}
            <div className='flex items-center justify-between py-2'>
              <div className='flex items-center gap-3'>
                <Bell className='w-5 h-5' />
                <div>
                  <p className='font-medium'>Notifications</p>
                  <p className='text-sm text-muted-foreground'>
                    Push notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(checked) => {
                  setNotificationsEnabled(checked);
                  toast({
                    title: checked
                      ? 'Notifications enabled'
                      : 'Notifications disabled',
                    description: checked
                      ? "You'll receive push notifications"
                      : 'Push notifications are turned off',
                  });
                }}
              />
            </div>


          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className='border-0 bg-card/50'>
          <CardHeader>
            <CardTitle className='text-lg'>Account</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Button
              variant='outline'
              className='w-full justify-start h-12 bg-transparent'
              onClick={() => setShowLogoutDialog(true)}
            >
              <LogOut className='w-5 h-5 mr-3' />
              Log Out
            </Button>

            <Button
              variant='outline'
              className='w-full justify-start h-12 bg-transparent text-destructive hover:text-destructive hover:bg-destructive/10'
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className='w-5 h-5 mr-3' />
              Delete Profile
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        user={user}
        onSave={handleProfileUpdate}
      />

      <PhotoManagerModal
        open={showPhotoManager}
        onClose={() => setShowPhotoManager(false)}
        photos={user?.photos || user?.profile?.avatarUrl ? [user.profile.avatarUrl] : []}
        onSave={(photos) => handleProfileUpdate({ photos })}
      />

      {/* Logout Confirmation */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out of Violet?</DialogTitle>
            <DialogDescription>
              You'll need to log back in to access your account and continue
              matching.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleLogout}>Log Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Profile Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your profile?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Your profile, matches, and messages
              will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleDeleteProfile}>
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
