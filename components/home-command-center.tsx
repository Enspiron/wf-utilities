'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Database,
  FileJson,
  Music2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Swords,
  Ticket,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ToolCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  tone: string;
};

type SnapshotState = {
  orderedmapCategories: number | null;
  orderedmapFiles: number | null;
  questFiles: number | null;
  itemEntries: number | null;
  musicTracks: number | null;
};

const TOOL_CARDS: ToolCard[] = [
  {
    href: '/quests',
    title: 'Quest Viewer',
    description: 'Inspect quests, view artwork detection, and test BGM assets.',
    icon: Swords,
    keywords: ['quest', 'event', 'bgm', 'artwork', 'thumbnail'],
    tone: 'from-amber-500/15 to-amber-500/5 border-amber-500/30',
  },
  {
    href: '/calendar',
    title: 'Event Calendar',
    description: 'Track schedules, inspect date ranges, and drill into raw event payloads.',
    icon: CalendarDays,
    keywords: ['calendar', 'events', 'schedule', 'campaign'],
    tone: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/30',
  },
  {
    href: '/gacha',
    title: 'Gacha Explorer',
    description: 'Browse banner art, filter portals, and inspect odds pools in one place.',
    icon: Ticket,
    keywords: ['gacha', 'banner', 'portal', 'odds'],
    tone: 'from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/30',
  },
  {
    href: '/orderedmap',
    title: 'OrderedMap Explorer',
    description: 'Navigate the full datalist tree and inspect category/file payloads.',
    icon: FileJson,
    keywords: ['orderedmap', 'datalist', 'json', 'assets'],
    tone: 'from-indigo-500/15 to-indigo-500/5 border-indigo-500/30',
  },
  {
    href: '/items',
    title: 'Items',
    description: 'Browse items/equipment with filtering and large result pagination.',
    icon: Package,
    keywords: ['items', 'equipment', 'materials', 'orbs'],
    tone: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30',
  },
  {
    href: '/characters',
    title: 'Characters',
    description: 'Search character data and inspect parsed details.',
    icon: Database,
    keywords: ['characters', 'units', 'search'],
    tone: 'from-rose-500/15 to-rose-500/5 border-rose-500/30',
  },
  {
    href: '/music',
    title: 'Music',
    description: 'Browse and play BGM paths with fallback URL support.',
    icon: Music2,
    keywords: ['music', 'bgm', 'audio', 'tracks'],
    tone: 'from-violet-500/15 to-violet-500/5 border-violet-500/30',
  },
  {
    href: '/facebuilder',
    title: 'Face Builder',
    description: 'Build and export character face combinations.',
    icon: User,
    keywords: ['face', 'builder', 'portrait'],
    tone: 'from-orange-500/15 to-orange-500/5 border-orange-500/30',
  },
];

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

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOL_CARDS;
    return TOOL_CARDS.filter((tool) =>
      `${tool.title} ${tool.description} ${tool.keywords.join(' ')}`.toLowerCase().includes(q)
    );
  }, [query]);

  const loadSnapshot = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshingSnapshot(true);
    } else {
      setLoadingSnapshot(true);
    }

    setSnapshotError(null);
    try {
      const [orderedmapRes, questRes, itemsRes, musicRes] = await Promise.all([
        fetch('/api/orderedmap/list?lang=en', { cache: 'no-store' }),
        fetch('/api/quests/list?lang=en', { cache: 'no-store' }),
        fetch('/api/items', { cache: 'no-store' }),
        fetch('/api/music', { cache: 'no-store' }),
      ]);

      if (!orderedmapRes.ok || !questRes.ok || !itemsRes.ok || !musicRes.ok) {
        throw new Error('One or more data endpoints failed.');
      }

      const [orderedmapJson, questJson, itemsJson, musicJson] = await Promise.all([
        orderedmapRes.json() as Promise<{ categories?: unknown[]; filesByCategory?: Record<string, unknown> }>,
        questRes.json() as Promise<{ files?: unknown[] }>,
        itemsRes.json() as Promise<{ count?: number; items?: unknown[] }>,
        musicRes.json() as Promise<{ count?: number; tracks?: unknown[] }>,
      ]);

      const filesByCategory = orderedmapJson.filesByCategory || {};
      const orderedmapFiles = Object.values(filesByCategory).reduce<number>((total, files) => {
        return total + (Array.isArray(files) ? files.length : 0);
      }, 0);

      setSnapshot({
        orderedmapCategories: Array.isArray(orderedmapJson.categories) ? orderedmapJson.categories.length : 0,
        orderedmapFiles,
        questFiles: Array.isArray(questJson.files) ? questJson.files.length : 0,
        itemEntries: typeof itemsJson.count === 'number'
          ? itemsJson.count
          : Array.isArray(itemsJson.items)
            ? itemsJson.items.length
            : 0,
        musicTracks: typeof musicJson.count === 'number'
          ? musicJson.count
          : Array.isArray(musicJson.tracks)
            ? musicJson.tracks.length
            : 0,
      });
      setLastUpdated(new Date());
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

  const handleToolSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (filteredTools.length > 0) {
        router.push(filteredTools[0].href);
      }
    },
    [filteredTools, router]
  );

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_45%)]'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/85 backdrop-blur'>
          <CardContent className='p-5 sm:p-7'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <Badge variant='outline' className='gap-1.5'>
                <Sparkles className='h-3.5 w-3.5' />
                Home Command Center
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
                <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>WF Toolkit Launchpad</h1>
                <p className='mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base'>
                  Jump directly to the right tool, inspect current dataset size, and start common workflows from one page.
                </p>
              </div>

              <form onSubmit={handleToolSearch} className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end'>
                <div className='relative w-full sm:max-w-sm'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Search a tool (quests, calendar, items...)'
                    className='pl-9'
                  />
                </div>
                <Button type='submit' className='gap-1.5'>
                  Go
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </form>
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

        <div className='grid gap-4 lg:grid-cols-3'>
          <Card className='border-border/60 bg-background/85 lg:col-span-2'>
            <CardHeader>
              <CardTitle>Tool Launcher</CardTitle>
              <CardDescription>
                Click any card to jump into that section.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2'>
              {filteredTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.href} href={tool.href} className='group'>
                    <div className={cn('rounded-lg border bg-gradient-to-br p-4 transition hover:border-primary/40 hover:shadow-sm', tool.tone)}>
                      <div className='mb-3 flex items-center justify-between'>
                        <div className='rounded-md border bg-background/70 p-2'>
                          <Icon className='h-4 w-4 text-primary' />
                        </div>
                        <ArrowRight className='h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary' />
                      </div>
                      <p className='font-medium'>{tool.title}</p>
                      <p className='mt-1 text-sm text-muted-foreground'>{tool.description}</p>
                    </div>
                  </Link>
                );
              })}
              {filteredTools.length === 0 && (
                <div className='col-span-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  No tools matched your search.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='border-border/60 bg-background/85'>
            <CardHeader>
              <CardTitle>Workflow Shortcuts</CardTitle>
              <CardDescription>
                Common flows you can run quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div className='rounded-md border p-3'>
                <p className='font-medium'>Event Recon</p>
                <p className='mt-1 text-muted-foreground'>Use calendar filters, then open details modal for raw payload + assets.</p>
                <Link href='/calendar' className='mt-2 inline-flex items-center gap-1 text-primary hover:underline'>
                  Go to Calendar <ArrowRight className='h-3.5 w-3.5' />
                </Link>
              </div>
              <div className='rounded-md border p-3'>
                <p className='font-medium'>Banner Odds Audit</p>
                <p className='mt-1 text-muted-foreground'>Scan gacha banners with artwork-first cards and inspect parsed + raw odds pools.</p>
                <Link href='/gacha' className='mt-2 inline-flex items-center gap-1 text-primary hover:underline'>
                  Go to Gacha <ArrowRight className='h-3.5 w-3.5' />
                </Link>
              </div>
              <div className='rounded-md border p-3'>
                <p className='font-medium'>Quest Asset Audit</p>
                <p className='mt-1 text-muted-foreground'>Find quests with images/BGM and inspect each source path and fallback.</p>
                <Link href='/quests' className='mt-2 inline-flex items-center gap-1 text-primary hover:underline'>
                  Go to Quests <ArrowRight className='h-3.5 w-3.5' />
                </Link>
              </div>
              <div className='rounded-md border p-3'>
                <p className='font-medium'>Data Deep-Dive</p>
                <p className='mt-1 text-muted-foreground'>Open OrderedMap explorer for direct file-level inspection and source comparisons.</p>
                <Link href='/orderedmap' className='mt-2 inline-flex items-center gap-1 text-primary hover:underline'>
                  Go to OrderedMap <ArrowRight className='h-3.5 w-3.5' />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
