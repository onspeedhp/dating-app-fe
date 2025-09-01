"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  className?: string
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="bg-muted rounded-md h-4 w-full"></div>
    </div>
  )
}

export function ProfileCardSkeleton() {
  return (
    <Card className="absolute inset-0 border-0 shadow-2xl">
      <CardContent className="p-0 h-full">
        <div className="relative h-full animate-pulse">
          {/* Photo Skeleton */}
          <div className="h-2/3 bg-muted rounded-t-xl"></div>

          {/* Info Skeleton */}
          <div className="h-1/3 p-6 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 bg-muted rounded w-24"></div>
              <div className="h-6 bg-muted rounded w-8"></div>
            </div>
            <div className="h-4 bg-muted rounded w-20"></div>
            <div className="h-4 bg-muted rounded w-32"></div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded w-full"></div>
              <div className="h-3 bg-muted rounded w-3/4"></div>
            </div>
            <div className="flex gap-1">
              <div className="h-6 bg-muted rounded-full w-16"></div>
              <div className="h-6 bg-muted rounded-full w-20"></div>
              <div className="h-6 bg-muted rounded-full w-14"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ChatListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} className="border-0 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-14 h-14 bg-muted rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-3 bg-muted rounded w-12"></div>
                </div>
                <div className="h-3 bg-muted rounded w-32"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
