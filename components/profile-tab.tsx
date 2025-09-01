"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EditProfileModal } from "@/components/edit-profile-modal"
import { PhotoManagerModal } from "@/components/photo-manager-modal"
import { User, Edit3, Camera, Moon, Sun, Bell, LogOut, Trash2, MapPin, Briefcase, GraduationCap } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/hooks/use-toast"

interface ProfileTabProps {
  user: any
  onLogout: () => void
  onDeleteProfile: () => void
  onUpdateProfile: (updates: any) => void
}

export function ProfileTab({ user, onLogout, onDeleteProfile, onUpdateProfile }: ProfileTabProps) {
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPhotoManager, setShowPhotoManager] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const handleThemeToggle = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    toast({
      title: `Switched to ${newTheme} mode`,
      description: `The app is now in ${newTheme} theme`,
    })
  }

  const handleLogout = () => {
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    })
    onLogout()
  }

  const handleDeleteProfile = () => {
    toast({
      title: "Profile deleted",
      description: "Your profile has been permanently deleted",
    })
    onDeleteProfile()
  }

  const handleProfileUpdate = (updates: any) => {
    onUpdateProfile(updates)
    toast({
      title: "Profile updated",
      description: "Your changes have been saved successfully",
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>

      <div className="px-4 pb-6 space-y-6">
        {/* Profile Summary */}
        <Card className="border-0 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted">
                <img
                  src={user.photos?.[0] || "/placeholder.svg?height=80&width=80&query=profile photo"}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{user.name || "Your Name"}</h2>
                  <span className="text-lg text-muted-foreground">{user.age || "25"}</span>
                </div>

                <div className="flex items-center gap-1 mb-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{user.city || "Your City"}</span>
                </div>

                {(user.workTitle || user.work) && (
                  <div className="flex items-center gap-1 mb-3 text-muted-foreground">
                    {user.school ? <GraduationCap className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                    <span className="text-sm">
                      {user.workTitle || user.work}
                      {(user.company || user.school) && ` at ${user.company || user.school}`}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {user.interests?.slice(0, 3).map((interest: string) => (
                    <Badge key={interest} variant="secondary" className="text-xs px-2 py-1 rounded-full">
                      {interest}
                    </Badge>
                  ))}
                  {user.interests?.length > 3 && (
                    <Badge variant="secondary" className="text-xs px-2 py-1 rounded-full">
                      +{user.interests.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Actions */}
        <Card className="border-0 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start h-12 bg-transparent"
              onClick={() => setShowEditProfile(true)}
            >
              <Edit3 className="w-5 h-5 mr-3" />
              Edit Profile
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12 bg-transparent"
              onClick={() => setShowPhotoManager(true)}
            >
              <Camera className="w-5 h-5 mr-3" />
              Manage Photos
            </Button>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card className="border-0 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">App Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                {theme === "light" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">{theme === "light" ? "Light mode" : "Dark mode"}</p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={handleThemeToggle} />
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5" />
                <div>
                  <p className="font-medium">Notifications</p>
                  <p className="text-sm text-muted-foreground">Push notifications</p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(checked) => {
                  setNotificationsEnabled(checked)
                  toast({
                    title: checked ? "Notifications enabled" : "Notifications disabled",
                    description: checked ? "You'll receive push notifications" : "Push notifications are turned off",
                  })
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="border-0 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-12 bg-transparent"
              onClick={() => setShowLogoutDialog(true)}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Log Out
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12 bg-transparent text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-5 h-5 mr-3" />
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
        photos={user.photos || []}
        onSave={(photos) => handleProfileUpdate({ photos })}
      />

      {/* Logout Confirmation */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out of Violet?</DialogTitle>
            <DialogDescription>
              You'll need to log back in to access your account and continue matching.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
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
              This action cannot be undone. Your profile, matches, and messages will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProfile}>
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
