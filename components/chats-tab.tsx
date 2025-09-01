"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageCircle, Heart } from "lucide-react"
import { ChatThread } from "@/components/chat-thread"
import { mockChats, mockProfiles, type Chat } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { ChatListSkeleton } from "@/components/loading-skeleton"

interface ChatsTabProps {
  user: any
}

export function ChatsTab({ user }: ChatsTabProps) {
  const [chats, setChats] = useState<Chat[]>(mockChats)
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const getMatchProfile = (matchId: string) => {
    return mockProfiles.find((profile) => profile.id === matchId)
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return "now"
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return timestamp.toLocaleDateString()
  }

  const handleSendMessage = (chatId: string, message: string) => {
    const newMessage = {
      id: Date.now().toString(),
      senderId: "me",
      text: message,
      timestamp: new Date(),
    }

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, newMessage],
              lastMessage: newMessage,
            }
          : chat,
      ),
    )

    // Update selected chat if it's the current one
    if (selectedChat?.id === chatId) {
      setSelectedChat((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, newMessage],
              lastMessage: newMessage,
            }
          : null,
      )
    }
  }

  const handleChatSelect = (chat: Chat) => {
    // Mark as read
    const updatedChat = { ...chat, unreadCount: 0 }
    setChats((prevChats) => prevChats.map((c) => (c.id === chat.id ? updatedChat : c)))
    setSelectedChat(updatedChat)
  }

  if (selectedChat) {
    const matchProfile = getMatchProfile(selectedChat.matchId)
    return (
      <ChatThread
        chat={selectedChat}
        matchProfile={matchProfile}
        onBack={() => setSelectedChat(null)}
        onSendMessage={(message) => handleSendMessage(selectedChat.id, message)}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-sm text-muted-foreground">Loading your matches...</p>
          </div>
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChatListSkeleton />
        </div>
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <MessageCircle className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No matches yet</h2>
        <p className="text-muted-foreground mb-8 max-w-sm">
          Start swiping to find people you like. When you match, you'll be able to chat here!
        </p>
        <Button className="rounded-2xl">
          <Heart className="w-5 h-5 mr-2 fill-current" />
          Start Discovering
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">{chats.length} matches</p>
        </div>
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-4">
          {chats.map((chat) => {
            const matchProfile = getMatchProfile(chat.matchId)
            const lastMessage = chat.messages[chat.messages.length - 1]

            if (!matchProfile) return null

            return (
              <Card
                key={chat.id}
                className="border-0 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                onClick={() => handleChatSelect(chat)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full overflow-hidden">
                        <img
                          src={matchProfile.photos[0] || "/placeholder.svg?height=56&width=56&query=profile photo"}
                          alt={matchProfile.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {chat.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-xs text-primary-foreground font-bold">{chat.unreadCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-card-foreground truncate">{matchProfile.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {lastMessage && formatTimestamp(lastMessage.timestamp)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-sm truncate",
                          chat.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground",
                        )}
                      >
                        {lastMessage?.senderId === "me" ? "You: " : ""}
                        {lastMessage?.text || "Say hello!"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
