'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Heart, 
  Clock, 
  MessageCircle,
  Sparkles,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { useContract } from '@/hooks/use-contract';
import { useDatingService } from '@/hooks/use-dating-service';
import { FrontendProfile, transformOnChainProfilesToFrontend } from '@/lib/profile-utils';

interface ActivityTabProps {
  user: any;
}

export function ActivityTab({ user }: ActivityTabProps) {
  const [onchainProfiles, setOnchainProfiles] = useState<FrontendProfile[]>([]);
  const [likedProfiles, setLikedProfiles] = useState<FrontendProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [activeSection, setActiveSection] = useState<'profiles' | 'activity' | 'waiting'>('profiles');

  const { getActiveProfiles, isConnected } = useContract();
  const { 
    getRecentEvents, 
    getPendingLikes, 
    getLikesReceived, 
    getMatches 
  } = useDatingService();

  // Fetch onchain profiles
  useEffect(() => {
    async function fetchOnchainProfiles() {
      if (!isConnected) return;
      
      setLoadingProfiles(true);
      try {
        const profiles = await getActiveProfiles(20);
        const transformedProfiles = transformOnChainProfilesToFrontend(profiles);
        setOnchainProfiles(transformedProfiles);
      } catch (error) {
        // Silently handle error
      } finally {
        setLoadingProfiles(false);
      }
    }

    fetchOnchainProfiles();
  }, [isConnected]);

  // Extract liked profiles from event system
  useEffect(() => {
    if (onchainProfiles.length === 0) return;
    
    const pendingLikeEvents = getPendingLikes();
    
    // Map like events to actual profiles
    const pendingLikedProfiles = pendingLikeEvents
      .map(likeEvent => {
        return onchainProfiles.find(profile => 
          profile.walletAddress === likeEvent.data.target
        );
      })
      .filter(Boolean) as FrontendProfile[];
    
    setLikedProfiles(pendingLikedProfiles);
  }, [onchainProfiles.length]);

  const recentEvents = getRecentEvents();
  const matches = getMatches();
  const likesReceived = getLikesReceived();

  const refreshData = async () => {
    if (!isConnected) return;
    
    setLoadingProfiles(true);
    try {
      const profiles = await getActiveProfiles(20);
      const transformedProfiles = transformOnChainProfilesToFrontend(profiles);
      setOnchainProfiles(transformedProfiles);
    } catch (error) {
      // Silently handle error
    } finally {
      setLoadingProfiles(false);
    }
  };

  const sections = [
    { 
      id: 'profiles' as const, 
      label: 'Profiles', 
      icon: Users, 
      count: onchainProfiles.length,
      color: 'text-blue-500'
    },
    { 
      id: 'waiting' as const, 
      label: 'Waiting', 
      icon: Clock, 
      count: likedProfiles.length,
      color: 'text-amber-500'
    },
    { 
      id: 'activity' as const, 
      label: 'Activity', 
      icon: MessageCircle, 
      count: recentEvents.length,
      color: 'text-purple-500'
    },
  ];

  return (
    <div className='flex-1 overflow-hidden flex flex-col'>
      {/* Header */}
      <div className='p-4 border-b border-border bg-gradient-to-r from-background via-card/80 to-primary/5'>
        <div className="flex items-center justify-between">
          <div>
            <h1 className='text-2xl font-bold'>Activity</h1>
            <p className='text-sm text-muted-foreground'>Your dating activity</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={loadingProfiles}
          >
            <RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className='px-4 py-2 border-b border-border bg-card/50'>
        <div className='flex gap-2 overflow-x-auto'>
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : section.color}`} />
                <span className='font-medium'>{section.label}</span>
                <Badge variant={isActive ? 'default' : 'secondary'} className='text-xs'>
                  {section.count}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {/* Matches at top if any */}
        {matches.length > 0 && (
          <Card className='border-primary/20 bg-gradient-to-r from-primary/5 to-pink-500/5'>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-500" />
                🎉 Recent Matches
                <Badge variant="secondary" className="ml-auto bg-pink-500/10 text-pink-600">
                  {matches.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.slice(0, 3).map((match, index) => (
                <div key={`activity-match-${match.id}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-black/20 cursor-pointer">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                      {match.data?.profileNames?.userA?.charAt(0) || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {match.data?.profileNames?.userA || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(match.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <MessageCircle className="w-5 h-5 text-green-500" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dynamic Content Based on Active Section */}
        {activeSection === 'profiles' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Onchain Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProfiles ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : onchainProfiles.length > 0 ? (
                <div className="space-y-3">
                  {onchainProfiles.map((profile, index) => (
                    <div key={`activity-onchain-${profile.id}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {profile.avatarUrl ? (
                          <img 
                            src={profile.avatarUrl} 
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-medium">
                            {profile.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.name}</p>
                        <p className="text-sm text-muted-foreground">{profile.age} • {profile.location}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.bio}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {profile.age}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">No profiles found</p>
                  <p className="text-sm text-muted-foreground">Profiles will appear here as users join</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeSection === 'waiting' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Waiting for Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              {likedProfiles.length > 0 ? (
                <div className="space-y-3">
                  {likedProfiles.map((profile, index) => (
                    <div key={`activity-liked-${profile.id}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {profile.avatarUrl ? (
                          <img 
                            src={profile.avatarUrl} 
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                            {profile.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.name}</p>
                        <p className="text-sm text-muted-foreground">{profile.age} • {profile.location}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Heart className="w-3 h-3 text-pink-500 fill-current" />
                          <span className="text-xs text-pink-600">Liked</span>
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse ml-2"></div>
                        </div>
                      </div>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">No pending likes</p>
                  <p className="text-sm text-muted-foreground">Profiles you've liked will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeSection === 'activity' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-purple-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length > 0 ? (
                <div className="space-y-3">
                  {recentEvents.map((event, index) => (
                    <div key={`activity-event-${event.id}-${index}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        {event.type === 'like_submitted' && <Heart className="w-4 h-4 text-pink-500" />}
                        {event.type === 'match_found' && <Sparkles className="w-4 h-4 text-yellow-500" />}
                        {event.type === 'session_created' && <Users className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {event.type === 'like_submitted' && '💕 Like sent'}
                          {event.type === 'match_found' && '🎉 New match!'}
                          {event.type === 'session_created' && '🔄 Session created'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                        {event.data && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.type === 'like_submitted' && `Target: ${event.data.profileName || 'Unknown'}`}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant={event.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {event.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">No recent activity</p>
                  <p className="text-sm text-muted-foreground">Your activity will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
