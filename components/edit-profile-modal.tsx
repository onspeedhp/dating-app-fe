'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { X } from 'lucide-react';
import { interestOptions } from '@/lib/mock-data';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onSave: (updates: any) => void;
}

export function EditProfileModal({
  open,
  onClose,
  user,
  onSave,
}: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    city: '',
    workTitle: '',
    company: '',
    school: '',
    bio: '',
    interests: [] as string[],
    habits: {
      smoking: false,
      drinking: false,
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && user) {
      setFormData({
        name: user.name || '',
        age: user.age?.toString() || '',
        city: user.city || '',
        workTitle: user.workTitle || user.work || '',
        company: user.company || '',
        school: user.school || '',
        bio: user.bio || '',
        interests: user.interests || [],
        habits: user.habits || { smoking: false, drinking: false },
      });
      setErrors({});
    }
  }, [open, user]);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const toggleInterest = (interest: string) => {
    const newInterests = formData.interests.includes(interest)
      ? formData.interests.filter((i) => i !== interest)
      : [...formData.interests, interest];
    updateFormData({ interests: newInterests });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.age) newErrors.age = 'Age is required';
    else if (Number.parseInt(formData.age) < 18)
      newErrors.age = 'You must be 18 or older';
    else if (Number.parseInt(formData.age) > 100)
      newErrors.age = 'Please enter a valid age';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.workTitle.trim())
      newErrors.workTitle = 'Job title or field of study is required';
    if (!formData.bio.trim()) newErrors.bio = 'Bio is required';
    else if (formData.bio.length > 160)
      newErrors.bio = 'Bio must be 160 characters or less';
    if (formData.interests.length === 0)
      newErrors.interests = 'Please select at least one interest';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      const updates = {
        ...formData,
        age: Number.parseInt(formData.age),
        work: formData.workTitle,
      };
      onSave(updates);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Basic Info */}
          <div className='space-y-4'>
            <div>
              <Label htmlFor='edit-name'>Name</Label>
              <Input
                id='edit-name'
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder='Enter your name'
                className='h-12 rounded-xl'
              />
              {errors.name && (
                <p className='text-sm text-destructive mt-1'>{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor='edit-age'>Age</Label>
              <Input
                id='edit-age'
                type='number'
                value={formData.age}
                onChange={(e) => updateFormData({ age: e.target.value })}
                placeholder='Enter your age'
                className='h-12 rounded-xl'
                min='18'
                max='100'
              />
              {errors.age && (
                <p className='text-sm text-destructive mt-1'>{errors.age}</p>
              )}
            </div>

            <div>
              <Label htmlFor='edit-city'>City</Label>
              <Input
                id='edit-city'
                value={formData.city}
                onChange={(e) => updateFormData({ city: e.target.value })}
                placeholder='Enter your city'
                className='h-12 rounded-xl'
              />
              {errors.city && (
                <p className='text-sm text-destructive mt-1'>{errors.city}</p>
              )}
            </div>
          </div>

          {/* Work/Study */}
          <div className='space-y-4'>
            <div>
              <Label htmlFor='edit-work'>Job title or field of study</Label>
              <Input
                id='edit-work'
                value={formData.workTitle}
                onChange={(e) => updateFormData({ workTitle: e.target.value })}
                placeholder='e.g., Software Engineer, Psychology Student'
                className='h-12 rounded-xl'
              />
              {errors.workTitle && (
                <p className='text-sm text-destructive mt-1'>
                  {errors.workTitle}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor='edit-company'>Company or School (optional)</Label>
              <Input
                id='edit-company'
                value={formData.company || formData.school}
                onChange={(e) => {
                  if (formData.workTitle.toLowerCase().includes('student')) {
                    updateFormData({ school: e.target.value, company: '' });
                  } else {
                    updateFormData({ company: e.target.value, school: '' });
                  }
                }}
                placeholder='e.g., Google, Stanford University'
                className='h-12 rounded-xl'
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor='edit-bio'>Bio</Label>
            <Textarea
              id='edit-bio'
              value={formData.bio}
              onChange={(e) => updateFormData({ bio: e.target.value })}
              placeholder='Tell people about yourself...'
              className='min-h-24 rounded-xl resize-none'
              maxLength={160}
            />
            <div className='flex justify-between items-center mt-2'>
              {errors.bio && (
                <p className='text-sm text-destructive'>{errors.bio}</p>
              )}
              <p className='text-sm text-muted-foreground ml-auto'>
                {formData.bio.length}/160 characters
              </p>
            </div>
          </div>

          {/* Interests */}
          <div>
            <Label>Interests</Label>
            {errors.interests && (
              <p className='text-sm text-destructive mt-1'>
                {errors.interests}
              </p>
            )}
            <div className='flex flex-wrap gap-2 mt-3 max-h-32 overflow-y-auto'>
              {interestOptions.map((interest) => (
                <Badge
                  key={interest}
                  variant={
                    formData.interests.includes(interest)
                      ? 'default'
                      : 'outline'
                  }
                  className='cursor-pointer px-3 py-1 rounded-full text-sm capitalize'
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                  {formData.interests.includes(interest) && (
                    <X className='w-3 h-3 ml-1' />
                  )}
                </Badge>
              ))}
            </div>
            <p className='text-sm text-muted-foreground mt-2'>
              Selected: {formData.interests.length} interests
            </p>
          </div>

          {/* Lifestyle */}
          <div className='space-y-4'>
            <Label>Lifestyle</Label>
            <Card className='border-0 bg-muted/30'>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium'>Smoking</p>
                    <p className='text-sm text-muted-foreground'>
                      Do you smoke?
                    </p>
                  </div>
                  <Switch
                    checked={formData.habits.smoking}
                    onCheckedChange={(checked) =>
                      updateFormData({
                        habits: { ...formData.habits, smoking: checked },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className='border-0 bg-muted/30'>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium'>Drinking</p>
                    <p className='text-sm text-muted-foreground'>
                      Do you drink alcohol?
                    </p>
                  </div>
                  <Switch
                    checked={formData.habits.drinking}
                    onCheckedChange={(checked) =>
                      updateFormData({
                        habits: { ...formData.habits, drinking: checked },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
