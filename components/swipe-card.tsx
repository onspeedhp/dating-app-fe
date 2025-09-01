"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Briefcase, GraduationCap } from "lucide-react"
import type { Profile } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface SwipeCardProps {
  profile: Profile
  onSwipe: (direction: "left" | "right") => void
  isTop: boolean
  zIndex: number
  scale: number
  translateY: number
  disabled: boolean
}

export function SwipeCard({ profile, onSwipe, isTop, zIndex, scale, translateY, disabled }: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleStart = (clientX: number, clientY: number) => {
    if (!isTop || disabled) return
    setIsDragging(true)
    setStartPos({ x: clientX, y: clientY })
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !isTop || disabled) return

    const deltaX = clientX - startPos.x
    const deltaY = clientY - startPos.y

    setDragOffset({ x: deltaX, y: deltaY })
  }

  const handleEnd = () => {
    if (!isDragging || !isTop || disabled) return

    const threshold = 100
    const { x } = dragOffset

    if (Math.abs(x) > threshold) {
      onSwipe(x > 0 ? "right" : "left")
    }

    setIsDragging(false)
    setDragOffset({ x: 0, y: 0 })
  }

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY)
      }

      const handleGlobalMouseUp = () => {
        handleEnd()
      }

      document.addEventListener("mousemove", handleGlobalMouseMove)
      document.addEventListener("mouseup", handleGlobalMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove)
        document.removeEventListener("mouseup", handleGlobalMouseUp)
      }
    }
  }, [isDragging, startPos])

  const rotation = isDragging ? dragOffset.x * 0.1 : 0
  const opacity = Math.abs(dragOffset.x) > 50 ? 0.8 : 1

  return (
    <Card
      ref={cardRef}
      className={cn(
        "absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden border-0 shadow-2xl",
        isDragging && "transition-none",
        !isDragging && "transition-all duration-300 ease-out",
      )}
      style={{
        transform: `translate(${dragOffset.x}px, ${dragOffset.y + translateY}px) rotate(${rotation}deg) scale(${scale})`,
        zIndex,
        opacity,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <CardContent className="p-0 h-full">
        <div className="relative h-full">
          {/* Main Photo */}
          <div className="h-2/3 relative overflow-hidden rounded-t-xl">
            <img
              src={profile.photos[0] || "/placeholder.svg?height=600&width=400&query=profile photo"}
              alt={profile.name}
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Swipe Indicators */}
            {isDragging && (
              <>
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity",
                    dragOffset.x > 50 ? "opacity-100" : "opacity-0",
                  )}
                  style={{ backgroundColor: "rgba(34, 197, 94, 0.8)" }}
                >
                  <div className="text-white text-4xl font-bold transform rotate-12">LIKE</div>
                </div>
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity",
                    dragOffset.x < -50 ? "opacity-100" : "opacity-0",
                  )}
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.8)" }}
                >
                  <div className="text-white text-4xl font-bold transform -rotate-12">PASS</div>
                </div>
              </>
            )}
          </div>

          {/* Profile Info */}
          <div className="h-1/3 p-6 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-2xl font-bold text-card-foreground">{profile.name}</h3>
              <span className="text-xl text-muted-foreground">{profile.age}</span>
            </div>

            <div className="flex items-center gap-1 mb-3 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{profile.city}</span>
            </div>

            {(profile.work || profile.school) && (
              <div className="flex items-center gap-1 mb-3 text-muted-foreground">
                {profile.work ? <Briefcase className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                <span className="text-sm">
                  {profile.work && profile.company
                    ? `${profile.work} at ${profile.company}`
                    : profile.school
                      ? `Student at ${profile.school}`
                      : profile.work}
                </span>
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{profile.bio}</p>

            <div className="flex flex-wrap gap-1">
              {profile.interests.slice(0, 3).map((interest) => (
                <Badge key={interest} variant="secondary" className="text-xs px-2 py-1 rounded-full">
                  {interest}
                </Badge>
              ))}
              {profile.interests.length > 3 && (
                <Badge variant="secondary" className="text-xs px-2 py-1 rounded-full">
                  +{profile.interests.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
