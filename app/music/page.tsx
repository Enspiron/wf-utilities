'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Filter,
  Headphones,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  SkipBack,
  SkipForward,
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
  volume: number | null;
  bpm: number | null;
  trimStart: number | null;
  loopStart: number | null;
  loopEnd: number | null;
  timingGroup: number | null;
}

type SortMode = 'name_asc' | 'name_desc' | 'category' | 'path';
type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

const PAGE_SIZE = 100;
const TRACK_TONES = [
  'from-cyan-500/20 via-cyan-400/5 to-sky-500/15 border-cyan-500/25',
  'from-orange-500/20 via-amber-400/5 to-yellow-500/15 border-orange-500/25',
  'from-emerald-500/20 via-green-400/5 to-teal-500/15 border-emerald-500/25',
  'from-rose-500/20 via-red-400/5 to-pink-500/15 border-rose-500/25',
  'from-indigo-500/20 via-blue-400/5 to-violet-500/15 border-indigo-500/25',
];

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

function getToneClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TRACK_TONES[hash % TRACK_TONES.length];
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
    <Card className={cn('flex min-h-[320px] flex-col', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <div>
            <CardTitle className='text-base'>Queue</CardTitle>
            <CardDescription>{queueTracks.length} tracks queued</CardDescription>
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
          <div className='flex h-full items-center justify-center rounded-md border border-dashed p-5 text-sm text-muted-foreground'>
            Add tracks to queue for controlled playback order.
          </div>
        ) : (
          <ScrollArea className='h-[360px] pr-2'>
            <div className='space-y-2'>
              {queueTracks.map((track, index) => {
                const isActive = activePath === track.path || queueCursor === index;
                return (
                  <div
                    key={`${track.path}-${index}`}
                    className={cn(
                      'rounded-md border p-2',
                      isActive ? 'border-primary bg-primary/5' : 'bg-background/60'
                    )}
                  >
                    <div className='flex items-start gap-2'>
                      <Button
                        type='button'
                        variant={isActive ? 'default' : 'outline'}
                        size='icon'
                        className='h-7 w-7'
                        onClick={() => onPlayFromQueue(index, track.path)}
                        title='Play from queue'
                      >
                        <Play className='h-3.5 w-3.5' />
                      </Button>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>{toDisplayLabel(track.name)}</p>
                        <p className='truncate text-[11px] text-muted-foreground'>{track.path}</p>
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7'
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
      <div className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.08),transparent_45%)]'>
        <div className='text-center'>
          <Loader2 className='mx-auto h-9 w-9 animate-spin text-primary' />
          <p className='mt-3 text-sm text-muted-foreground'>Loading music library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.08),transparent_45%)] pb-36'>
      <div className='mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/85 backdrop-blur'>
          <CardContent className='p-5 sm:p-6'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div>
                <div className='mb-2 flex items-center gap-2'>
                  <div className='rounded-md border border-primary/30 bg-primary/10 p-2'>
                    <Headphones className='h-4 w-4 text-primary' />
                  </div>
                  <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Music Control Deck</h1>
                </div>
                <p className='max-w-2xl text-sm text-muted-foreground'>
                  Browse tracks by world/event, queue sets for continuous playback, and auto-fallback to alternate CDN
                  URLs when a source fails.
                </p>
              </div>
              <div className='flex flex-wrap gap-2 text-xs'>
                <Badge variant='outline' className='gap-1.5'>
                  <ListMusic className='h-3.5 w-3.5' />
                  {allTracks.length.toLocaleString()} tracks
                </Badge>
                <Badge variant='outline'>{fallbackCapableCount.toLocaleString()} with fallback</Badge>
                <Badge variant='outline' className='text-destructive'>
                  {failedPaths.size.toLocaleString()} failed
                </Badge>
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

        <div className='grid gap-4 xl:grid-cols-[220px_220px_minmax(0,1fr)_320px]'>
          <Card className='flex min-h-[300px] flex-col'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Categories</CardTitle>
              <CardDescription>Click to navigate</CardDescription>
            </CardHeader>
            <CardContent className='min-h-0 flex-1'>
              <ScrollArea className='h-[410px] pr-2'>
                <div className='space-y-1.5'>
                  <Button
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    size='sm'
                    className='w-full justify-between'
                    onClick={() => {
                      setCategoryFilter('all');
                      setSubcategoryFilter('all');
                      setPage(1);
                    }}
                  >
                    <span>All Categories</span>
                    <Badge variant='secondary'>{allTracks.length}</Badge>
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={categoryFilter === category ? 'default' : 'outline'}
                      size='sm'
                      className='w-full justify-between'
                      onClick={() => {
                        setCategoryFilter(category);
                        setSubcategoryFilter(subcategoriesByCategory.get(category)?.[0] ?? 'all');
                        setPage(1);
                      }}
                    >
                      <span className='truncate text-left'>{category}</span>
                      <Badge variant='secondary'>{categoryCounts.get(category) || 0}</Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className='flex min-h-[300px] flex-col'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Subcategories</CardTitle>
              <CardDescription className='truncate'>
                {categoryFilter === 'all' ? 'All categories' : categoryFilter}
              </CardDescription>
            </CardHeader>
            <CardContent className='min-h-0 flex-1'>
              <ScrollArea className='h-[410px] pr-2'>
                <div className='space-y-1.5'>
                  <Button
                    variant={safeSubcategoryFilter === 'all' ? 'default' : 'outline'}
                    size='sm'
                    className='w-full justify-between'
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
                      className='w-full justify-between'
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

          <div className='space-y-4'>
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Filter className='h-4 w-4 text-primary' />
                  Command Bar
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
                    variant={fallbackOnly ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => {
                      setFallbackOnly((prev) => !prev);
                      setPage(1);
                    }}
                    className='gap-1.5'
                  >
                    Fallback Only
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
                    Failed Only
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
                    className='xl:hidden'
                    onClick={() => setShowMobileQueue((prev) => !prev)}
                  >
                    {showMobileQueue ? 'Hide Queue' : `Show Queue (${queue.length})`}
                  </Button>
                  <div className='ml-auto flex items-center gap-2 text-[11px] text-muted-foreground'>
                    <span className='rounded border px-2 py-0.5'>/ search</span>
                    <span className='rounded border px-2 py-0.5'>Space play/pause</span>
                    <span className='rounded border px-2 py-0.5'>J/K prev/next</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <CardTitle className='text-base'>Track List</CardTitle>
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
                  <>
                    {visibleTracks.map((track) => {
                      const isActive = activePath === track.path;
                      const isQueued = queueSet.has(track.path);
                      const isFailed = failedPaths.has(track.path);
                      const toneClass = getToneClass(track.category);
                      const sourceIndex = sourceIndexByPath[track.path] ?? 0;
                      const rowSources = getTrackSources(track);
                      const rowSourceUrl = rowSources[Math.min(sourceIndex, Math.max(rowSources.length - 1, 0))] || track.url;
                      const durationForRow = durationByPath[track.path] || 0;
                      const sourceBadgeClass = isFailed
                        ? 'border-destructive/50 bg-destructive/10 text-destructive'
                        : sourceIndex > 0
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600';

                      return (
                        <div
                          key={track.path}
                          className={cn(
                            'rounded-lg border p-3 transition',
                            isActive ? 'border-primary bg-primary/5 shadow-sm' : 'bg-background/70 hover:bg-accent/40'
                          )}
                        >
                          <div className='flex items-start gap-3'>
                            <Button
                              type='button'
                              variant={isActive ? 'default' : 'outline'}
                              size='icon'
                              className='mt-1 h-9 w-9 shrink-0'
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
                                <div
                                  className={cn(
                                    'mt-0.5 flex h-11 w-16 shrink-0 items-center justify-center rounded-md border bg-gradient-to-br',
                                    toneClass
                                  )}
                                >
                                  <Music2 className='h-4 w-4 text-foreground/80' />
                                </div>
                                <div className='min-w-0 flex-1'>
                                  <p className='truncate text-sm font-semibold'>{toDisplayLabel(track.name)}</p>
                                  <p className='truncate text-[11px] text-muted-foreground'>{track.path}</p>
                                </div>
                              </div>

                              <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                                <Badge variant='outline'>{track.category}</Badge>
                                <Badge variant='outline'>{track.subcategory}</Badge>
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

                            <div className='flex shrink-0 items-center gap-1'>
                              <Button
                                type='button'
                                variant={isQueued ? 'default' : 'outline'}
                                size='icon'
                                className='h-8 w-8'
                                onClick={() => (isQueued ? removeFromQueue(track.path) : addToQueue(track.path))}
                                title={isQueued ? 'Remove from queue' : 'Add to queue'}
                              >
                                {isQueued ? <X className='h-3.5 w-3.5' /> : <Plus className='h-3.5 w-3.5' />}
                              </Button>
                              <Button
                                type='button'
                                variant={copiedPath === track.path ? 'default' : 'outline'}
                                size='icon'
                                className='h-8 w-8'
                                onClick={() => void handleCopyPath(track.path)}
                                title='Copy path'
                              >
                                <Copy className='h-3.5 w-3.5' />
                              </Button>
                              <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                className='h-8 w-8'
                                onClick={() => window.open(rowSourceUrl, '_blank', 'noopener,noreferrer')}
                                title='Open active source URL'
                              >
                                <ExternalLink className='h-3.5 w-3.5' />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
                    No tracks matched the current filters.
                  </div>
                )}
              </CardContent>
            </Card>

            {showMobileQueue && (
              <QueuePanel
                className='xl:hidden'
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
            className='hidden xl:flex'
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
        <div className='mx-auto max-w-7xl'>
          <Card className='border-border/70 bg-background/95 shadow-2xl backdrop-blur'>
            <CardContent className='p-3 sm:p-4'>
              <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]'>
                <div className='min-w-0'>
                  <p className='text-[11px] uppercase tracking-wide text-muted-foreground'>Now Playing</p>
                  {activeTrack ? (
                    <>
                      <p className='truncate text-sm font-semibold'>{toDisplayLabel(activeTrack.name)}</p>
                      <p className='truncate text-[11px] text-muted-foreground'>{activeTrack.path}</p>
                      <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                        <Badge variant='outline'>{activeTrack.category}</Badge>
                        <Badge variant='outline'>{activeTrack.subcategory}</Badge>
                        {loopReady && (
                          <Badge variant='outline' className='border-cyan-500/40 bg-cyan-500/10 text-cyan-700'>
                            {activeLoopEnd !== null
                              ? `Loop ${formatClock(activeLoopStart ?? 0)} - ${formatClock(activeLoopEnd)}`
                              : `Loop from ${formatClock(activeLoopStart ?? 0)}`}
                          </Badge>
                        )}
                        <Badge
                          variant='outline'
                          className={cn(
                            activeSourceIndex > 0
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                          )}
                        >
                          {getSourceLabel(activeSourceIndex)}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>Select a track or press Space to start playback.</p>
                  )}
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
                  <div className='mt-1 flex items-center justify-between text-[11px] text-muted-foreground'>
                    <span>{formatClock(currentTime)}</span>
                    <span>{playerStatusLabel}</span>
                    <span>{formatClock(duration)}</span>
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2 lg:justify-end'>
                  <Button type='button' variant='outline' size='icon' onClick={playPrevious} title='Previous (J)'>
                    <SkipBack className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    size='icon'
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

                  <div className='ml-1 flex items-center gap-2 rounded-md border px-2 py-1'>
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
