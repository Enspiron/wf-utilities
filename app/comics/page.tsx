'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react';
import Image from 'next/image';
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
  const comicScrollRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!selected) return;
    const viewport = comicScrollRef.current;
    if (!viewport) return;
    viewport.focus();
    viewport.scrollTo({ top: 0, behavior: 'auto' });
  }, [selected]);

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

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_40%)]'>
      <div className='mx-auto w-full max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8'>
        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className='!flex h-[92vh] w-[calc(100vw-1rem)] max-w-5xl !flex-col overflow-hidden p-0 sm:h-[90vh] sm:w-full'>
            {selected && (
              <div className='flex h-full flex-col'>
                <DialogHeader className='shrink-0 border-b px-4 py-4 sm:px-6'>
                  <div className='flex items-start justify-between gap-2 pr-8'>
                    <div className='min-w-0'>
                      <DialogTitle className='truncate text-lg sm:text-2xl'>
                        Episode {selected.episode}: {selected.title}
                      </DialogTitle>
                      <DialogDescription>{formatDateLabel(selected.commenceTime)}</DialogDescription>
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
          </DialogContent>
        </Dialog>

        <Card className='border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background/90'>
          <CardHeader className='pb-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-xl sm:text-2xl'>
                  <BookOpenText className='h-5 w-5 text-primary' />
                  Comics Browser
                </CardTitle>
                <CardDescription>
                  Browse episode artwork with a fixed 3x2 grid and fast pagination.
                </CardDescription>
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant='outline'>{languageLabel}</Badge>
                <Badge variant='secondary'>{episodes.length} episodes</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
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

        {loading ? (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: PAGE_SIZE }).map((_, index) => (
              <Card key={index} className='overflow-hidden'>
                <CardContent className='space-y-3 p-3'>
                  <div className='aspect-[4/3] animate-pulse rounded-md bg-muted/60' />
                  <div className='h-4 w-2/3 animate-pulse rounded bg-muted/60' />
                  <div className='h-3 w-1/3 animate-pulse rounded bg-muted/40' />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className='border-destructive/40 bg-destructive/5'>
            <CardContent className='flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-sm text-destructive'>{error}</p>
              <Button size='sm' variant='outline' onClick={() => setReloadToken((value) => value + 1)}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredEpisodes.length === 0 ? (
          <Card>
            <CardContent className='py-12 text-center'>
              <p className='text-sm text-muted-foreground'>No comic episodes matched your current search.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className='flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'>
              <span>
                Showing {from}-{to} of {filteredEpisodes.length} episodes
              </span>
              <span>
                Page {safePage} of {totalPages}
              </span>
            </div>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {visibleEpisodes.map((episode) => (
                <Card
                  key={episode.episode}
                  className='group overflow-hidden border-border/70 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg'
                >
                  <CardContent className='p-3'>
                    <button
                      type='button'
                      onClick={() => setSelected(episode)}
                      className='w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    >
                      <div className='mb-3 aspect-[4/3] overflow-hidden rounded-md border bg-black/30 p-1.5'>
                        <ComicPreviewImage
                          key={`card-${folder}-${episode.episode}`}
                          folder={folder}
                          episode={episode.episode}
                          alt={`Episode ${episode.episode}: ${episode.title}`}
                        />
                      </div>
                      <div className='mb-2 flex flex-wrap items-center gap-2'>
                        <Badge variant='outline'>Episode {episode.episode}</Badge>
                        <Badge variant='secondary' className='gap-1'>
                          <CalendarDays className='h-3 w-3' />
                          {formatDateLabel(episode.commenceTime)}
                        </Badge>
                      </div>
                      <p className='line-clamp-2 text-sm font-semibold leading-5'>{episode.title}</p>
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className='flex flex-wrap items-center justify-center gap-2 border-t pt-4'>
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
  );
}
