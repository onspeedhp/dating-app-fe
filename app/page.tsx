"use client"

import { useState } from "react"
import { LandingScreen } from "@/components/landing-screen"
import { AuthScreen } from "@/components/auth-screen"
import { OnboardingFlow } from "@/components/onboarding-flow"
import { MainApp } from "@/components/main-app"
import { Toaster } from "@/components/ui/toaster"

type AppState = "landing" | "auth" | "onboarding" | "main"
type AuthMode = "login" | "signup"

export default function App() {
  const [appState, setAppState] = useState<AppState>("landing")
  const [authMode, setAuthMode] = useState<AuthMode>("login")
  const [user, setUser] = useState<any>(null)

  const handleAuthSuccess = (userData: any) => {
    setUser(userData)
    setAppState("onboarding")
  }

  const handleOnboardingComplete = (profileData: any) => {
    setUser({ ...user, ...profileData, onboardingComplete: true })
    setAppState("main")
  }

  const handleLogout = () => {
    setUser(null)
    setAppState("landing")
  }

  const handleDeleteProfile = () => {
    setUser(null)
    setAppState("landing")
  }

  return (
    <div className="min-h-screen bg-background">
      {appState === "landing" && (
        <LandingScreen
          onLogin={() => {
            setAuthMode("login")
            setAppState("auth")
          }}
          onSignup={() => {
            setAuthMode("signup")
            setAppState("auth")
          }}
        />
      )}

      {appState === "auth" && (
        <AuthScreen
          mode={authMode}
          onSuccess={handleAuthSuccess}
          onBack={() => setAppState("landing")}
          onSwitchMode={() => setAuthMode(authMode === "login" ? "signup" : "login")}
        />
      )}

      {appState === "onboarding" && <OnboardingFlow onComplete={handleOnboardingComplete} user={user} />}

      {appState === "main" && (
        <MainApp
          user={user}
          onLogout={handleLogout}
          onDeleteProfile={handleDeleteProfile}
          onUpdateProfile={(updates: any) => setUser({ ...user, ...updates })}
        />
      )}

      <Toaster />
    </div>
  )
}
