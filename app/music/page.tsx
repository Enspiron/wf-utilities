'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Disc3,
  ExternalLink,
  Filter,
  Gauge,
  Headphones,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface MusicTrack {
  path: string;
  name: string;
  category: string;
  subcategory: string;
  url: string;
  fallbackUrls: string[];
  artworkUrl: string | null;
  artworkUrls: string[];
  artworkKind: 'character' | 'event' | 'world' | 'quest' | 'fallback';
  volume: number | null;
  bpm: number | null;
  trimStart: number | null;
  loopStart: number | null;
  loopEnd: number | null;
  timingGroup: number | null;
}

type SortMode = 'name_asc' | 'name_desc' | 'category' | 'path';
type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

const PAGE_SIZE = 60;
const CATEGORY_PREVIEW_LIMIT = 8;

function toDisplayLabel(value: string): string {
  return value.replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTrackSources(track: MusicTrack): string[] {
  const ordered = [track.url, ...(track.fallbackUrls || [])].filter((value) => !!value);
  return [...new Set(ordered)];
}

function getSourceLabel(index: number): string {
  if (index <= 0) return 'Primary';
  return `Fallback ${index}`;
}

function getTempoLabel(bpm: number | null): string {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm)) return 'Unknown';
  if (bpm >= 155) return 'Rush';
  if (bpm >= 120) return 'Drive';
  if (bpm >= 90) return 'Pulse';
  return 'Drift';
}

function getArtworkSources(track: MusicTrack | null): string[] {
  if (!track) return [];
  const ordered = [track.artworkUrl, ...(track.artworkUrls || [])].filter((value): value is string => !!value);
  return [...new Set(ordered)];
}

function getArtworkLabel(kind: MusicTrack['artworkKind']): string {
  if (kind === 'character') return 'Character art';
  if (kind === 'event') return 'Event art';
  if (kind === 'world') return 'World art';
  if (kind === 'quest') return 'Quest art';
  return 'Library art';
}

function TrackArtwork({
  track,
  size = 'md',
  active = false,
}: {
  track: MusicTrack | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  active?: boolean;
}) {
  const sources = useMemo(() => getArtworkSources(track), [track]);
  const sourceKey = sources.join('|');
  const [failedArtwork, setFailedArtwork] = useState({ key: '', index: 0 });
  const sourceIndex = failedArtwork.key === sourceKey ? failedArtwork.index : 0;
  const activeSource = sources[sourceIndex];
  const sizeClass =
    size === 'lg' ? 'h-24 w-24' : size === 'md' ? 'h-14 w-14' : size === 'sm' ? 'h-10 w-10' : 'h-6 w-6';
  const iconClass = size === 'lg' ? 'h-10 w-10' : size === 'xs' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <div
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40',
        sizeClass,
        track?.artworkKind === 'character' ? 'border-primary/30' : 'border-border',
        active && 'ring-2 ring-primary/35'
      )}
    >
      {activeSource ? (
        <Image
          src={activeSource}
          alt={track ? `${toDisplayLabel(track.name)} artwork` : 'Music artwork'}
          fill
          sizes={size === 'lg' ? '96px' : size === 'md' ? '56px' : size === 'sm' ? '40px' : '24px'}
          className='object-cover'
          unoptimized
          onError={() =>
            setFailedArtwork((prev) => ({
              key: sourceKey,
              index: prev.key === sourceKey ? prev.index + 1 : 1,
            }))
          }
        />
      ) : (
        <Music2 className={cn('text-muted-foreground', iconClass)} />
      )}
      <div className='absolute inset-x-0 bottom-0 h-1 bg-primary/80' />
    </div>
  );
}

function LibraryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ListMusic;
  label: string;
  value: string;
}) {
  return (
    <div className='rounded-lg border bg-background/70 p-3'>
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Icon className='h-3.5 w-3.5' />
        <span>{label}</span>
      </div>
      <div className='mt-1 text-lg font-semibold'>{value}</div>
    </div>
  );
}

function QueuePanel({
  queueTracks,
  activePath,
  queueCursor,
  onPlayFromQueue,
  onRemoveFromQueue,
  onClearQueue,
  className,
}: {
  queueTracks: MusicTrack[];
  activePath: string | null;
  queueCursor: number;
  onPlayFromQueue: (index: number, path: string) => void;
  onRemoveFromQueue: (path: string) => void;
  onClearQueue: () => void;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-h-[320px] flex-col overflow-hidden border-border/70 bg-card/95', className)}>
      <CardHeader className='border-b pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <ListMusic className='h-4 w-4 text-primary' />
              Queue
            </CardTitle>
            <CardDescription>{queueTracks.length} tracks ready</CardDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            disabled={queueTracks.length === 0}
            onClick={onClearQueue}
            className='gap-1.5'
          >
            <Trash2 className='h-3.5 w-3.5' />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className='min-h-0 flex-1'>
        {queueTracks.length === 0 ? (
          <div className='flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground'>
            <TrackArtwork track={null} size='md' />
            <span>Build a queue from the track list.</span>
          </div>
        ) : (
          <ScrollArea className='h-[360px] pr-2'>
            <div className='space-y-1.5'>
              {queueTracks.map((track, index) => {
                const isActive = activePath === track.path || queueCursor === index;
                return (
                  <div
                    key={`${track.path}-${index}`}
                    className={cn(
                      'rounded-lg border p-2 transition',
                      isActive ? 'border-primary bg-primary/10' : 'bg-background/60 hover:bg-accent/40'
                    )}
                  >
                    <div className='flex items-center gap-2'>
                      <Button
                        type='button'
                        variant={isActive ? 'default' : 'outline'}
                        size='icon'
                        className='h-8 w-8 shrink-0'
                        onClick={() => onPlayFromQueue(index, track.path)}
                        title='Play from queue'
                      >
                        <Play className='h-3.5 w-3.5' />
                      </Button>
                      <TrackArtwork track={track} size='sm' active={isActive} />
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>{toDisplayLabel(track.name)}</p>
                        <p className='truncate text-[11px] text-muted-foreground'>
                          {track.category} / {track.subcategory}
                        </p>
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 shrink-0'
                        onClick={() => onRemoveFromQueue(track.path)}
                        title='Remove from queue'
                      >
                        <X className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default function MusicPage() {
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('name_asc');
  const [fallbackOnly, setFallbackOnly] = useState(false);
  const [failedOnly, setFailedOnly] = useState(false);
  const [compactRows, setCompactRows] = useState(false);
  const [page, setPage] = useState(1);

  const [queue, setQueue] = useState<string[]>([]);
  const [queueCursor, setQueueCursor] = useState(-1);
  const [showMobileQueue, setShowMobileQueue] = useState(false);

  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [playState, setPlayState] = useState<PlayerState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const [sourceIndexByPath, setSourceIndexByPath] = useState<Record<string, number>>({});
  const [failedPaths, setFailedPaths] = useState<Set<string>>(new Set());
  const [durationByPath, setDurationByPath] = useState<Record<string, number>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const playRequestIdRef = useRef(0);
  const activePathRef = useRef<string | null>(null);
  const activeSourceIndexRef = useRef(0);
  const loopEnabledRef = useRef(false);
  const activeLoopStartRef = useRef<number | null>(null);
  const activeLoopEndRef = useRef<number | null>(null);

  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  useEffect(() => {
    activeSourceIndexRef.current = activeSourceIndex;
  }, [activeSourceIndex]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  useEffect(() => {
    async function loadMusic() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/music', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = (await response.json()) as { tracks?: MusicTrack[] };
        setAllTracks(data.tracks || []);
      } catch (loadError) {
        console.error('Failed to load music page data:', loadError);
        setAllTracks([]);
        setError('Failed to load music library.');
      } finally {
        setLoading(false);
      }
    }

    void loadMusic();
  }, []);

  const trackByPath = useMemo(() => {
    return new Map(allTracks.map((track) => [track.path, track]));
  }, [allTracks]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const track of allTracks) {
      map.set(track.category, (map.get(track.category) || 0) + 1);
    }
    return map;
  }, [allTracks]);

  const categories = useMemo(() => {
    return [...categoryCounts.keys()].sort((a, b) => a.localeCompare(b));
  }, [categoryCounts]);

  const subcategoriesByCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const track of allTracks) {
      const list = map.get(track.category) || [];
      if (!list.includes(track.subcategory)) list.push(track.subcategory);
      map.set(track.category, list);
    }
    for (const [category, list] of map.entries()) {
      map.set(category, [...list].sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [allTracks]);

  const subcategoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const track of allTracks) {
      if (categoryFilter !== 'all' && track.category !== categoryFilter) continue;
      map.set(track.subcategory, (map.get(track.subcategory) || 0) + 1);
    }
    return map;
  }, [allTracks, categoryFilter]);

  const subcategories = useMemo(() => {
    return [...subcategoryCounts.keys()].sort((a, b) => a.localeCompare(b));
  }, [subcategoryCounts]);

  const safeSubcategoryFilter =
    subcategoryFilter !== 'all' && !subcategories.includes(subcategoryFilter) ? 'all' : subcategoryFilter;

  const fallbackCapableCount = useMemo(() => {
    return allTracks.filter((track) => getTrackSources(track).length > 1).length;
  }, [allTracks]);

  const loopTrackCount = useMemo(() => {
    return allTracks.filter((track) => typeof track.loopStart === 'number' && Number.isFinite(track.loopStart)).length;
  }, [allTracks]);

  const bpmTrackCount = useMemo(() => {
    return allTracks.filter((track) => typeof track.bpm === 'number' && Number.isFinite(track.bpm)).length;
  }, [allTracks]);

  const categoryPreview = useMemo(() => {
    return [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, CATEGORY_PREVIEW_LIMIT);
  }, [categoryCounts]);

  const categoryArtworkTracks = useMemo(() => {
    const rankArtwork = (track: MusicTrack) => {
      if (track.artworkKind === 'character') return 5;
      if (track.artworkKind === 'event' || track.artworkKind === 'world') return 4;
      if (track.artworkKind === 'quest') return 3;
      return 1;
    };

    const map = new Map<string, MusicTrack>();
    for (const track of allTracks) {
      const current = map.get(track.category);
      if (!current || rankArtwork(track) > rankArtwork(current)) {
        map.set(track.category, track);
      }
    }
    return map;
  }, [allTracks]);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allTracks.filter((track) => {
      if (categoryFilter !== 'all' && track.category !== categoryFilter) return false;
      if (safeSubcategoryFilter !== 'all' && track.subcategory !== safeSubcategoryFilter) return false;
      if (fallbackOnly && getTrackSources(track).length <= 1) return false;
      if (failedOnly && !failedPaths.has(track.path)) return false;

      if (!q) return true;
      const hay = `${track.name} ${track.path} ${track.category} ${track.subcategory}`.toLowerCase();
      return hay.includes(q);
    });

    filtered.sort((a, b) => {
      if (sortMode === 'name_desc') return toDisplayLabel(b.name).localeCompare(toDisplayLabel(a.name));
      if (sortMode === 'category') {
        const categoryDiff = a.category.localeCompare(b.category);
        if (categoryDiff !== 0) return categoryDiff;
        const subcategoryDiff = a.subcategory.localeCompare(b.subcategory);
        if (subcategoryDiff !== 0) return subcategoryDiff;
        return toDisplayLabel(a.name).localeCompare(toDisplayLabel(b.name));
      }
      if (sortMode === 'path') return a.path.localeCompare(b.path);
      return toDisplayLabel(a.name).localeCompare(toDisplayLabel(b.name));
    });

    return filtered;
  }, [
    allTracks,
    categoryFilter,
    failedOnly,
    failedPaths,
    fallbackOnly,
    safeSubcategoryFilter,
    search,
    sortMode,
  ]);

  const playbackOrderPaths = useMemo(() => {
    const source = filteredTracks.length > 0 ? filteredTracks : allTracks;
    return source.map((track) => track.path);
  }, [allTracks, filteredTracks]);

  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleTracks = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTracks.slice(start, start + PAGE_SIZE);
  }, [filteredTracks, safePage]);

  const queueSet = useMemo(() => new Set(queue), [queue]);
  const queueTracks = useMemo(() => {
    return queue.map((path) => trackByPath.get(path)).filter((track): track is MusicTrack => !!track);
  }, [queue, trackByPath]);

  const activeTrack = useMemo(() => {
    return activePath ? trackByPath.get(activePath) || null : null;
  }, [activePath, trackByPath]);

  const displayTrack = activeTrack || visibleTracks[0] || allTracks[0] || null;

  const activeTrackSources = useMemo(() => {
    return activeTrack ? getTrackSources(activeTrack) : [];
  }, [activeTrack]);

  const activeLoopStart = useMemo(() => {
    if (!activeTrack || typeof activeTrack.loopStart !== 'number') return null;
    if (!Number.isFinite(activeTrack.loopStart) || activeTrack.loopStart < 0) return null;
    return activeTrack.loopStart;
  }, [activeTrack]);

  const activeLoopEnd = useMemo(() => {
    if (activeLoopStart === null) return null;
    if (
      activeTrack &&
      typeof activeTrack.loopEnd === 'number' &&
      Number.isFinite(activeTrack.loopEnd) &&
      activeTrack.loopEnd > activeLoopStart + 0.01
    ) {
      return activeTrack.loopEnd;
    }
    if (Number.isFinite(duration) && duration > activeLoopStart + 0.01) {
      return duration;
    }
    return null;
  }, [activeLoopStart, activeTrack, duration]);

  const loopReady = activeLoopStart !== null;

  useEffect(() => {
    activeLoopStartRef.current = activeLoopStart;
    activeLoopEndRef.current = activeLoopEnd;
  }, [activeLoopEnd, activeLoopStart]);

  const activeTrackUrl =
    activeTrackSources[Math.min(activeSourceIndex, Math.max(activeTrackSources.length - 1, 0))] || '';
  const activeProgressPercent =
    activeTrack && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const playTrackByPath = useCallback(
    (path: string, preferredSourceIndex?: number) => {
      const audio = audioRef.current;
      const track = trackByPath.get(path);
      if (!audio || !track) return;

      const sources = getTrackSources(track);
      if (sources.length === 0) {
        setFailedPaths((prev) => {
          if (prev.has(path)) return prev;
          const next = new Set(prev);
          next.add(path);
          return next;
        });
        setPlayState('error');
        return;
      }

      const rememberedSourceIndex = sourceIndexByPath[path] ?? 0;
      const startIndex = Math.max(0, Math.min(preferredSourceIndex ?? rememberedSourceIndex, sources.length - 1));
      const requestId = playRequestIdRef.current + 1;
      playRequestIdRef.current = requestId;

      const attemptSource = async (sourceIndex: number): Promise<void> => {
        if (requestId !== playRequestIdRef.current) return;
        if (sourceIndex >= sources.length) {
          setPlayState('error');
          setFailedPaths((prev) => {
            if (prev.has(path)) return prev;
            const next = new Set(prev);
            next.add(path);
            return next;
          });
          return;
        }

        setActivePath(path);
        setActiveSourceIndex(sourceIndex);
        setSourceIndexByPath((prev) => (prev[path] === sourceIndex ? prev : { ...prev, [path]: sourceIndex }));
        audio.pause();
        setPlayState('loading');
        setCurrentTime(0);

        audio.src = sources[sourceIndex];
        audio.load();

        try {
          await audio.play();
          if (requestId !== playRequestIdRef.current) return;
          setPlayState('playing');
          setFailedPaths((prev) => {
            if (!prev.has(path)) return prev;
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        } catch {
          if (requestId !== playRequestIdRef.current) return;
          await attemptSource(sourceIndex + 1);
        }
      };

      void attemptSource(startIndex);
    },
    [sourceIndexByPath, trackByPath]
  );

  const tryNextSource = useCallback(() => {
    const path = activePathRef.current;
    if (!path) return;
    playTrackByPath(path, activeSourceIndexRef.current + 1);
  }, [playTrackByPath]);

  const playNext = useCallback(() => {
    if (queue.length > 0) {
      const activeQueueIndex = activePath ? queue.indexOf(activePath) : -1;
      const currentQueueIndex = activeQueueIndex >= 0 ? activeQueueIndex : queueCursor;
      const nextQueueIndex = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
      if (nextQueueIndex >= queue.length) return;
      const nextPath = queue[nextQueueIndex];
      setQueueCursor(nextQueueIndex);
      playTrackByPath(nextPath);
      return;
    }

    if (playbackOrderPaths.length === 0) return;
    if (!activePath) {
      playTrackByPath(playbackOrderPaths[0]);
      return;
    }

    const currentIndex = playbackOrderPaths.indexOf(activePath);
    if (currentIndex < 0 || currentIndex >= playbackOrderPaths.length - 1) return;
    playTrackByPath(playbackOrderPaths[currentIndex + 1]);
  }, [activePath, playbackOrderPaths, playTrackByPath, queue, queueCursor]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    if (audio && currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (queue.length > 0) {
      const activeQueueIndex = activePath ? queue.indexOf(activePath) : -1;
      const currentQueueIndex = activeQueueIndex >= 0 ? activeQueueIndex : queueCursor;
      if (currentQueueIndex < 0) {
        setQueueCursor(0);
        playTrackByPath(queue[0]);
        return;
      }
      const prevQueueIndex = Math.max(0, currentQueueIndex - 1);
      setQueueCursor(prevQueueIndex);
      playTrackByPath(queue[prevQueueIndex]);
      return;
    }

    if (playbackOrderPaths.length === 0) return;
    if (!activePath) {
      playTrackByPath(playbackOrderPaths[0]);
      return;
    }

    const currentIndex = playbackOrderPaths.indexOf(activePath);
    if (currentIndex <= 0) {
      playTrackByPath(playbackOrderPaths[0]);
      return;
    }
    playTrackByPath(playbackOrderPaths[currentIndex - 1]);
  }, [activePath, currentTime, playbackOrderPaths, playTrackByPath, queue, queueCursor]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activePath) {
      const firstPath = queue[0] || playbackOrderPaths[0];
      if (!firstPath) return;
      const queueIndex = queue.indexOf(firstPath);
      setQueueCursor(queueIndex >= 0 ? queueIndex : -1);
      playTrackByPath(firstPath);
      return;
    }

    if (playState === 'playing') {
      audio.pause();
      return;
    }

    setPlayState('loading');
    audio
      .play()
      .then(() => setPlayState('playing'))
      .catch(() => tryNextSource());
  }, [activePath, playbackOrderPaths, playState, playTrackByPath, queue, tryNextSource]);

  const handlePlayTrack = useCallback(
    (path: string) => {
      if (activePath === path) {
        const audio = audioRef.current;
        if (!audio) return;
        if (playState === 'playing') {
          audio.pause();
          return;
        }
        setPlayState('loading');
        audio
          .play()
          .then(() => setPlayState('playing'))
          .catch(() => tryNextSource());
        return;
      }

      const queueIndex = queue.indexOf(path);
      setQueueCursor(queueIndex >= 0 ? queueIndex : -1);
      playTrackByPath(path);
    },
    [activePath, playState, playTrackByPath, queue, tryNextSource]
  );

  const addToQueue = useCallback((path: string) => {
    setQueue((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }, []);

  const removeFromQueue = useCallback((path: string) => {
    setQueue((prevQueue) => {
      const removeIndex = prevQueue.indexOf(path);
      if (removeIndex < 0) return prevQueue;
      const nextQueue = prevQueue.filter((item) => item !== path);

      setQueueCursor((prevCursor) => {
        if (prevCursor < 0) return -1;
        if (removeIndex < prevCursor) return prevCursor - 1;
        if (removeIndex === prevCursor) return Math.min(prevCursor, nextQueue.length - 1);
        return prevCursor;
      });

      return nextQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueCursor(-1);
  }, []);

  const playFromQueue = useCallback(
    (index: number, path: string) => {
      setQueueCursor(index);
      playTrackByPath(path);
    },
    [playTrackByPath]
  );

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      window.setTimeout(() => {
        setCopiedPath((prev) => (prev === path ? null : prev));
      }, 1200);
    } catch {
      // Ignore clipboard failures for non-secure contexts.
    }
  }, []);

  const handleSeek = useCallback((values: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = values[0] ?? 0;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const handleVolumeChange = useCallback((values: number[]) => {
    const nextVolume = Math.max(0, Math.min(values[0] ?? 0, 1));
    setVolume(nextVolume);
    if (nextVolume > 0 && isMuted) setIsMuted(false);
  }, [isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      const path = activePathRef.current;
      if (!path || nextDuration <= 0) return;
      setDurationByPath((prev) => (prev[path] === nextDuration ? prev : { ...prev, [path]: nextDuration }));
    };
    const onTimeUpdate = () => {
      const nowTime = audio.currentTime || 0;
      const loopStart = activeLoopStartRef.current;
      const loopEnd = activeLoopEndRef.current;
      if (
        loopEnabledRef.current &&
        loopStart !== null &&
        loopEnd !== null &&
        loopEnd > loopStart + 0.01 &&
        nowTime >= loopEnd - 0.03
      ) {
        audio.currentTime = loopStart;
        setCurrentTime(loopStart);
        if (audio.paused) {
          void audio.play().catch(() => {});
        }
        return;
      }
      setCurrentTime(nowTime);
    };
    const onPlay = () => setPlayState('playing');
    const onPause = () => {
      if (audio.ended) return;
      setPlayState((prev) => (prev === 'error' ? prev : 'paused'));
    };
    const onWaiting = () => setPlayState('loading');
    const onCanPlay = () => {
      if (!audio.paused) setPlayState('playing');
    };
    const onEnded = () => {
      const loopStart = activeLoopStartRef.current;
      if (loopEnabledRef.current && loopStart !== null) {
        audio.currentTime = loopStart;
        setCurrentTime(loopStart);
        audio
          .play()
          .then(() => setPlayState('playing'))
          .catch(() => setPlayState('paused'));
        return;
      }

      setCurrentTime(audio.duration || 0);
      setPlayState('paused');
      playNext();
    };
    const onError = () => tryNextSource();

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [playNext, tryNextSource]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTypingContext =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        !!target?.isContentEditable;

      if (event.key === '/' && !isTypingContext) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (isTypingContext) return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        playPrevious();
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        playNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playNext, playPrevious, togglePlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (!audio) return;
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playerStatusLabel = useMemo(() => {
    if (playState === 'loading') return 'Buffering source...';
    if (playState === 'error') return 'No playable source found';
    if (playState === 'playing') return 'Playing';
    if (playState === 'paused') return 'Paused';
    return 'Idle';
  }, [playState]);

  const rangeStart = filteredTracks.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filteredTracks.length, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <div className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background'>
        <div className='rounded-lg border bg-card p-6 text-center shadow-sm'>
          <div className='mb-4 flex justify-center'>
            <TrackArtwork track={null} size='lg' />
          </div>
          <Loader2 className='mx-auto h-9 w-9 animate-spin text-primary' />
          <p className='mt-3 text-sm text-muted-foreground'>Loading music library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-background pb-36'>
      <div className='mx-auto w-full max-w-[1680px] space-y-4 p-4 sm:p-6'>
        <Card className='overflow-hidden border-border/70 bg-card shadow-sm'>
          <CardContent className='p-0'>
            <div className='grid lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]'>
              <div className='p-5 sm:p-6'>
                <div className='flex flex-col gap-5 md:flex-row md:items-center'>
                  <TrackArtwork track={displayTrack} size='lg' active={!!activeTrack} />
                  <div className='min-w-0 flex-1'>
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      <Badge variant='outline' className='gap-1.5'>
                        <Headphones className='h-3.5 w-3.5' />
                        Music
                      </Badge>
                      <Badge variant='outline'>{playerStatusLabel}</Badge>
                    </div>
                    <h1 className='text-2xl font-semibold sm:text-3xl'>Music Library</h1>
                    <p className='mt-2 max-w-3xl text-sm text-muted-foreground'>
                      Queue worlds, events, character themes, and loop-ready tracks from the datamine.
                    </p>
                  </div>
                </div>

                <div className='mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                  <LibraryMetric
                    icon={ListMusic}
                    label='Tracks'
                    value={allTracks.length.toLocaleString()}
                  />
                  <LibraryMetric
                    icon={Repeat}
                    label='Loop Points'
                    value={loopTrackCount.toLocaleString()}
                  />
                  <LibraryMetric
                    icon={Gauge}
                    label='BPM Tagged'
                    value={bpmTrackCount.toLocaleString()}
                  />
                  <LibraryMetric
                    icon={Activity}
                    label='Fallbacks'
                    value={fallbackCapableCount.toLocaleString()}
                  />
                </div>
              </div>

              <div className='border-t bg-muted/20 p-5 lg:border-l lg:border-t-0 sm:p-6'>
                <div className='flex items-start gap-4'>
                  <TrackArtwork track={activeTrack} size='md' active={!!activeTrack} />
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs font-medium text-muted-foreground'>Now Playing</p>
                    {activeTrack ? (
                      <>
                        <p className='truncate text-lg font-semibold'>{toDisplayLabel(activeTrack.name)}</p>
                        <p className='truncate text-xs text-muted-foreground'>{activeTrack.path}</p>
                      </>
                    ) : (
                      <>
                        <p className='text-lg font-semibold'>Ready</p>
                        <p className='text-xs text-muted-foreground'>Pick a track or press Space.</p>
                      </>
                    )}
                  </div>
                </div>

                <div className='mt-5 h-2 overflow-hidden rounded-sm bg-background'>
                  <div className='h-full rounded-sm bg-primary' style={{ width: `${activeProgressPercent}%` }} />
                </div>
                <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
                  <span>{formatClock(currentTime)}</span>
                  <span>{formatClock(duration)}</span>
                </div>

                <div className='mt-4 grid grid-cols-2 gap-2 text-xs'>
                  <div className='rounded-lg border bg-background/70 p-3'>
                    <span className='text-muted-foreground'>Tempo</span>
                    <p className='font-semibold'>{getTempoLabel(activeTrack?.bpm ?? null)}</p>
                  </div>
                  <div className='rounded-lg border bg-background/70 p-3'>
                    <span className='text-muted-foreground'>Queue</span>
                    <p className='font-semibold'>{queue.length.toLocaleString()} tracks</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className='border-destructive/40 bg-destructive/5'>
            <CardContent className='flex items-center gap-2 p-3 text-sm text-destructive'>
              <AlertTriangle className='h-4 w-4' />
              {error}
            </CardContent>
          </Card>
        )}

        {categoryPreview.length > 0 && (
          <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
            {categoryPreview.map(([category, count]) => {
              const selected = categoryFilter === category;
              const artworkTrack = categoryArtworkTracks.get(category) || null;
              return (
                <button
                  key={category}
                  type='button'
                  onClick={() => {
                    setCategoryFilter(category);
                    setSubcategoryFilter(subcategoriesByCategory.get(category)?.[0] ?? 'all');
                    setPage(1);
                  }}
                  className={cn(
                    'group flex min-h-[86px] items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:bg-accent/50',
                    selected && 'border-primary bg-primary/10'
                  )}
                >
                  <TrackArtwork track={artworkTrack} size='md' active={selected} />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold'>{category}</p>
                    <p className='text-xs text-muted-foreground'>{count.toLocaleString()} tracks</p>
                    <div className='mt-2 h-1 overflow-hidden rounded-sm bg-muted'>
                      <div
                        className='h-full rounded-sm bg-primary'
                        style={{ width: `${Math.max(8, Math.min(100, (count / Math.max(allTracks.length, 1)) * 360))}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className='grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_320px]'>
          <div className='grid gap-4 sm:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1 xl:self-start'>
          <Card className='flex min-h-[280px] flex-col overflow-hidden border-border/70 bg-card/95'>
            <CardHeader className='border-b pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Disc3 className='h-4 w-4 text-primary' />
                Worlds
              </CardTitle>
              <CardDescription>{categories.length} groups</CardDescription>
            </CardHeader>
            <CardContent className='min-h-0 flex-1'>
              <ScrollArea className='h-[320px] pr-2'>
                <div className='space-y-1.5 py-1'>
                  <Button
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    size='sm'
                    className='h-10 w-full justify-between'
                    onClick={() => {
                      setCategoryFilter('all');
                      setSubcategoryFilter('all');
                      setPage(1);
                    }}
                  >
                    <span className='flex items-center gap-2'>
                      <Music2 className='h-3.5 w-3.5' />
                      All Worlds
                    </span>
                    <Badge variant='secondary'>{allTracks.length}</Badge>
                  </Button>
                  {categories.map((category) => {
                    const artworkTrack = categoryArtworkTracks.get(category) || null;
                    return (
                      <Button
                        key={category}
                        variant={categoryFilter === category ? 'default' : 'outline'}
                        size='sm'
                        className='h-10 w-full justify-between gap-2'
                        onClick={() => {
                          setCategoryFilter(category);
                          setSubcategoryFilter(subcategoriesByCategory.get(category)?.[0] ?? 'all');
                          setPage(1);
                        }}
                      >
                        <span className='flex min-w-0 items-center gap-2'>
                          <TrackArtwork track={artworkTrack} size='xs' active={categoryFilter === category} />
                          <span className='truncate text-left'>{category}</span>
                        </span>
                        <Badge variant='secondary'>{categoryCounts.get(category) || 0}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className='flex min-h-[280px] flex-col overflow-hidden border-border/70 bg-card/95'>
            <CardHeader className='border-b pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <SlidersHorizontal className='h-4 w-4 text-primary' />
                Sets
              </CardTitle>
              <CardDescription className='truncate'>
                {categoryFilter === 'all' ? 'All categories' : categoryFilter}
              </CardDescription>
            </CardHeader>
            <CardContent className='min-h-0 flex-1'>
              <ScrollArea className='h-[320px] pr-2'>
                <div className='space-y-1.5'>
                  <Button
                    variant={safeSubcategoryFilter === 'all' ? 'default' : 'outline'}
                    size='sm'
                    className='h-10 w-full justify-between'
                    onClick={() => {
                      setSubcategoryFilter('all');
                      setPage(1);
                    }}
                  >
                    <span>All Subcategories</span>
                    <Badge variant='secondary'>
                      {categoryFilter === 'all' ? allTracks.length : categoryCounts.get(categoryFilter) || 0}
                    </Badge>
                  </Button>
                  {subcategories.map((subcategory) => (
                    <Button
                      key={subcategory}
                      variant={safeSubcategoryFilter === subcategory ? 'default' : 'outline'}
                      size='sm'
                      className='h-10 w-full justify-between gap-2'
                      onClick={() => {
                        setSubcategoryFilter(subcategory);
                        setPage(1);
                      }}
                    >
                      <span className='truncate text-left'>{subcategory}</span>
                      <Badge variant='secondary'>{subcategoryCounts.get(subcategory) || 0}</Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          </div>

          <div className='space-y-4'>
            <Card className='overflow-hidden border-border/70 bg-card/95'>
              <CardHeader className='border-b pb-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Filter className='h-4 w-4 text-primary' />
                  Search & Filters
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]'>
                  <div className='relative'>
                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                    <Input
                      ref={searchInputRef}
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder='Search by name, path, category...'
                      className='pl-9'
                    />
                  </div>

                  <Select
                    value={sortMode}
                    onValueChange={(value) => {
                      setSortMode(value as SortMode);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Sort' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='name_asc'>Name (A-Z)</SelectItem>
                      <SelectItem value='name_desc'>Name (Z-A)</SelectItem>
                      <SelectItem value='category'>Category</SelectItem>
                      <SelectItem value='path'>Path</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    variant={compactRows ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setCompactRows((prev) => !prev)}
                  >
                    {compactRows ? 'Comfort Rows' : 'Compact Rows'}
                  </Button>
                  <Button
                    variant={fallbackOnly ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => {
                      setFallbackOnly((prev) => !prev);
                      setPage(1);
                    }}
                    className='gap-1.5'
                  >
                    Fallbacks
                    <Badge variant='secondary'>{fallbackCapableCount}</Badge>
                  </Button>
                  <Button
                    variant={failedOnly ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => {
                      setFailedOnly((prev) => !prev);
                      setPage(1);
                    }}
                    className='gap-1.5'
                  >
                    Failed
                    <Badge variant='secondary'>{failedPaths.size}</Badge>
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setSearch('');
                      setCategoryFilter('all');
                      setSubcategoryFilter('all');
                      setSortMode('name_asc');
                      setCompactRows(false);
                      setFallbackOnly(false);
                      setFailedOnly(false);
                      setPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                  <Button
                    variant={showMobileQueue ? 'default' : 'outline'}
                    size='sm'
                    className='2xl:hidden'
                    onClick={() => setShowMobileQueue((prev) => !prev)}
                  >
                    {showMobileQueue ? 'Hide Queue' : `Show Queue (${queue.length})`}
                  </Button>
                  <div className='ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground xl:flex'>
                    <span className='rounded-md border px-2 py-1'>/ search</span>
                    <span className='rounded-md border px-2 py-1'>Space play</span>
                    <span className='rounded-md border px-2 py-1'>J/K skip</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='overflow-hidden border-border/70 bg-card/95'>
              <CardHeader className='border-b pb-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <Music2 className='h-4 w-4 text-primary' />
                      Tracks
                    </CardTitle>
                    <CardDescription>
                      Showing {rangeStart}-{rangeEnd} of {filteredTracks.length.toLocaleString()} tracks
                    </CardDescription>
                  </div>
                  {filteredTracks.length > PAGE_SIZE && (
                    <div className='flex items-center gap-2'>
                      <Button variant='outline' size='sm' disabled={safePage === 1} onClick={() => setPage(1)}>
                        First
                      </Button>
                      <Button
                        variant='outline'
                        size='icon'
                        disabled={safePage === 1}
                        onClick={() => setPage(Math.max(1, safePage - 1))}
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <span className='text-xs text-muted-foreground'>
                        Page {safePage} / {totalPages}
                      </span>
                      <Button
                        variant='outline'
                        size='icon'
                        disabled={safePage === totalPages}
                        onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={safePage === totalPages}
                        onClick={() => setPage(totalPages)}
                      >
                        Last
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className='space-y-2'>
                {visibleTracks.length > 0 ? (
                  <div className='overflow-hidden rounded-lg border bg-background/30'>
                    <div className='grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2 border-b bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground xl:grid-cols-[44px_minmax(0,1fr)_110px]'>
                      <span>Play</span>
                      <span>Track</span>
                      <span className='hidden text-right xl:block'>Actions</span>
                    </div>
                    <ScrollArea className={cn(compactRows ? 'h-[52vh]' : 'h-[62vh]')}>
                      <div className='space-y-2 p-2'>
                        {visibleTracks.map((track, index) => {
                      const isActive = activePath === track.path;
                      const isQueued = queueSet.has(track.path);
                      const isFailed = failedPaths.has(track.path);
                      const sourceIndex = sourceIndexByPath[track.path] ?? 0;
                      const rowSources = getTrackSources(track);
                      const rowSourceUrl = rowSources[Math.min(sourceIndex, Math.max(rowSources.length - 1, 0))] || track.url;
                      const durationForRow = durationByPath[track.path] || 0;
                      const rowNumber = rangeStart + index;
                      const rowProgress =
                        isActive && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
                      const sourceBadgeClass = isFailed
                        ? 'border-destructive/50 bg-destructive/10 text-destructive'
                        : sourceIndex > 0
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';

                      return (
                        <div
                          key={track.path}
                          className={cn(
                            'relative overflow-hidden rounded-lg border transition',
                            compactRows ? 'p-2' : 'p-3',
                            isActive ? 'border-primary bg-primary/10 shadow-sm' : 'bg-background/70 hover:bg-accent/40'
                          )}
                        >
                          <div className='flex flex-wrap items-start gap-3'>
                            <Button
                              type='button'
                              variant={isActive ? 'default' : 'outline'}
                              size='icon'
                              className={cn('shrink-0', compactRows ? 'mt-0.5 h-8 w-8' : 'mt-1 h-9 w-9')}
                              onClick={() => handlePlayTrack(track.path)}
                              title='Play / Pause'
                            >
                              {isActive && playState === 'playing' ? (
                                <Pause className='h-4 w-4' />
                              ) : (
                                <Play className='h-4 w-4' />
                              )}
                            </Button>

                            <div className='min-w-0 flex-1'>
                              <div className='flex items-start gap-3'>
                                <TrackArtwork track={track} size={compactRows ? 'sm' : 'md'} active={isActive} />
                                <div className='min-w-0 flex-1'>
                                  <p className={cn('truncate font-semibold', compactRows ? 'text-[13px]' : 'text-sm')}>
                                    <span className='mr-1.5 font-mono text-[11px] text-muted-foreground'>#{rowNumber}</span>
                                    {toDisplayLabel(track.name)}
                                  </p>
                                  <p className='truncate text-[11px] text-muted-foreground'>{track.path}</p>
                                </div>
                              </div>

                              <div className={cn('flex flex-wrap items-center gap-1.5', compactRows ? 'mt-1.5' : 'mt-2')}>
                                <Badge variant='outline'>{track.category}</Badge>
                                <Badge variant='outline'>{track.subcategory}</Badge>
                                {track.artworkKind !== 'fallback' && (
                                  <Badge variant='secondary'>{getArtworkLabel(track.artworkKind)}</Badge>
                                )}
                                {track.bpm !== null && Number.isFinite(track.bpm) && (
                                  <Badge variant='outline'>
                                    {Math.round(track.bpm)} BPM / {getTempoLabel(track.bpm)}
                                  </Badge>
                                )}
                                {typeof track.loopStart === 'number' && Number.isFinite(track.loopStart) && (
                                  <Badge variant='outline' className='border-cyan-500/35 bg-cyan-500/10 text-cyan-700'>
                                    {typeof track.loopEnd === 'number' && Number.isFinite(track.loopEnd)
                                      ? `Loop ${formatClock(track.loopStart)} - ${formatClock(track.loopEnd)}`
                                      : `Loop from ${formatClock(track.loopStart)}`}
                                  </Badge>
                                )}
                                {durationForRow > 0 && <Badge variant='secondary'>{formatClock(durationForRow)}</Badge>}
                                <Badge variant='outline' className={sourceBadgeClass}>
                                  {isFailed ? 'Unavailable' : getSourceLabel(sourceIndex)}
                                </Badge>
                                {rowSources.length > 1 && <Badge variant='outline'>Fallback x{rowSources.length - 1}</Badge>}
                              </div>
                            </div>

                            <div className='flex w-full items-center justify-start gap-1 pt-1 xl:w-auto xl:justify-end xl:pt-0'>
                              <Button
                                type='button'
                                variant={isQueued ? 'default' : 'outline'}
                                size='icon'
                                className={compactRows ? 'h-7 w-7' : 'h-8 w-8'}
                                onClick={() => (isQueued ? removeFromQueue(track.path) : addToQueue(track.path))}
                                title={isQueued ? 'Remove from queue' : 'Add to queue'}
                              >
                                {isQueued ? (
                                  <X className={compactRows ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                                ) : (
                                  <Plus className={compactRows ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                                )}
                              </Button>
                              <Button
                                type='button'
                                variant={copiedPath === track.path ? 'default' : 'outline'}
                                size='icon'
                                className={compactRows ? 'h-7 w-7' : 'h-8 w-8'}
                                onClick={() => void handleCopyPath(track.path)}
                                title='Copy path'
                              >
                                <Copy className={compactRows ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                              </Button>
                              <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                className={compactRows ? 'h-7 w-7' : 'h-8 w-8'}
                                onClick={() => window.open(rowSourceUrl, '_blank', 'noopener,noreferrer')}
                                title='Open active source URL'
                              >
                                <ExternalLink className={compactRows ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                              </Button>
                            </div>
                          </div>
                          {rowProgress > 0 && (
                            <div className='absolute inset-x-0 bottom-0 h-1 bg-muted'>
                              <div className='h-full bg-primary' style={{ width: `${rowProgress}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
                    No tracks matched the current filters.
                  </div>
                )}
              </CardContent>
            </Card>

            {showMobileQueue && (
              <QueuePanel
                className='2xl:hidden'
                queueTracks={queueTracks}
                activePath={activePath}
                queueCursor={queueCursor}
                onPlayFromQueue={playFromQueue}
                onRemoveFromQueue={removeFromQueue}
                onClearQueue={clearQueue}
              />
            )}
          </div>

          <QueuePanel
            className='hidden 2xl:flex 2xl:self-start 2xl:sticky 2xl:top-20'
            queueTracks={queueTracks}
            activePath={activePath}
            queueCursor={queueCursor}
            onPlayFromQueue={playFromQueue}
            onRemoveFromQueue={removeFromQueue}
            onClearQueue={clearQueue}
          />
        </div>
      </div>

      <div className='fixed bottom-3 left-3 right-3 z-40'>
        <div className='mx-auto max-w-[1680px]'>
          <Card className='overflow-hidden border-border/70 bg-card/95 shadow-2xl backdrop-blur'>
            <CardContent className='p-3 sm:p-4'>
              <div className='grid gap-3 xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.35fr)_auto]'>
                <div className='flex min-w-0 items-center gap-3'>
                  <TrackArtwork track={activeTrack} size='sm' active={!!activeTrack} />
                  <div className='min-w-0'>
                    <p className='text-[11px] font-medium text-muted-foreground'>Now Playing</p>
                    {activeTrack ? (
                      <>
                        <p className='truncate text-sm font-semibold'>{toDisplayLabel(activeTrack.name)}</p>
                        <p className='truncate text-[11px] text-muted-foreground'>{activeTrack.category} / {activeTrack.subcategory}</p>
                      </>
                    ) : (
                      <p className='text-sm text-muted-foreground'>Select a track or press Space.</p>
                    )}
                  </div>
                </div>

                <div className='flex min-w-0 flex-col justify-center'>
                  <Slider
                    value={[Math.min(currentTime, Math.max(duration, 0))]}
                    max={Math.max(duration, 1)}
                    step={0.1}
                    onValueChange={handleSeek}
                    disabled={!activeTrack}
                    className='w-full'
                  />
                  <div className='mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground'>
                    <span>{formatClock(currentTime)}</span>
                    <span className='flex min-w-0 items-center gap-1 truncate'>
                      <Timer className='h-3 w-3 shrink-0' />
                      {playerStatusLabel}
                      {loopReady && activeTrack ? ` / ${loopEnabled ? 'Looping' : 'Loop ready'}` : ''}
                    </span>
                    <span>{formatClock(duration)}</span>
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2 xl:justify-end'>
                  <Button type='button' variant='outline' size='icon' onClick={playPrevious} title='Previous (J)'>
                    <SkipBack className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    size='icon'
                    className='h-10 w-10'
                    onClick={togglePlayback}
                    disabled={!activeTrack && playbackOrderPaths.length === 0 && queue.length === 0}
                    title='Play/Pause (Space)'
                  >
                    {playState === 'loading' ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : playState === 'playing' ? (
                      <Pause className='h-4 w-4' />
                    ) : (
                      <Play className='h-4 w-4' />
                    )}
                  </Button>
                  <Button type='button' variant='outline' size='icon' onClick={playNext} title='Next (K)'>
                    <SkipForward className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant={loopEnabled ? 'default' : 'outline'}
                    size='sm'
                    className='gap-1.5'
                    disabled={!activeTrack || !loopReady}
                    onClick={() => setLoopEnabled((prev) => !prev)}
                    title={loopReady ? 'Loop track using BGM loop points' : 'Loop points unavailable'}
                  >
                    <Repeat className='h-3.5 w-3.5' />
                    Loop
                  </Button>

                  <div className='ml-1 flex items-center gap-2 rounded-lg border bg-background/70 px-2 py-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-7 w-7'
                      onClick={() => setIsMuted((prev) => !prev)}
                      title='Mute'
                    >
                      {isMuted || volume === 0 ? <VolumeX className='h-4 w-4' /> : <Volume2 className='h-4 w-4' />}
                    </Button>
                    <Slider value={[volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className='w-24' />
                  </div>

                  {activeTrackUrl && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='gap-1.5'
                      onClick={() => window.open(activeTrackUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className='h-3.5 w-3.5' />
                      Source
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <audio ref={audioRef} preload='metadata' />
    </div>
  );
}
