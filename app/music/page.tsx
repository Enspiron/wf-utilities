'use client';

import { useState, useEffect, useMemo } from 'react';
import { Music2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import AudioPlayer from '@/components/AudioPlayer';

interface MusicTrack {
  path: string;
  name: string;
  category: string;
  subcategory: string;
  url: string;
  fallbackUrls: string[];
}

interface GroupedMusic {
  [category: string]: {
    [subcategory: string]: MusicTrack[];
  };
}

export default function MusicPage() {
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [trackUrls, setTrackUrls] = useState<Record<string, string>>({});
  const [trackUrlIndex, setTrackUrlIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadMusic() {
      setLoading(true);
      try {
        const response = await fetch('/api/music');
        const data = await response.json();
        setAllTracks(data.tracks || []);
        
        // Initialize track URLs with primary URLs and index tracker
        const urls: Record<string, string> = {};
        const indexes: Record<string, number> = {};
        (data.tracks || []).forEach((track: MusicTrack) => {
          urls[track.path] = track.url;
          indexes[track.path] = 0; // Start at primary URL
        });
        setTrackUrls(urls);
        setTrackUrlIndex(indexes);
        
        // Set initial selected category
        if (data.tracks && data.tracks.length > 0) {
          const firstCategory = data.tracks[0].category;
          setSelectedCategory(firstCategory);
        }
      } catch (error) {
        console.error('Error loading music:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMusic();
  }, []);

  // Group tracks by category and subcategory
  const groupedMusic: GroupedMusic = useMemo(() => {
    const groups: GroupedMusic = {};
    
    allTracks.forEach(track => {
      if (!groups[track.category]) {
        groups[track.category] = {};
      }
      if (!groups[track.category][track.subcategory]) {
        groups[track.category][track.subcategory] = [];
      }
      groups[track.category][track.subcategory].push(track);
    });
    
    // Sort tracks within each subcategory
    Object.keys(groups).forEach(category => {
      Object.keys(groups[category]).forEach(subcategory => {
        groups[category][subcategory].sort((a, b) => a.name.localeCompare(b.name));
      });
    });
    
    return groups;
  }, [allTracks]);

  const categories = Object.keys(groupedMusic).sort();
  const subcategories = selectedCategory ? Object.keys(groupedMusic[selectedCategory] || {}).sort() : [];
  const currentTracks = (selectedCategory && selectedSubcategory) 
    ? groupedMusic[selectedCategory]?.[selectedSubcategory] || []
    : [];

  // Auto-select first subcategory when category changes
  useEffect(() => {
    if (selectedCategory && subcategories.length > 0 && !selectedSubcategory) {
      setSelectedSubcategory(subcategories[0]);
    }
  }, [selectedCategory, subcategories, selectedSubcategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <Music2 className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Music Library</h1>
            </div>
            <p className="text-muted-foreground">
              Browse and listen to World Flipper's soundtrack
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              {allTracks.length} tracks available
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Categories Sidebar */}
          <div className="w-64 border-r bg-card flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-sm uppercase text-muted-foreground">Categories</h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedSubcategory('');
                    }}
                  >
                    <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {Object.values(groupedMusic[category] || {}).reduce((sum, tracks) => sum + tracks.length, 0)}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Subcategories Sidebar */}
          {selectedCategory && (
            <div className="w-64 border-r bg-card flex flex-col">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-sm uppercase text-muted-foreground">
                  {selectedCategory.replace(/_/g, ' ')}
                </h2>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {subcategories.map((subcategory) => (
                    <Button
                      key={subcategory}
                      variant={selectedSubcategory === subcategory ? 'default' : 'ghost'}
                      className="w-full justify-start text-left"
                      onClick={() => setSelectedSubcategory(subcategory)}
                    >
                      <span className="capitalize truncate">{subcategory.replace(/_/g, ' ')}</span>
                      <Badge variant="secondary" className="ml-auto shrink-0">
                        {groupedMusic[selectedCategory][subcategory]?.length || 0}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Music List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {currentTracks.length > 0 ? (
              <>
                <div className="p-6 border-b bg-card">
                  <h2 className="text-2xl font-bold capitalize">
                    {selectedSubcategory.replace(/_/g, ' ')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentTracks.length} track{currentTracks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <ScrollArea className="flex-1 p-6">
                  <div className="max-w-4xl mx-auto space-y-4">
                    {currentTracks.map((track) => {
                      const currentUrl = trackUrls[track.path] || track.url;
                      const currentIndex = trackUrlIndex[track.path] || 0;
                      
                      const handleAudioError = () => {
                        console.warn('Audio failed:', currentUrl);
                        
                        // Try next fallback URL if available
                        if (track.fallbackUrls && currentIndex < track.fallbackUrls.length) {
                          const nextUrl = track.fallbackUrls[currentIndex];
                          console.log(`Trying fallback ${currentIndex + 1}/${track.fallbackUrls.length}:`, nextUrl);
                          setTrackUrls(prev => ({
                            ...prev,
                            [track.path]: nextUrl,
                          }));
                          setTrackUrlIndex(prev => ({
                            ...prev,
                            [track.path]: currentIndex + 1,
                          }));
                        } else {
                          console.warn('No available audio sources for:', track.name);
                        }
                      };
                      
                      return (
                        <Card key={track.path}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div>
                                <h3 className="font-semibold capitalize">
                                  {track.name.replace(/_/g, ' ')}
                                </h3>
                                <a 
                                  href={currentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:underline block mt-1"
                                >
                                  {track.path}
                                </a>
                              </div>
                              <AudioPlayer 
                                key={currentUrl}
                                src={currentUrl} 
                                onError={handleAudioError}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Music2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a category to view music tracks</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
