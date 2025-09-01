"use client"

import { useState } from "react"
import { DiscoverTab } from "@/components/discover-tab"
import { ChatsTab } from "@/components/chats-tab"
import { ProfileTab } from "@/components/profile-tab"
import { MessageCircle, User, Compass } from "lucide-react"
import { cn } from "@/lib/utils"

interface MainAppProps {
  user: any
  onLogout: () => void
  onDeleteProfile: () => void
  onUpdateProfile: (updates: any) => void
}

type Tab = "discover" | "chats" | "profile"

export function MainApp({ user, onLogout, onDeleteProfile, onUpdateProfile }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>("discover")

  const tabs = [
    { id: "discover" as Tab, label: "Discover", icon: Compass },
    { id: "chats" as Tab, label: "Chats", icon: MessageCircle },
    { id: "profile" as Tab, label: "Profile", icon: User },
  ]

  const renderActiveTab = () => {
    switch (activeTab) {
      case "discover":
        return <DiscoverTab user={user} />
      case "chats":
        return <ChatsTab user={user} />
      case "profile":
        return (
          <ProfileTab
            user={user}
            onLogout={onLogout}
            onDeleteProfile={onDeleteProfile}
            onUpdateProfile={onUpdateProfile}
          />
        )
      default:
        return <DiscoverTab user={user} />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">{renderActiveTab()}</div>

      {/* Bottom Navigation */}
      <div className="border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-colors",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className={cn("w-6 h-6 mb-1", isActive && "fill-current")} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
