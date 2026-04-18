'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  Copy,
  ExternalLink,
  FileJson,
  Filter,
  ImageOff,
  Languages,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Table as TableIcon,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
  FeatureTimelineEntry,
  FeatureTimelinePayload,
  TimelineCategory,
  TimelineLang,
  TimelineSource,
  TimelineStatus,
} from '@/lib/feature-timeline/types';

const PAGE_SIZE = 60;
const SOURCE_OPTIONS: Array<'all' | TimelineSource> = ['all', 'feature_banner', 'feature_announcement', 'feature_guide_dialog'];
const STATUS_OPTIONS: Array<'all' | TimelineStatus> = ['all', 'live', 'upcoming', 'ended', 'unknown'];
const VIEW_OPTIONS = ['timeline', 'month', 'table'] as const;
type ViewMode = (typeof VIEW_OPTIONS)[number];
const SORT_OPTIONS = ['start_desc', 'start_asc', 'duration_desc', 'priority_desc'] as const;
type SortMode = (typeof SORT_OPTIONS)[number];

const SOURCE_LABELS: Record<TimelineSource, string> = {
  feature_banner: 'Feature Banner',
  feature_announcement: 'Feature Announcement',
  feature_guide_dialog: 'Feature Guide Dialog',
};

const STATUS_LABELS: Record<TimelineStatus, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  ended: 'Ended',
  unknown: 'Unknown',
};

const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  gacha: 'Gacha',
  event: 'Event',
  campaign: 'Campaign',
  comic: 'Comic',
  payment: 'Payment',
  system: 'System',
  survey: 'Survey',
  other: 'Other',
};

const CATEGORY_ORDER: TimelineCategory[] = ['gacha', 'event', 'campaign', 'comic', 'payment', 'system', 'survey', 'other'];

const SOURCE_FILE_BY_SOURCE: Record<TimelineSource, string> = {
  feature_banner: 'feature_banner',
  feature_announcement: 'feature_announcement',
  feature_guide_dialog: 'feature_guide_dialog',
};

function parseLang(value: string | null): TimelineLang {
  return value === 'jp' ? 'jp' : 'en';
}

function parseView(value: string | null): ViewMode {
  return VIEW_OPTIONS.includes((value || '') as ViewMode) ? (value as ViewMode) : 'timeline';
}

function parseSource(value: string | null): 'all' | TimelineSource {
  return SOURCE_OPTIONS.includes((value || '') as 'all' | TimelineSource) ? (value as 'all' | TimelineSource) : 'all';
}

function parseStatus(value: string | null): 'all' | TimelineStatus {
  return STATUS_OPTIONS.includes((value || '') as 'all' | TimelineStatus) ? (value as 'all' | TimelineStatus) : 'all';
}

function parseSort(value: string | null): SortMode {
  return SORT_OPTIONS.includes((value || '') as SortMode) ? (value as SortMode) : 'start_desc';
}

function parsePositivePage(value: string | null): number {
  const numeric = Number.parseInt(value || '', 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function toDateMs(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateStartMs(input: string): number | null {
  if (!input) return null;
  const parsed = Date.parse(`${input}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateEndMs(input: string): number | null {
  if (!input) return null;
  const parsed = Date.parse(`${input}T23:59:59.999Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatRange(startAt: string | null, endAt: string | null): string {
  if (!startAt && !endAt) return 'No schedule metadata';
  return `${formatDateTime(startAt)} - ${formatDateTime(endAt)}`;
}

function matchesRange(entry: FeatureTimelineEntry, fromMs: number | null, toMs: number | null): boolean {
  if (fromMs === null && toMs === null) return true;
  if (!entry.startAt && !entry.endAt) return false;

  const startMs = toDateMs(entry.startAt) ?? Number.NEGATIVE_INFINITY;
  const endMs = toDateMs(entry.endAt) ?? Number.POSITIVE_INFINITY;

  if (fromMs !== null && endMs < fromMs) return false;
  if (toMs !== null && startMs > toMs) return false;
  return true;
}

function scoreTime(entry: FeatureTimelineEntry): number {
  return toDateMs(entry.startAt) ?? toDateMs(entry.endAt) ?? 0;
}

function priorityScore(entry: FeatureTimelineEntry): number {
  const token = entry.priorityCode || entry.refs.internalId;
  const parsed = Number.parseInt(token || '', 10);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator?.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function statusClassName(status: TimelineStatus): string {
  switch (status) {
    case 'live':
      return 'border-emerald-500/40 text-emerald-300';
    case 'upcoming':
      return 'border-cyan-500/40 text-cyan-300';
    case 'ended':
      return 'border-amber-500/40 text-amber-300';
    case 'unknown':
    default:
      return 'border-muted-foreground/40 text-muted-foreground';
  }
}

function categoryClassName(category: TimelineCategory): string {
  switch (category) {
    case 'gacha':
      return 'border-fuchsia-500/40 text-fuchsia-300';
    case 'event':
      return 'border-violet-500/40 text-violet-300';
    case 'campaign':
      return 'border-sky-500/40 text-sky-300';
    case 'comic':
      return 'border-teal-500/40 text-teal-300';
    case 'payment':
      return 'border-orange-500/40 text-orange-300';
    case 'system':
      return 'border-indigo-500/40 text-indigo-300';
    case 'survey':
      return 'border-lime-500/40 text-lime-300';
    default:
      return 'border-muted-foreground/40 text-muted-foreground';
  }
}

function InlineSkeleton() {
  return (
    <div className='space-y-3'>
      <Card className='border-border/60 bg-background/85'>
        <CardContent className='p-4 sm:p-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='space-y-2'>
              <Skeleton className='h-7 w-56' />
              <Skeleton className='h-4 w-80' />
            </div>
            <Skeleton className='h-9 w-28' />
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            <Skeleton className='h-6 w-20' />
            <Skeleton className='h-6 w-24' />
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-6 w-24' />
            <Skeleton className='h-6 w-24' />
          </div>
        </CardContent>
      </Card>
      <Card className='border-border/60 bg-background/85'>
        <CardContent className='p-4 sm:p-5'>
          <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px]'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        </CardContent>
      </Card>
      <div className='grid gap-3'>
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className='border-border/60 bg-background/85'>
            <CardContent className='p-3'>
              <div className='flex flex-col gap-3 md:flex-row'>
                <Skeleton className='h-28 w-full md:h-24 md:w-[240px]' />
                <div className='min-w-0 flex-1 space-y-2'>
                  <Skeleton className='h-5 w-56' />
                  <Skeleton className='h-4 w-72' />
                  <div className='flex flex-wrap gap-2'>
                    <Skeleton className='h-5 w-24' />
                    <Skeleton className='h-5 w-24' />
                    <Skeleton className='h-5 w-20' />
                    <Skeleton className='h-5 w-16' />
                  </div>
                  <Skeleton className='h-3 w-full' />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TimelineImage({ entry }: { entry: FeatureTimelineEntry }) {
  const [index, setIndex] = useState(0);

  const src = entry.imageUrlCandidates[index];
  if (!src) {
    return (
      <div className='flex h-24 w-full items-center justify-center rounded-md border border-dashed bg-muted/20 text-muted-foreground'>
        <ImageOff className='h-4 w-4' />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={entry.title}
      className='h-24 w-full rounded-md border object-cover [image-rendering:auto]'
      loading='lazy'
      decoding='async'
      onError={() => setIndex((current) => current + 1)}
    />
  );
}

export default function FeatureTimelineClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<TimelineLang>(() => parseLang(searchParams.get('lang')));
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [sourceFilter, setSourceFilter] = useState<'all' | TimelineSource>(() => parseSource(searchParams.get('source')));
  const [categoryFilter, setCategoryFilter] = useState<'all' | TimelineCategory>(() => {
    const initialCategory = (searchParams.get('category') || '').trim().toLowerCase() as 'all' | TimelineCategory;
    return initialCategory === 'all' || CATEGORY_ORDER.includes(initialCategory as TimelineCategory) ? initialCategory : 'all';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | TimelineStatus>(() => parseStatus(searchParams.get('status')));
  const [fromDate, setFromDate] = useState(() => searchParams.get('from') || '');
  const [toDate, setToDate] = useState(() => searchParams.get('to') || '');
  const [activeOnDate, setActiveOnDate] = useState(() => searchParams.get('on') || '');
  const [sortMode, setSortMode] = useState<SortMode>(() => parseSort(searchParams.get('sort')));
  const [viewMode, setViewMode] = useState<ViewMode>(() => parseView(searchParams.get('view')));
  const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));

  const [payload, setPayload] = useState<FeatureTimelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<FeatureTimelineEntry | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (lang !== 'en') params.set('lang', lang);
    if (viewMode !== 'timeline') params.set('view', viewMode);
    if (query.trim()) params.set('q', query.trim());
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (activeOnDate) params.set('on', activeOnDate);
    if (sortMode !== 'start_desc') params.set('sort', sortMode);
    if (page > 1) params.set('page', String(page));

    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;

    const nextUrl = next ? `${pathname}?${next}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [activeOnDate, categoryFilter, fromDate, lang, page, pathname, query, router, searchParams, sortMode, sourceFilter, statusFilter, toDate, viewMode]);

  useEffect(() => {
    let active = true;

    fetch(`/api/feature-timeline?lang=${lang}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = (await response.json()) as FeatureTimelinePayload;
        if (!active) return;
        setPayload(json);
        setError(response.ok ? null : json.partialWarnings[0] || 'Failed to load feature timeline data.');
      })
      .catch((fetchError) => {
        if (!active) return;
        console.error('Failed to load feature timeline:', fetchError);
        setPayload(null);
        setError('Failed to load feature timeline data.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lang]);

  const categoryOptions = useMemo<Array<'all' | TimelineCategory>>(() => {
    const options = new Set<'all' | TimelineCategory>(['all']);
    for (const entry of payload?.entries || []) options.add(entry.category);
    return ['all', ...CATEGORY_ORDER.filter((item) => options.has(item))];
  }, [payload?.entries]);

  const fromMs = useMemo(() => toDateStartMs(fromDate), [fromDate]);
  const toMs = useMemo(() => toDateEndMs(toDate), [toDate]);
  const activeOnStartMs = useMemo(() => toDateStartMs(activeOnDate), [activeOnDate]);
  const activeOnEndMs = useMemo(() => toDateEndMs(activeOnDate), [activeOnDate]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entries = payload?.entries || [];

    const next = entries.filter((entry) => {
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!matchesRange(entry, fromMs, toMs)) return false;
      if (!matchesRange(entry, activeOnStartMs, activeOnEndMs)) return false;

      if (q) {
        const haystack = [
          entry.title,
          entry.subtitle,
          entry.description || '',
          entry.imagePath || '',
          entry.refs.targetRef || '',
          entry.refs.bannerKey || '',
          entry.refs.internalId || '',
          entry.source,
          entry.category,
          entry.tags.join(' '),
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...next];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case 'start_asc':
          return scoreTime(a) - scoreTime(b);
        case 'duration_desc': {
          const aDuration = a.durationDays ?? -1;
          const bDuration = b.durationDays ?? -1;
          if (aDuration !== bDuration) return bDuration - aDuration;
          return scoreTime(b) - scoreTime(a);
        }
        case 'priority_desc': {
          const aPriority = priorityScore(a);
          const bPriority = priorityScore(b);
          if (aPriority !== bPriority) return bPriority - aPriority;
          return scoreTime(b) - scoreTime(a);
        }
        case 'start_desc':
        default:
          return scoreTime(b) - scoreTime(a);
      }
    });

    return sorted;
  }, [activeOnEndMs, activeOnStartMs, categoryFilter, fromMs, payload?.entries, query, sortMode, sourceFilter, statusFilter, toMs]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const visibleEntries = useMemo(
    () => filteredEntries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredEntries, safePage]
  );

  const groupedMonths = useMemo(() => {
    const groups = new Map<string, FeatureTimelineEntry[]>();

    for (const entry of visibleEntries) {
      const keyDate = entry.startAt || entry.endAt;
      const key = keyDate ? keyDate.slice(0, 7) : 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(entry);
    }

    const orderedKeys = [...groups.keys()].sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return b.localeCompare(a);
    });

    return orderedKeys.map((key) => ({ key, label: key === 'unknown' ? 'Unknown Month' : key, items: groups.get(key) || [] }));
  }, [visibleEntries]);

  const clearFilters = () => {
    setQuery('');
    setSourceFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    setActiveOnDate('');
    setSortMode('start_desc');
    setViewMode('timeline');
    setPage(1);
  };

  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined') return;
    const ok = await copyText(window.location.href);
    if (!ok) return;
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1500);
  };

  const handleCopyRowJson = async (entry: FeatureTimelineEntry) => {
    await copyText(JSON.stringify(entry.raw, null, 2));
  };

  const headerCounts = payload?.counts;
  const hasEntries = (payload?.entries.length || 0) > 0;

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.08),transparent_45%)]'>
      <div className='mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/85 backdrop-blur'>
          <CardHeader className='pb-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-xl'>
                  <Sparkles className='h-5 w-5 text-primary' />
                  Feature Timeline
                </CardTitle>
                <CardDescription>Home banners, announcements, and guide dialogs in one historical timeline.</CardDescription>
              </div>
              <div className='inline-flex items-center gap-1 rounded-md border bg-muted/20 p-1'>
                <Button
                  size='sm'
                  variant={lang === 'en' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPage(1);
                    setLoading(true);
                    setError(null);
                    setLang('en');
                  }}
                  className='gap-1.5'
                >
                  <Languages className='h-3.5 w-3.5' />
                  EN
                </Button>
                <Button
                  size='sm'
                  variant={lang === 'jp' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPage(1);
                    setLoading(true);
                    setError(null);
                    setLang('jp');
                  }}
                >
                  JP
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <Badge variant='outline'>Total: {headerCounts?.total ?? 0}</Badge>
              <Badge variant='outline'>Feature Banner: {headerCounts?.feature_banner ?? 0}</Badge>
              <Badge variant='outline'>Announcement: {headerCounts?.feature_announcement ?? 0}</Badge>
              <Badge variant='outline'>Guide Dialog: {headerCounts?.feature_guide_dialog ?? 0}</Badge>
              <Badge variant='outline'>Live: {headerCounts?.live ?? 0}</Badge>
              <Badge variant='outline'>Upcoming: {headerCounts?.upcoming ?? 0}</Badge>
              <Badge variant='outline'>Ended: {headerCounts?.ended ?? 0}</Badge>
              <Badge variant='outline'>Unknown: {headerCounts?.unknown ?? 0}</Badge>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Link href='/calendar'>
                <Button size='sm' variant='outline' className='gap-1.5'>
                  <CalendarDays className='h-3.5 w-3.5' />
                  Calendar
                </Button>
              </Link>
              <Link href='/gacha'>
                <Button size='sm' variant='outline' className='gap-1.5'>
                  <ExternalLink className='h-3.5 w-3.5' />
                  Gacha
                </Button>
              </Link>
              <Button size='sm' variant='outline' className='gap-1.5' onClick={handleCopyShareLink}>
                <Link2 className='h-3.5 w-3.5' />
                {shareCopied ? 'Link Copied' : 'Copy Share Link'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className='border-border/60 bg-background/85'>
          <CardContent className='space-y-2 p-4 sm:p-5'>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.target.value);
                }}
                placeholder='Search title, description, image path, or refs...'
                className='pl-9'
              />
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs font-medium text-muted-foreground'>Source</span>
              {SOURCE_OPTIONS.map((source) => (
                <Button
                  key={source}
                  size='sm'
                  variant={sourceFilter === source ? 'default' : 'outline'}
                  onClick={() => {
                    setPage(1);
                    setSourceFilter(source);
                  }}
                >
                  {source === 'all' ? 'All Sources' : SOURCE_LABELS[source]}
                </Button>
              ))}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs font-medium text-muted-foreground'>Category</span>
              {categoryOptions.map((category) => (
                <Button
                  key={category}
                  size='sm'
                  variant={categoryFilter === category ? 'default' : 'outline'}
                  onClick={() => {
                    setPage(1);
                    setCategoryFilter(category);
                  }}
                >
                  {category === 'all' ? 'All Categories' : CATEGORY_LABELS[category]}
                </Button>
              ))}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs font-medium text-muted-foreground'>Status</span>
              {STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  size='sm'
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => {
                    setPage(1);
                    setStatusFilter(status);
                  }}
                >
                  {status === 'all' ? 'All Status' : STATUS_LABELS[status]}
                </Button>
              ))}
            </div>

            <div className='grid gap-2 md:grid-cols-3'>
              <Input
                type='date'
                value={fromDate}
                onChange={(event) => {
                  setPage(1);
                  setFromDate(event.target.value);
                }}
                aria-label='From date'
              />
              <Input
                type='date'
                value={toDate}
                onChange={(event) => {
                  setPage(1);
                  setToDate(event.target.value);
                }}
                aria-label='To date'
              />
              <Input
                type='date'
                value={activeOnDate}
                onChange={(event) => {
                  setPage(1);
                  setActiveOnDate(event.target.value);
                }}
                aria-label='Active on date'
              />
            </div>

            <div className='grid gap-2 md:grid-cols-[210px_auto_auto_auto]'>
              <Select
                value={sortMode}
                onValueChange={(value) => {
                  setPage(1);
                  setSortMode(value as SortMode);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Sort' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='start_desc'>Start (Newest)</SelectItem>
                  <SelectItem value='start_asc'>Start (Oldest)</SelectItem>
                  <SelectItem value='duration_desc'>Duration (Longest)</SelectItem>
                  <SelectItem value='priority_desc'>Priority (High)</SelectItem>
                </SelectContent>
              </Select>
              <div className='inline-flex rounded-md border bg-muted/20 p-1'>
                <Button
                  size='sm'
                  variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPage(1);
                    setViewMode('timeline');
                  }}
                >
                  Timeline
                </Button>
                <Button
                  size='sm'
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPage(1);
                    setViewMode('month');
                  }}
                >
                  Month
                </Button>
                <Button
                  size='sm'
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  onClick={() => {
                    setPage(1);
                    setViewMode('table');
                  }}
                >
                  <TableIcon className='mr-1 h-3.5 w-3.5' />
                  Table
                </Button>
              </div>
              <Button variant='outline' onClick={clearFilters} className='gap-1.5'>
                <Filter className='h-3.5 w-3.5' />
                Reset
              </Button>
              <div className='flex items-center justify-end text-xs text-muted-foreground'>
                Showing {filteredEntries.length.toLocaleString('en-US')} entries
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && !payload ? (
          <InlineSkeleton />
        ) : error ? (
          <Card className='border-destructive/40 bg-destructive/5'>
            <CardContent className='p-4 text-sm text-destructive'>{error}</CardContent>
          </Card>
        ) : !hasEntries ? (
          <Card className='border-border/60 bg-background/85'>
            <CardContent className='flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground'>
              <FileJson className='h-5 w-5' />
              <p>No timeline records were loaded for this language.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {payload?.partialWarnings.length ? (
              <Card className='border-amber-500/40 bg-amber-500/5'>
                <CardContent className='space-y-1 p-4 text-sm text-amber-200'>
                  {payload.partialWarnings.map((warning, index) => (
                    <p key={`${warning}_${index}`}>{warning}</p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {filteredEntries.length === 0 ? (
              <Card className='border-border/60 bg-background/85'>
                <CardContent className='flex min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center'>
                  <Search className='h-6 w-6 text-muted-foreground' />
                  <p className='text-lg font-semibold'>No matches for current filters</p>
                  <p className='text-sm text-muted-foreground'>Try resetting source/category/status/date filters.</p>
                  <Button variant='outline' onClick={clearFilters}>
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === 'timeline' ? (
              <div className='space-y-3'>
                {visibleEntries.map((entry) => {
                  const rawSourceHref = `/api/orderedmap/data?category=feature_banner&file=${SOURCE_FILE_BY_SOURCE[entry.source]}&lang=${lang}`;
                  return (
                    <Card key={entry.uid} className='border-border/60 bg-background/85'>
                      <CardContent className='p-3'>
                        <div className='flex flex-col gap-3 md:flex-row'>
                          <div className='w-full shrink-0 md:w-[240px]'>
                            <TimelineImage entry={entry} />
                          </div>
                          <div className='min-w-0 flex-1 space-y-2'>
                            <div className='flex flex-wrap items-center gap-1.5'>
                              <Badge variant='outline'>{SOURCE_LABELS[entry.source]}</Badge>
                              <Badge variant='outline' className={cn('capitalize', categoryClassName(entry.category))}>
                                {CATEGORY_LABELS[entry.category]}
                              </Badge>
                              <Badge variant='outline' className={cn('capitalize', statusClassName(entry.status))}>
                                {STATUS_LABELS[entry.status]}
                              </Badge>
                              <Badge variant='outline'>Priority {entry.priorityCode || '-'}</Badge>
                            </div>

                            <div className='min-w-0'>
                              <p className='truncate text-base font-semibold'>{entry.title}</p>
                              <p className='truncate text-xs text-muted-foreground'>{entry.subtitle}</p>
                            </div>
                            <div className='grid gap-1 text-xs text-muted-foreground md:grid-cols-2'>
                              <p>{formatRange(entry.startAt, entry.endAt)}</p>
                              <p>Duration: {entry.durationDays !== null ? `${entry.durationDays} days` : 'Unknown'}</p>
                              <p className='truncate'>Path: {entry.imagePath || '(None)'}</p>
                              <p className='truncate'>
                                Refs: id={entry.refs.internalId || '-'} key={entry.refs.bannerKey || '-'} target={entry.refs.targetRef || '-'}
                              </p>
                            </div>

                            <div className='flex flex-wrap items-center gap-2'>
                              <Button size='sm' variant='outline' onClick={() => setActiveEntry(entry)}>
                                Details
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                className='gap-1.5'
                                disabled={!entry.imagePath}
                                onClick={() => void copyText(entry.imagePath || '')}
                              >
                                <Copy className='h-3.5 w-3.5' />
                                Copy Image Path
                              </Button>
                              <Button size='sm' variant='outline' className='gap-1.5' onClick={() => void handleCopyRowJson(entry)}>
                                <Copy className='h-3.5 w-3.5' />
                                Copy Row JSON
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                className='gap-1.5'
                                disabled={!entry.imageUrlCandidates[0]}
                                onClick={() => {
                                  if (!entry.imageUrlCandidates[0] || typeof window === 'undefined') return;
                                  window.open(entry.imageUrlCandidates[0], '_blank', 'noopener,noreferrer');
                                }}
                              >
                                <ExternalLink className='h-3.5 w-3.5' />
                                Open Image
                              </Button>
                              <a href={rawSourceHref} target='_blank' rel='noopener noreferrer'>
                                <Button size='sm' variant='outline' className='gap-1.5'>
                                  <FileJson className='h-3.5 w-3.5' />
                                  Open Raw Source
                                </Button>
                              </a>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : viewMode === 'month' ? (
              <div className='space-y-4'>
                {groupedMonths.map((group) => (
                  <Card key={group.key} className='border-border/60 bg-background/85'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-base'>
                        {group.label} ({group.items.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='grid gap-2'>
                      {group.items.map((entry) => (
                        <button
                          key={entry.uid}
                          type='button'
                          onClick={() => setActiveEntry(entry)}
                          className='rounded-md border border-border/60 bg-muted/10 p-2 text-left transition hover:border-primary/40 hover:bg-muted/20'
                        >
                          <div className='flex flex-wrap items-center gap-1.5'>
                            <Badge variant='outline'>{SOURCE_LABELS[entry.source]}</Badge>
                            <Badge variant='outline' className={cn('capitalize', statusClassName(entry.status))}>
                              {STATUS_LABELS[entry.status]}
                            </Badge>
                            <Badge variant='outline' className={cn('capitalize', categoryClassName(entry.category))}>
                              {CATEGORY_LABELS[entry.category]}
                            </Badge>
                          </div>
                          <p className='mt-1 truncate text-sm font-medium'>{entry.title}</p>
                          <p className='truncate text-xs text-muted-foreground'>{formatRange(entry.startAt, entry.endAt)}</p>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className='border-border/60 bg-background/85'>
                <CardContent className='p-0'>
                  <ScrollArea className='h-[calc(100vh-22rem)] min-h-[420px]'>
                    <table className='w-full border-collapse text-sm'>
                      <thead className='sticky top-0 z-10 bg-background/95 backdrop-blur'>
                        <tr className='border-b'>
                          <th className='px-3 py-2 text-left font-medium'>Title</th>
                          <th className='px-3 py-2 text-left font-medium'>Source</th>
                          <th className='px-3 py-2 text-left font-medium'>Category</th>
                          <th className='px-3 py-2 text-left font-medium'>Status</th>
                          <th className='px-3 py-2 text-left font-medium'>Start</th>
                          <th className='px-3 py-2 text-left font-medium'>End</th>
                          <th className='px-3 py-2 text-left font-medium'>Priority</th>
                          <th className='px-3 py-2 text-left font-medium'>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.map((entry) => (
                          <tr key={entry.uid} className='border-b border-border/60'>
                            <td className='px-3 py-2'>
                              <p className='max-w-[360px] truncate font-medium'>{entry.title}</p>
                              <p className='max-w-[360px] truncate text-xs text-muted-foreground'>{entry.subtitle}</p>
                            </td>
                            <td className='px-3 py-2 text-xs'>{SOURCE_LABELS[entry.source]}</td>
                            <td className='px-3 py-2 text-xs'>{CATEGORY_LABELS[entry.category]}</td>
                            <td className='px-3 py-2 text-xs'>{STATUS_LABELS[entry.status]}</td>
                            <td className='px-3 py-2 text-xs'>{formatDateOnly(entry.startAt)}</td>
                            <td className='px-3 py-2 text-xs'>{formatDateOnly(entry.endAt)}</td>
                            <td className='px-3 py-2 text-xs'>{entry.priorityCode || '-'}</td>
                            <td className='px-3 py-2'>
                              <Button size='sm' variant='outline' onClick={() => setActiveEntry(entry)}>
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {totalPages > 1 ? (
              <div className='flex flex-wrap items-center justify-center gap-2'>
                <Button size='sm' variant='outline' disabled={safePage === 1} onClick={() => setPage(1)}>
                  First
                </Button>
                <Button size='sm' variant='outline' disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Prev
                </Button>
                <Badge variant='outline'>
                  Page {safePage} / {totalPages}
                </Badge>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={safePage === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
                <Button size='sm' variant='outline' disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
                  Last
                </Button>
              </div>
            ) : null}
          </>
        )}

        {loading && payload ? (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
            Refreshing timeline data...
          </div>
        ) : null}
      </div>

      <Dialog open={!!activeEntry} onOpenChange={(open) => !open && setActiveEntry(null)}>
        <DialogContent className='max-h-[92vh] max-w-4xl overflow-hidden'>
          {activeEntry ? (
            <>
              <DialogHeader>
                <DialogTitle className='pr-8'>{activeEntry.title}</DialogTitle>
                <DialogDescription>{activeEntry.subtitle}</DialogDescription>
              </DialogHeader>

              <ScrollArea className='max-h-[78vh] pr-2'>
                <div className='space-y-3'>
                  <div className='grid gap-3 md:grid-cols-[280px_minmax(0,1fr)]'>
                    <TimelineImage entry={activeEntry} />
                    <div className='space-y-2 text-sm'>
                      <div className='flex flex-wrap items-center gap-1.5'>
                        <Badge variant='outline'>{SOURCE_LABELS[activeEntry.source]}</Badge>
                        <Badge variant='outline' className={cn('capitalize', statusClassName(activeEntry.status))}>
                          {STATUS_LABELS[activeEntry.status]}
                        </Badge>
                        <Badge variant='outline' className={cn('capitalize', categoryClassName(activeEntry.category))}>
                          {CATEGORY_LABELS[activeEntry.category]}
                        </Badge>
                      </div>
                      <p className='text-xs text-muted-foreground'>{formatRange(activeEntry.startAt, activeEntry.endAt)}</p>
                      <p className='text-xs text-muted-foreground'>Duration: {activeEntry.durationDays !== null ? `${activeEntry.durationDays} days` : 'Unknown'}</p>
                      <div className='rounded-md border bg-muted/10 p-2 text-xs'>
                        <p>Internal ID: {activeEntry.refs.internalId || '-'}</p>
                        <p>Banner Key: {activeEntry.refs.bannerKey || '-'}</p>
                        <p>Target Ref: {activeEntry.refs.targetRef || '-'}</p>
                        <p>Source Key: {activeEntry.sourceFile}#{activeEntry.rowKey}</p>
                      </div>
                      {activeEntry.recurrenceHints?.startHint || activeEntry.recurrenceHints?.endHint ? (
                        <div className='rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-200'>
                          <p className='font-medium'>Recurrence Hints (display-only)</p>
                          <p>Start hint: {activeEntry.recurrenceHints.startHint || '-'}</p>
                          <p>End hint: {activeEntry.recurrenceHints.endHint || '-'}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {activeEntry.description ? (
                    <div className='rounded-md border bg-muted/10 p-3'>
                      <p className='mb-1 text-xs uppercase tracking-wide text-muted-foreground'>Description</p>
                      <p className='whitespace-pre-wrap text-sm'>{activeEntry.description}</p>
                    </div>
                  ) : null}

                  <div className='rounded-md border bg-muted/10 p-3'>
                    <p className='mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground'>
                      <Timer className='h-3.5 w-3.5' />
                      Parse Warnings
                    </p>
                    {activeEntry.parseWarnings.length ? (
                      <ul className='list-disc space-y-1 pl-4 text-xs text-amber-200'>
                        {activeEntry.parseWarnings.map((warning, index) => (
                          <li key={`${warning}_${index}`}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className='text-xs text-muted-foreground'>No warnings.</p>
                    )}
                  </div>

                  <div className='rounded-md border bg-muted/10 p-3'>
                    <p className='mb-1 text-xs uppercase tracking-wide text-muted-foreground'>Raw Row JSON</p>
                    <pre className='max-h-[320px] overflow-auto rounded-md border bg-background p-2 text-[11px]'>
                      {JSON.stringify(activeEntry.raw, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
