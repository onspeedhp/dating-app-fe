"use client"

import { useState, useEffect } from "react"
import { SwipeCard } from "@/components/swipe-card"
import { MatchOverlay } from "@/components/match-overlay"
import { ProfileCardSkeleton } from "@/components/loading-skeleton"
import { Button } from "@/components/ui/button"
import { X, Heart, Star, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { mockProfiles, type Profile } from "@/lib/mock-data"

interface DiscoverTabProps {
  user: any
}

export function DiscoverTab({ user }: DiscoverTabProps) {
  const [profiles, setProfiles] = useState<Profile[]>(mockProfiles)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showMatch, setShowMatch] = useState(false)
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const currentProfile = profiles[currentIndex]

  const handleSwipe = (direction: "left" | "right", profile: Profile) => {
    if (isAnimating) return

    setIsAnimating(true)

    if (direction === "right") {
      // Like action
      toast({
        title: "Liked!",
        description: `You liked ${profile.name}`,
        duration: 2000,
      })

      // Check if it's a match
      if (profile.isMatch) {
        setMatchedProfile(profile)
        setShowMatch(true)
      }
    } else {
      // Pass action
      toast({
        title: "Passed",
        description: `You passed on ${profile.name}`,
        duration: 2000,
      })
    }

    // Move to next profile after animation
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setIsAnimating(false)
    }, 300)
  }

  const handleButtonAction = (action: "pass" | "like" | "superlike") => {
    if (!currentProfile || isAnimating) return

    switch (action) {
      case "pass":
        handleSwipe("left", currentProfile)
        break
      case "like":
        handleSwipe("right", currentProfile)
        break
      case "superlike":
        toast({
          title: "Super Like!",
          description: "This feature is coming soon",
          duration: 2000,
        })
        break
    }
  }

  const handleMatchClose = () => {
    setShowMatch(false)
    setMatchedProfile(null)
  }

  const resetStack = () => {
    setCurrentIndex(0)
    setProfiles([...mockProfiles])
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Stack refreshed!",
        description: "New profiles are ready to discover",
      })
    }, 1000)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold">Discover</h1>
            <p className="text-sm text-muted-foreground">Loading new profiles...</p>
          </div>
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground fill-current" />
          </div>
        </div>

        <div className="flex-1 relative px-4 pb-4">
          <div className="relative w-full h-full max-w-sm mx-auto">
            <ProfileCardSkeleton />
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 p-6">
          <div className="w-14 h-14 bg-muted rounded-full animate-pulse"></div>
          <div className="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
          <div className="w-14 h-14 bg-muted rounded-full animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No more profiles!</h2>
        <p className="text-muted-foreground mb-8 max-w-sm">
          You've seen everyone in your area. Check back later for new profiles or expand your search radius.
        </p>
        <Button onClick={resetStack} size="lg" className="rounded-2xl">
          <RotateCcw className="w-5 h-5 mr-2" />
          Refresh Stack
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div>
          <h1 className="text-2xl font-bold">Discover</h1>
          <p className="text-sm text-muted-foreground">Find your perfect match</p>
        </div>
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
          <Heart className="w-5 h-5 text-primary-foreground fill-current" />
        </div>
      </div>

      {/* Card Stack */}
      <div className="flex-1 relative px-4 pb-4">
        <div className="relative w-full h-full max-w-sm mx-auto">
          {/* Show next 2 cards in background for depth */}
          {profiles.slice(currentIndex, currentIndex + 3).map((profile, index) => (
            <SwipeCard
              key={`${profile.id}-${currentIndex}`}
              profile={profile}
              onSwipe={(direction) => handleSwipe(direction, profile)}
              isTop={index === 0}
              zIndex={3 - index}
              scale={1 - index * 0.05}
              translateY={index * 8}
              disabled={index !== 0 || isAnimating}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-6 p-6">
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full border-2 border-destructive/20 hover:border-destructive hover:bg-destructive/10 bg-transparent"
          onClick={() => handleButtonAction("pass")}
          disabled={!currentProfile || isAnimating}
        >
          <X className="w-6 h-6 text-destructive" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full border-2 border-primary/20 hover:border-primary hover:bg-primary/10 bg-transparent"
          onClick={() => handleButtonAction("superlike")}
          disabled={!currentProfile || isAnimating}
        >
          <Star className="w-5 h-5 text-primary" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full border-2 border-primary/20 hover:border-primary hover:bg-primary/10 bg-transparent"
          onClick={() => handleButtonAction("like")}
          disabled={!currentProfile || isAnimating}
        >
          <Heart className="w-6 h-6 text-primary fill-current" />
        </Button>
      </div>

      {/* Match Overlay */}
      {showMatch && matchedProfile && <MatchOverlay profile={matchedProfile} onClose={handleMatchClose} />}
    </div>
  )
}
