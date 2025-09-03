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
  RefreshCw
} from 'lucide-react';
import { useContract } from '@/hooks/use-contract';
import { useDatingService } from '@/hooks/use-dating-service';
import { FrontendProfile, transformOnChainProfilesToFrontend } from '@/lib/profile-utils';

interface ActivitySidebarProps {
  className?: string;
}

export function ActivitySidebar({ className }: ActivitySidebarProps) {
  const [onchainProfiles, setOnchainProfiles] = useState<FrontendProfile[]>([]);
  const [likedProfiles, setLikedProfiles] = useState<FrontendProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

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
        const profiles = await getActiveProfiles(10);
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
      const profiles = await getActiveProfiles(10);
      const transformedProfiles = transformOnChainProfilesToFrontend(profiles);
      setOnchainProfiles(transformedProfiles);
    } catch (error) {
      // Silently handle error
    } finally {
      setLoadingProfiles(false);
    }
  };

  return (
    <div className={`w-80 bg-background border-l border-border overflow-y-auto custom-scrollbar ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Activity</h2>
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

      <div className="p-4 space-y-6">
        {/* Recent Matches */}
        {matches.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-500" />
                Recent Matches
                <Badge variant="secondary" className="ml-auto">
                  {matches.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.slice(0, 3).map((match, index) => (
                <div key={`sidebar-match-${match.id}-${index}`} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                      {match.data?.profileNames?.userA?.charAt(0) || '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {match.data?.profileNames?.userA || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(match.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <MessageCircle className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Waiting for Response */}
        {likedProfiles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Waiting for Response
                <Badge variant="secondary" className="ml-auto">
                  {likedProfiles.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {likedProfiles.map((profile, index) => (
                <div key={`sidebar-liked-${profile.id}-${index}`} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {profile.avatarUrl ? (
                      <img 
                        src={profile.avatarUrl} 
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                        {profile.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">{profile.location}</p>
                  </div>
                  <Heart className="w-4 h-4 text-pink-500 fill-current" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Onchain Profiles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Onchain Profiles
              <Badge variant="secondary" className="ml-auto">
                {onchainProfiles.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingProfiles ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-muted rounded animate-pulse" />
                      <div className="h-2 bg-muted rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : onchainProfiles.length > 0 ? (
              onchainProfiles.slice(0, 8).map((profile, index) => (
                <div key={`sidebar-onchain-${profile.id}-${index}`} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all duration-200 cursor-pointer">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {profile.avatarUrl ? (
                      <img 
                        src={profile.avatarUrl} 
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xs font-medium">
                        {profile.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">{profile.location}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {profile.age}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No profiles found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentEvents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                Recent Activity
                <Badge variant="secondary" className="ml-auto">
                  {recentEvents.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentEvents.slice(0, 5).map((event, index) => (
                <div key={`sidebar-event-${event.id}-${index}`} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {event.type === 'like_submitted' && <Heart className="w-3 h-3 text-pink-500" />}
                    {event.type === 'match_found' && <Sparkles className="w-3 h-3 text-yellow-500" />}
                    {event.type === 'session_created' && <Users className="w-3 h-3 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">
                      {event.type === 'like_submitted' && 'Like sent'}
                      {event.type === 'match_found' && 'New match!'}
                      {event.type === 'session_created' && 'Session created'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge 
                    variant={event.status === 'completed' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {event.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
