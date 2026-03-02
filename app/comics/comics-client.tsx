'use client';

import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenText,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  Search,
} from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ComicLanguage = 'en' | 'jp' | 'cn' | 'kr' | 'th';

interface ComicEpisode {
  episode: number;
  title: string;
  commenceTime: string | null;
}

interface ComicApiResponse {
  lang: ComicLanguage;
  languageLabel: string;
  folder: string;
  sourceUrl: string | null;
  count: number;
  episodes: ComicEpisode[];
  error?: string;
}

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const PAGE_SIZE = 6; // 3 x 2 grid

const LANGUAGE_OPTIONS: Array<{ value: ComicLanguage; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'jp', label: 'JP' },
  { value: 'cn', label: 'CN' },
  { value: 'kr', label: 'KR' },
  { value: 'th', label: 'TH' },
];

function getComicImageCandidates(
  folder: string,
  episode: number,
  mode: 'preview' | 'full' = 'preview'
): string[] {
  const base = `${CDN_ROOT}/comics/${folder}/${episode}`;
  if (mode === 'full') {
    return [`${base}/base.png`, `${base}/large.png`, `${base}/small.png`];
  }
  return [`${base}/small.png`, `${base}/large.png`, `${base}/base.png`];
}

function ComicPreviewImage({
  folder,
  episode,
  alt,
  className,
  mode = 'preview',
}: {
  folder: string;
  episode: number;
  alt: string;
  className?: string;
  mode?: 'preview' | 'full';
}) {
  const [index, setIndex] = useState(0);
  const candidates = useMemo(() => getComicImageCandidates(folder, episode, mode), [folder, episode, mode]);

  if (index >= candidates.length) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground',
          className
        )}
      >
        Preview unavailable
      </div>
    );
  }

  const imageClassName =
    mode === 'full'
      ? cn('mx-auto block h-auto w-full', className)
      : cn('h-full w-full object-contain', className);

  if (mode === 'full') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidates[index]}
        alt={alt}
        className={imageClassName}
        loading='eager'
        onError={() => setIndex((current) => current + 1)}
      />
    );
  }

  return (
    <Image
      src={candidates[index]}
      alt={alt}
      width={960}
      height={720}
      className={imageClassName}
      unoptimized
      onError={() => setIndex((current) => current + 1)}
    />
  );
}

function formatDateLabel(value: string | null): string {
  if (!value) return 'Unknown date';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ComicsPage() {
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<ComicLanguage>('en');
  const [reloadToken, setReloadToken] = useState(0);
  const [languageLabel, setLanguageLabel] = useState('English');
  const [folder, setFolder] = useState('comics-en');
  const [episodes, setEpisodes] = useState<ComicEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ComicEpisode | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMobileNextButton, setShowMobileNextButton] = useState(false);
  const [jumpEpisodeInput, setJumpEpisodeInput] = useState('');
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const comicScrollRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const hasAppliedInitialUrlLanguage = useRef(false);
  const hasAppliedInitialUrlEpisode = useRef(false);
  const shareCopiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadComics() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/comics?lang=${language}`, { signal: controller.signal });
        const payload = (await response.json()) as ComicApiResponse;
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load comics');
        }
        setLanguageLabel(payload.languageLabel || language.toUpperCase());
        setFolder(payload.folder || 'comics-en');
        setEpisodes(Array.isArray(payload.episodes) ? payload.episodes : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load comics', err);
        setEpisodes([]);
        setError('Could not load comic metadata. Please try again.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadComics();

    return () => controller.abort();
  }, [language, reloadToken]);

  useEffect(() => {
    setPage(1);
  }, [language, search]);

  useEffect(() => {
    setSelected(null);
  }, [language]);

  const requestedLanguageFromUrl = useMemo(() => {
    const raw = searchParams.get('lang');
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    return LANGUAGE_OPTIONS.some((option) => option.value === normalized)
      ? (normalized as ComicLanguage)
      : null;
  }, [searchParams]);

  const requestedEpisodeFromUrl = useMemo(() => {
    const token = searchParams.get('episode') ?? searchParams.get('ep');
    if (!token) return null;
    const parsed = Number.parseInt(token.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  useEffect(() => {
    if (hasAppliedInitialUrlLanguage.current) return;
    hasAppliedInitialUrlLanguage.current = true;
    if (!requestedLanguageFromUrl) return;
    setLanguage(requestedLanguageFromUrl);
  }, [requestedLanguageFromUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (hasAppliedInitialUrlEpisode.current) return;
    if (loading) return;
    if (language !== (requestedLanguageFromUrl ?? 'en')) return;
    hasAppliedInitialUrlEpisode.current = true;
    if (!requestedEpisodeFromUrl) return;
    const match = episodes.find((episode) => episode.episode === requestedEpisodeFromUrl);
    if (match) {
      setSelected(match);
    }
  }, [episodes, language, loading, requestedEpisodeFromUrl, requestedLanguageFromUrl]);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current !== null) {
        window.clearTimeout(shareCopiedTimerRef.current);
      }
    };
  }, []);

  const filteredEpisodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return episodes;
    return episodes.filter((episode) => {
      if (episode.title.toLowerCase().includes(query)) return true;
      return String(episode.episode).includes(query);
    });
  }, [episodes, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visibleEpisodes = filteredEpisodes.slice(start, start + PAGE_SIZE);
  const from = filteredEpisodes.length === 0 ? 0 : start + 1;
  const to = Math.min(start + PAGE_SIZE, filteredEpisodes.length);
  const selectedEpisode = selected?.episode ?? null;
  const selectedEpisodeIndex = useMemo(() => {
    if (selectedEpisode === null) return -1;
    return filteredEpisodes.findIndex((episode) => episode.episode === selectedEpisode);
  }, [filteredEpisodes, selectedEpisode]);

  const hasPrevEpisode = selectedEpisodeIndex > 0;
  const hasNextEpisode =
    selectedEpisodeIndex >= 0 && selectedEpisodeIndex < filteredEpisodes.length - 1;
  const jumpEpisodeValue = Number.parseInt(jumpEpisodeInput, 10);
  const jumpEpisodeIndex = Number.isFinite(jumpEpisodeValue)
    ? filteredEpisodes.findIndex((episode) => episode.episode === jumpEpisodeValue)
    : -1;
  const canJumpToEpisode = jumpEpisodeIndex >= 0;

  const scrollComicViewport = useCallback((offset: number) => {
    const viewport = comicScrollRef.current;
    if (!viewport) return;
    viewport.scrollBy({ top: offset, behavior: 'smooth' });
  }, []);

  const openEpisodeAtIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= filteredEpisodes.length) return;
      setSelected(filteredEpisodes[nextIndex]);
    },
    [filteredEpisodes]
  );

  const goToPreviousEpisode = useCallback(() => {
    if (!hasPrevEpisode) return;
    openEpisodeAtIndex(selectedEpisodeIndex - 1);
  }, [hasPrevEpisode, openEpisodeAtIndex, selectedEpisodeIndex]);

  const goToNextEpisode = useCallback(() => {
    if (!hasNextEpisode) return;
    openEpisodeAtIndex(selectedEpisodeIndex + 1);
  }, [hasNextEpisode, openEpisodeAtIndex, selectedEpisodeIndex]);

  const goToJumpEpisode = useCallback(() => {
    if (!canJumpToEpisode) return;
    openEpisodeAtIndex(jumpEpisodeIndex);
    setContextMenuPosition(null);
  }, [canJumpToEpisode, jumpEpisodeIndex, openEpisodeAtIndex]);

  useEffect(() => {
    if (!selected) return;
    const viewport = comicScrollRef.current;
    if (!viewport) return;
    viewport.focus();
    viewport.scrollTo({ top: 0, behavior: 'auto' });
    setJumpEpisodeInput(String(selected.episode));
    setContextMenuPosition(null);
    setShowMobileNextButton(false);
  }, [selected]);

  useEffect(() => {
    if (!contextMenuPosition) return;

    const closeContextMenu = (event: Event) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current && target && contextMenuRef.current.contains(target)) return;
      setContextMenuPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenuPosition(null);
      }
    };

    window.addEventListener('pointerdown', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeContextMenu);
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenuPosition]);

  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousEpisode();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextEpisode();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        scrollComicViewport(-480);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        scrollComicViewport(480);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToNextEpisode, goToPreviousEpisode, scrollComicViewport, selected]);

  useEffect(() => {
    if (!selected || !isMobileViewport) {
      setShowMobileNextButton(false);
      return;
    }
    const viewport = comicScrollRef.current;
    if (!viewport) return;

    const sync = () => {
      const threshold = 24;
      const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - threshold;
      setShowMobileNextButton(atBottom && hasNextEpisode);
    };

    sync();
    viewport.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);

    return () => {
      viewport.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [hasNextEpisode, isMobileViewport, selected]);

  const openComicContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!selected) return;
      event.preventDefault();
      const menuWidth = 280;
      const menuHeight = 170;
      const margin = 8;
      const dialogRect = dialogContentRef.current?.getBoundingClientRect();
      if (!dialogRect) return;
      const rawX = event.clientX - dialogRect.left;
      const rawY = event.clientY - dialogRect.top;
      const maxX = Math.max(margin, dialogRect.width - menuWidth - margin);
      const maxY = Math.max(margin, dialogRect.height - menuHeight - margin);
      const x = Math.min(Math.max(rawX, margin), maxX);
      const y = Math.min(Math.max(rawY, margin), maxY);
      setContextMenuPosition({ x, y });
    },
    [selected]
  );

  const copyEpisodeShareLink = useCallback(async () => {
    if (!selected || typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('lang', language);
    params.set('episode', String(selected.episode));
    const shareUrl = `${window.location.origin}/comics?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      if (shareCopiedTimerRef.current !== null) {
        window.clearTimeout(shareCopiedTimerRef.current);
      }
      shareCopiedTimerRef.current = window.setTimeout(() => {
        setShareCopied(false);
        shareCopiedTimerRef.current = null;
      }, 1800);
    } catch {
      // Clipboard access may fail in restricted contexts.
    }
  }, [language, selected]);

  return (
    <div className='h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_40%)]'>
      <div className='mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 overflow-hidden px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8'>
        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent
            ref={dialogContentRef}
            className='!left-1/2 !top-1/2 !flex !-translate-x-1/2 !-translate-y-1/2 h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl !flex-col overflow-hidden p-0 sm:h-[calc(100dvh-2rem)] sm:w-full'
          >
            {selected && (
              <div className='flex h-full flex-col'>
                <DialogHeader className='shrink-0 border-b px-4 py-4 sm:px-6'>
                  <div className='flex items-start justify-between gap-2 pr-8'>
                    <div className='min-w-0'>
                      <DialogTitle className='truncate text-lg sm:text-2xl'>
                        Episode {selected.episode}: {selected.title}
                      </DialogTitle>
                      <DialogDescription>
                        {formatDateLabel(selected.commenceTime)}. Right-click comic area for quick controls.
                      </DialogDescription>
                    </div>
                    <div className='flex shrink-0 items-center gap-1'>
                      <Button
                        type='button'
                        size='icon'
                        variant='outline'
                        onClick={goToPreviousEpisode}
                        disabled={!hasPrevEpisode}
                        aria-label='Previous episode'
                        title='Previous episode (Left Arrow)'
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        size='icon'
                        variant='outline'
                        onClick={goToNextEpisode}
                        disabled={!hasNextEpisode}
                        aria-label='Next episode'
                        title='Next episode (Right Arrow)'
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                <div className='flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4'>
                  <div
                    ref={comicScrollRef}
                    tabIndex={0}
                    onContextMenu={openComicContextMenu}
                    className='min-h-0 flex-1 overflow-y-scroll overscroll-contain rounded-xl border bg-black/40 p-2 outline-none sm:p-3'
                  >
                    <div className='rounded-lg bg-muted/20 p-2'>
                      <ComicPreviewImage
                        key={`modal-${folder}-${selected.episode}`}
                        folder={folder}
                        episode={selected.episode}
                        alt={`Comic episode ${selected.episode}`}
                        mode='full'
                        className='mx-auto'
                      />
                    </div>
                  </div>

                  <div className='mt-3 flex flex-wrap items-center gap-2'>
                    <Button type='button' variant='secondary' size='sm' onClick={copyEpisodeShareLink}>
                      {shareCopied ? <Check className='mr-1.5 h-4 w-4' /> : <Link2 className='mr-1.5 h-4 w-4' />}
                      {shareCopied ? 'Copied' : 'Copy Episode Link'}
                    </Button>
                    <Button asChild variant='outline' size='sm'>
                      <a
                        href={`${CDN_ROOT}/comics/${folder}/${selected.episode}/base.png`}
                        target='_blank'
                        rel='noreferrer'
                      >
                        <ExternalLink className='mr-1.5 h-4 w-4' />
                        Open Full Resolution
                      </a>
                    </Button>
                    <Button asChild variant='outline' size='sm'>
                      <a
                        href={`${CDN_ROOT}/comics/${folder}/${selected.episode}/large.png`}
                        target='_blank'
                        rel='noreferrer'
                      >
                        <ExternalLink className='mr-1.5 h-4 w-4' />
                        Open Large Preview
                      </a>
                    </Button>
                    <span className='text-xs text-muted-foreground'>
                      Keyboard: Left/Right switch episodes, Up/Down scroll comic
                    </span>
                  </div>
                </div>
              </div>
            )}
            {contextMenuPosition && (
              <div
                ref={contextMenuRef}
                className='absolute z-[90] w-64 rounded-md border border-white/10 bg-black/90 p-1.5 text-foreground shadow-2xl backdrop-blur-md'
                style={{
                  left: `${contextMenuPosition.x}px`,
                  top: `${contextMenuPosition.y}px`,
                }}
                role='menu'
                aria-label='Comic context menu'
              >
                <div className='space-y-0.5'>
                  <button
                    type='button'
                    className='flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'
                    onClick={() => {
                      goToPreviousEpisode();
                      setContextMenuPosition(null);
                    }}
                    disabled={!hasPrevEpisode}
                  >
                    <ChevronLeft className='h-4 w-4' />
                    Previous Episode
                  </button>
                  <button
                    type='button'
                    className='flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'
                    onClick={() => {
                      goToNextEpisode();
                      setContextMenuPosition(null);
                    }}
                    disabled={!hasNextEpisode}
                  >
                    <ChevronRight className='h-4 w-4' />
                    Next Episode
                  </button>
                </div>
                <div className='my-1.5 border-t border-white/10' />
                <div className='space-y-1.5 px-1 pb-0.5'>
                  <p className='text-[11px] uppercase tracking-wide text-muted-foreground/80'>Jump to episode</p>
                  <div className='flex items-center gap-1.5'>
                    <Input
                      type='number'
                      value={jumpEpisodeInput}
                      onChange={(event) => setJumpEpisodeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        void goToJumpEpisode();
                      }}
                      min={1}
                      className='h-8 border-white/15 bg-black/30 text-sm'
                    />
                    <Button
                      size='sm'
                      variant='secondary'
                      className='h-8 px-2.5'
                      onClick={() => void goToJumpEpisode()}
                      disabled={!canJumpToEpisode}
                    >
                      Go
                    </Button>
                  </div>
                  {jumpEpisodeInput && !canJumpToEpisode ? (
                    <p className='text-[11px] text-muted-foreground/80'>Episode not in current list/filter.</p>
                  ) : null}
                </div>
              </div>
            )}
            {isMobileViewport && showMobileNextButton && hasNextEpisode && (
              <Button
                type='button'
                size='sm'
                className='absolute bottom-3 right-3 z-20 gap-1 shadow-lg sm:hidden'
                onClick={goToNextEpisode}
              >
                Next Comic
                <ChevronRight className='h-4 w-4' />
              </Button>
            )}
          </DialogContent>
        </Dialog>

        <Card className='shrink-0 border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background/90'>
          <CardHeader className='pb-2'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-xl sm:text-2xl'>
                  <BookOpenText className='h-5 w-5 text-primary' />
                  Comics Browser
                </CardTitle>
                <CardDescription>
                  Browse episode artwork with a compact mobile 2x3 grid and fast pagination.
                </CardDescription>
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant='outline'>{languageLabel}</Badge>
                <Badge variant='secondary'>{episodes.length} episodes</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search by title or episode number...'
                  className='pl-9'
                />
              </div>
              <div className='flex flex-wrap gap-2 md:justify-end'>
                {LANGUAGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    size='sm'
                    variant={language === option.value ? 'default' : 'outline'}
                    onClick={() => setLanguage(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='flex min-h-0 flex-1 flex-col'>
          {loading ? (
            <div className='grid h-full min-h-0 grid-cols-2 grid-rows-3 gap-2 sm:grid-cols-3 sm:grid-rows-2 sm:gap-3 lg:gap-4'>
              {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <Card key={index} className='h-full overflow-hidden'>
                  <CardContent className='flex h-full flex-col p-2'>
                    <div className='min-h-0 flex-1 animate-pulse rounded-md bg-muted/60' />
                    <div className='mt-1.5 h-3 w-2/3 animate-pulse rounded bg-muted/60' />
                    <div className='mt-1 h-2.5 w-1/3 animate-pulse rounded bg-muted/40' />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className='h-full border-destructive/40 bg-destructive/5'>
              <CardContent className='flex h-full flex-col items-start justify-center gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
                <p className='text-sm text-destructive'>{error}</p>
                <Button size='sm' variant='outline' onClick={() => setReloadToken((value) => value + 1)}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : filteredEpisodes.length === 0 ? (
            <Card className='h-full'>
              <CardContent className='flex h-full items-center justify-center py-12 text-center'>
                <p className='text-sm text-muted-foreground'>No comic episodes matched your current search.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className='mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'>
                <span>
                  Showing {from}-{to} of {filteredEpisodes.length} episodes
                </span>
                <span>
                  Page {safePage} of {totalPages}
                </span>
              </div>
              <div className='grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2 sm:grid-cols-3 sm:grid-rows-2 sm:gap-3 lg:gap-4'>
                {visibleEpisodes.map((episode) => (
                  <Card
                    key={episode.episode}
                    className='group h-full overflow-hidden border-border/70 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg'
                  >
                    <CardContent className='h-full p-2 sm:p-2.5'>
                      <button
                        type='button'
                        onClick={() => setSelected(episode)}
                        className='flex h-full w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      >
                        <div className='mb-1.5 min-h-0 flex-1 overflow-hidden rounded-md border bg-black/30 p-1'>
                          <ComicPreviewImage
                            key={`card-${folder}-${episode.episode}`}
                            folder={folder}
                            episode={episode.episode}
                            alt={`Episode ${episode.episode}: ${episode.title}`}
                            className='h-full w-full object-cover sm:object-contain'
                          />
                        </div>
                        <div className='flex flex-wrap items-center gap-1'>
                          <Badge variant='outline' className='px-1.5 py-0 text-[10px] sm:text-[11px]'>
                            Ep {episode.episode}
                          </Badge>
                          <Badge variant='secondary' className='hidden gap-1 md:inline-flex'>
                            <CalendarDays className='h-3 w-3' />
                            {formatDateLabel(episode.commenceTime)}
                          </Badge>
                        </div>
                        <p className='mt-1 line-clamp-1 text-xs font-semibold leading-4 sm:text-sm sm:leading-5'>
                          {episode.title}
                        </p>
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className='mt-2 flex shrink-0 flex-wrap items-center justify-center gap-2 border-t pt-2'>
                <Button size='sm' variant='outline' onClick={() => setPage(1)} disabled={safePage === 1}>
                  First
                </Button>
                <Button
                  size='icon'
                  variant='outline'
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='px-2 text-sm text-muted-foreground'>
                  Page {safePage} / {totalPages}
                </span>
                <Button
                  size='icon'
                  variant='outline'
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage === totalPages}
                >
                  <ChevronRight className='h-4 w-4' />
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                >
                  Last
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
