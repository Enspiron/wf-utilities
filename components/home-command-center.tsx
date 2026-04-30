'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Compass,
  ExternalLink,
  Globe2,
  Hourglass,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SnapshotState = {
  orderedmapCategories: number | null;
  orderedmapFiles: number | null;
  questFiles: number | null;
  itemEntries: number | null;
  musicTracks: number | null;
};

type EosMilestone = {
  key: string;
  label: string;
  dateIso: string;
  tone: string;
};

const EOS_MILESTONES: EosMilestone[] = [
  {
    key: 'jp',
    label: 'JP Server EoS',
    dateIso: '2024-02-20',
    tone: 'border-rose-500/35 bg-rose-500/8',
  },
  {
    key: 'gl',
    label: 'GL Server EoS',
    dateIso: '2024-07-25',
    tone: 'border-amber-500/35 bg-amber-500/8',
  },
  {
    key: 'tw',
    label: 'TW Server EoS',
    dateIso: '2024-05-24',
    tone: 'border-cyan-500/35 bg-cyan-500/8',
  },
  {
    key: 'cn',
    label: 'CN Server EoS',
    dateIso: '2025-08-14',
    tone: 'border-indigo-500/35 bg-indigo-500/8',
  }
];

const EOS_TWEET_URL = 'https://twitter.com/world_flipper/status/1765663775401836851';
const EOS_TWEET_ID = '1765663775401836851';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TWITTER_SNOWFLAKE_SHIFT = BigInt(22);
const TWITTER_EPOCH_MS = BigInt('1288834974657');

function toUtcDayTimestamp(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function parseIsoDateToUtcDate(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00Z`);
}

function daysSinceDate(target: Date, now: Date): number {
  return Math.max(0, Math.floor((toUtcDayTimestamp(now) - toUtcDayTimestamp(target)) / MS_PER_DAY));
}

function dateFromTweetSnowflake(id: string): Date | null {
  try {
    const snowflake = BigInt(id);
    const timestampMs = Number((snowflake >> TWITTER_SNOWFLAKE_SHIFT) + TWITTER_EPOCH_MS);
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
    return new Date(timestampMs);
  } catch {
    return null;
  }
}

function formatMetric(value: number | null): string {
  if (value === null) return '--';
  return value.toLocaleString('en-US');
}

export default function HomeCommandCenter() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState<SnapshotState>({
    orderedmapCategories: null,
    orderedmapFiles: null,
    questFiles: null,
    itemEntries: null,
    musicTracks: null,
  });
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadSnapshot = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshingSnapshot(true);
    } else {
      setLoadingSnapshot(true);
    }

    setSnapshotError(null);
    try {
      // Single aggregated endpoint replaces the 4 parallel browser fetches.
      // `cache: 'no-store'` only on explicit refresh — otherwise let the
      // browser/CDN serve the cached snapshot.
      const response = await fetch('/api/snapshot', isRefresh ? { cache: 'no-store' } : undefined);
      if (!response.ok) {
        throw new Error('Snapshot endpoint failed.');
      }

      const json = (await response.json()) as Partial<SnapshotState> & { generatedAt?: string };

      setSnapshot({
        orderedmapCategories: json.orderedmapCategories ?? 0,
        orderedmapFiles: json.orderedmapFiles ?? 0,
        questFiles: json.questFiles ?? 0,
        itemEntries: json.itemEntries ?? 0,
        musicTracks: json.musicTracks ?? 0,
      });
      setLastUpdated(json.generatedAt ? new Date(json.generatedAt) : new Date());
    } catch {
      setSnapshotError('Could not load live snapshot data.');
    } finally {
      setLoadingSnapshot(false);
      setRefreshingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(false);
  }, [loadSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const metrics = useMemo(
    () => [
      { label: 'OrderedMap Categories', value: snapshot.orderedmapCategories },
      { label: 'OrderedMap Files', value: snapshot.orderedmapFiles },
      { label: 'Quest Files', value: snapshot.questFiles },
      { label: 'Items + Equipment', value: snapshot.itemEntries },
      { label: 'Music Tracks', value: snapshot.musicTracks },
    ],
    [snapshot]
  );

  const eosSnapshot = useMemo(() => {
    const now = new Date(nowTick);
    return EOS_MILESTONES.map((milestone) => {
      const date = parseIsoDateToUtcDate(milestone.dateIso);
      return {
        ...milestone,
        date,
        daysSince: daysSinceDate(date, now),
      };
    });
  }, [nowTick]);

  const eosTweetSnapshot = useMemo(() => {
    const now = new Date(nowTick);
    const postedAt = dateFromTweetSnowflake(EOS_TWEET_ID);
    const daysSince = postedAt ? daysSinceDate(postedAt, now) : null;
    return {
      postedAt,
      daysSince,
      previewUrl: `https://platform.twitter.com/embed/Tweet.html?id=${EOS_TWEET_ID}&theme=dark&dnt=true`,
    };
  }, [nowTick]);

  const handleToolSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const trimmedQuery = query.trim();
      router.push(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : '/search');
    },
    [query, router]
  );

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_top_left,rgba(239,68,68,0.11),transparent_50%),linear-gradient(to_bottom,rgba(15,23,42,0.04),transparent_35%)]'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/85 backdrop-blur'>
          <CardContent className='p-5 sm:p-7'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <Badge variant='outline' className='gap-1.5 border-primary/30 bg-primary/5'>
                <Globe2 className='h-3.5 w-3.5 text-primary' />
                World Flipper Toolkit
              </Badge>
              <div className='flex flex-wrap items-center gap-2'>
                <Link href='/calendar'>
                  <Button size='sm'>Open Calendar</Button>
                </Link>
                <Link href='/gacha'>
                  <Button size='sm' variant='outline'>Open Gacha</Button>
                </Link>
                <Link href='/quests'>
                  <Button size='sm' variant='outline'>Open Quests</Button>
                </Link>
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
              <div>
                <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>Archive + Tools Home</h1>
                <p className='mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base'>
                  Browse through the world flipper assets and even edit your save data
                </p>
              </div>

              <form onSubmit={handleToolSearch} className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end'>
                <div className='relative w-full sm:max-w-sm'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Search everything: character, item, quest, VA, face code...'
                    className='pl-9'
                  />
                </div>
                <Button type='submit' className='gap-1.5'>
                  Search
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className='border-border/60 bg-background/85'>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Hourglass className='h-4 w-4 text-primary' />
              Days Since EoS
            </CardTitle>
            <CardDescription>Server closure timeline and official EoS announcement reference.</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'>
            <div className='grid gap-3 sm:grid-cols-3 xl:grid-cols-1'>
              {eosSnapshot.map((milestone) => (
                <div key={milestone.key} className={cn('rounded-lg border p-3', milestone.tone)}>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>{milestone.label}</p>
                  <p className='mt-1 text-2xl font-semibold'>{milestone.daysSince.toLocaleString('en-US')} days</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Ended on{' '}
                    {milestone.date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>

            <div className='rounded-lg border border-border/70 bg-muted/10 p-3'>
              <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                <div>
                  <p className='text-sm font-medium'>WF Dimensions</p>
                  <p className='text-xs text-muted-foreground'>
                    {eosTweetSnapshot.daysSince !== null
                      ? `${eosTweetSnapshot.daysSince.toLocaleString('en-US')} days since posted`
                      : 'Tweet date unavailable'}
                    {eosTweetSnapshot.postedAt && (
                      <>
                        {' '}
                        (
                        {eosTweetSnapshot.postedAt.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        )
                      </>
                    )}
                  </p>
                </div>
                <Link href={EOS_TWEET_URL} target='_blank' rel='noopener noreferrer'>
                  <Button size='sm' variant='outline' className='gap-1.5'>
                    Open Tweet
                    <ExternalLink className='h-3.5 w-3.5' />
                  </Button>
                </Link>
              </div>
              <div className='overflow-hidden rounded-md border bg-background'>
                <iframe
                  title='World Flipper EoS Tweet Preview'
                  src={eosTweetSnapshot.previewUrl}
                  className='h-[310px] w-full'
                  loading='lazy'
                />
              </div>
              <p className='mt-2 text-[11px] text-muted-foreground'>
                If the embed is blocked by browser/network policy, use{' '}
                <Link href={EOS_TWEET_URL} target='_blank' rel='noopener noreferrer' className='text-primary underline'>
                  Open Tweet
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className='border-border/60 bg-background/85'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Compass className='h-4 w-4 text-primary' />
                  Live Snapshot
                </CardTitle>
                <CardDescription>
                  Current dataset totals from local APIs.
                  {lastUpdated ? ` Updated ${lastUpdated.toLocaleTimeString()}.` : ''}
                </CardDescription>
              </div>
              <Button
                size='sm'
                variant='outline'
                className='gap-2'
                onClick={() => void loadSnapshot(true)}
                disabled={refreshingSnapshot}
              >
                <RefreshCw className={cn('h-4 w-4', refreshingSnapshot && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {snapshotError && (
              <p className='mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                {snapshotError}
              </p>
            )}
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              {metrics.map((metric) => (
                <div key={metric.label} className='rounded-md border bg-muted/20 p-3'>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>{metric.label}</p>
                  <p className='mt-1 text-2xl font-semibold'>
                    {loadingSnapshot ? '...' : formatMetric(metric.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        </div>
      </div>
  );
}
