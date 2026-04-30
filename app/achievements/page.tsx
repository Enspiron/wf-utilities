'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InlineError,
  InlineLoading,
  PageShell,
  PaginationFooter,
  SearchField,
  SurfaceCard,
} from '@/components/ui/page-primitives';
import { searchDocuments } from '@/lib/search/core';
import { buildAchievementSearchDocument } from '@/lib/search/documents';
import { Award, ExternalLink, Trophy } from 'lucide-react';

type DegreeRow = {
  /** orderedmap row key (a numeric string). */
  id: string;
  /** Internal key (column 0) e.g. `degree_player_rank_growth_1`. */
  key: string;
  /** Display sort priority (column 1). */
  sortId: string;
  /** English title (column 2). */
  name: string;
  /** Japanese title (column 3). */
  nameJp: string;
  /** Acquisition criteria (column 4). */
  criteria: string;
  /** Category id (column 5) — 1 through 8. */
  category: string;
  /** Key prefix used for grouping (e.g. `player_rank_growth`). */
  prefix: string;
  raw: unknown[];
};

const CATEGORY_META: Record<string, { label: string; tone: string }> = {
  '1': { label: 'Story', tone: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  '2': { label: 'Character', tone: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
  '3': { label: 'Combat', tone: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  '4': { label: 'Event', tone: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  '5': { label: 'Progression', tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  '6': { label: 'Special', tone: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  '7': { label: 'Anniversary', tone: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  '8': { label: 'Misc', tone: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

function asRow(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  if (Array.isArray(value[0])) return value[0] as unknown[];
  return value;
}

function derivePrefix(internalKey: string): string {
  // `degree_player_rank_growth_1` → `player_rank_growth`
  const stripped = internalKey.replace(/^degree_/, '');
  return stripped.replace(/_\d+$/, '');
}

function rowsFromOrderedMap(map: Record<string, unknown>): DegreeRow[] {
  const out: DegreeRow[] = [];
  for (const [id, raw] of Object.entries(map)) {
    const cells = asRow(raw);
    if (!cells.length) continue;
    const key = String(cells[0] ?? '').trim();
    out.push({
      id,
      key,
      sortId: String(cells[1] ?? '').trim(),
      name: String(cells[2] ?? '').trim(),
      nameJp: String(cells[3] ?? '').trim(),
      criteria: String(cells[4] ?? '').trim(),
      category: String(cells[5] ?? '').trim(),
      prefix: derivePrefix(key),
      raw: cells,
    });
  }
  return out;
}

const PAGE_SIZE = 60;

function AchievementsPageClient() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(qParam);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [groupByPrefix, setGroupByPrefix] = useState(false);
  const [rows, setRows] = useState<DegreeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/orderedmap/data?category=degree&file=degree&lang=en');
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const payload = (await res.json()) as { data?: unknown };
        if (cancelled) return;
        if (payload && typeof payload.data === 'object' && payload.data) {
          setRows(rowsFromOrderedMap(payload.data as Record<string, unknown>));
        } else {
          setRows([]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load degrees.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const row of rows) acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, [rows]);

  const categories = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.category))).sort();
    return ids;
  }, [rows]);

  const filtered = useMemo(() => {
    const base = rows.filter((row) => {
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      return true;
    });

    if (!query.trim()) return base;

    const documents = base.map((row) => buildAchievementSearchDocument(row));
    const rowByDocumentId = new Map(base.map((row) => [`achievement:${row.id}`, row]));

    return searchDocuments(documents, query).results
      .map((result) => rowByDocumentId.get(result.document.id))
      .filter((row): row is DegreeRow => Boolean(row));
  }, [rows, categoryFilter, query]);

  const sorted = useMemo(() => {
    if (query.trim()) return filtered;

    return [...filtered].sort((a, b) => {
      if (groupByPrefix) {
        const p = a.prefix.localeCompare(b.prefix);
        if (p !== 0) return p;
      }
      const aN = Number(a.sortId);
      const bN = Number(b.sortId);
      if (Number.isFinite(aN) && Number.isFinite(bN) && aN !== bN) return aN - bN;
      return a.key.localeCompare(b.key);
    });
  }, [filtered, groupByPrefix, query]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <PageShell>
      <SurfaceCard>
        <CardHeader>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2 text-xl'>
                <Trophy className='h-5 w-5 text-primary' /> Achievements &amp; Titles
              </CardTitle>
              <CardDescription>
                Browsable list of player titles (<code>degree.json</code>) — the closest thing
                World Flipper has to an achievements list. Each row is a title the player could
                earn, with the acquisition condition shown inline.
              </CardDescription>
            </div>
            <Badge variant='outline' className='border-primary/30 bg-primary/5'>
              {rows.length.toLocaleString('en-US')} titles
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <SearchField
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder='Search title or use id:/prefix:/category:...'
            />
            <Button
              variant={groupByPrefix ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setGroupByPrefix((v) => !v);
                setPage(1);
              }}
              title='Group rows by shared key prefix (e.g. all `player_rank_growth` tiers together)'
            >
              Group by family
            </Button>
          </div>

          <div className='flex flex-wrap gap-1'>
            <Button
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setCategoryFilter('all');
                setPage(1);
              }}
            >
              All ({rows.length})
            </Button>
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat] ?? { label: `Cat ${cat}`, tone: '' };
              return (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setCategoryFilter(cat);
                    setPage(1);
                  }}
                >
                  {meta.label} ({counts[cat] ?? 0})
                </Button>
              );
            })}
          </div>

          {error && <InlineError>{error}</InlineError>}

          {loading ? (
            <InlineLoading>Loading titles...</InlineLoading>
          ) : (
            <>
              <p className='text-xs text-muted-foreground'>
                Showing {paginated.length.toLocaleString('en-US')} of{' '}
                {sorted.length.toLocaleString('en-US')} titles
                {sorted.length !== rows.length
                  ? ` (filtered from ${rows.length.toLocaleString('en-US')})`
                  : ''}
                .
              </p>
              <div className='grid gap-2 sm:grid-cols-2'>
                {paginated.map((row) => {
                  const expanded = expandedId === row.id;
                  const meta = CATEGORY_META[row.category] ?? { label: `Cat ${row.category}`, tone: '' };
                  return (
                    <Fragment key={row.id}>
                      <button
                        type='button'
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                        className='flex flex-col items-start gap-1 rounded-md border border-border/70 bg-background/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5'
                      >
                        <div className='flex w-full items-center justify-between gap-2'>
                          <span className='flex items-center gap-2 font-medium'>
                            <Award className='h-3.5 w-3.5 text-primary/70' />
                            {row.name || <span className='text-muted-foreground'>(unnamed)</span>}
                          </span>
                          <Badge variant='outline' className={`whitespace-nowrap text-[10px] ${meta.tone}`}>
                            {meta.label}
                          </Badge>
                        </div>
                        <span className='text-xs text-muted-foreground'>{row.criteria || '—'}</span>
                        <span className='font-mono text-[10px] text-muted-foreground/70'>
                          #{row.id} · {row.key}
                        </span>
                      </button>
                      {expanded && (
                        <div className='col-span-full rounded-md border border-primary/30 bg-primary/5 p-3 text-xs'>
                          <div className='mb-2 flex items-center justify-between'>
                            <div>
                              <div className='font-medium'>{row.name}</div>
                              {row.nameJp && (
                                <div className='text-muted-foreground'>{row.nameJp}</div>
                              )}
                            </div>
                            <Link
                              href={`/orderedmap?category=degree&file=degree&lang=en`}
                              className='inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline'
                            >
                              Open in OrderedMap <ExternalLink className='h-3 w-3' />
                            </Link>
                          </div>
                          <pre className='max-h-48 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-snug'>
                            {JSON.stringify(row.raw, null, 2)}
                          </pre>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
                {paginated.length === 0 && (
                  <p className='col-span-full rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground'>
                    No titles matched your filter.
                  </p>
                )}
              </div>

              {totalPages > 1 && (
                <PaginationFooter
                  page={safePage}
                  totalPages={totalPages}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              )}
            </>
          )}
        </CardContent>
      </SurfaceCard>
    </PageShell>
  );
}

function AchievementsPageFallback() {
  return (
    <PageShell>
      <SurfaceCard>
        <CardContent className='flex min-h-48 items-center justify-center'>
          <InlineLoading>Loading achievements...</InlineLoading>
        </CardContent>
      </SurfaceCard>
    </PageShell>
  );
}

export default function AchievementsPage() {
  return (
    <Suspense fallback={<AchievementsPageFallback />}>
      <AchievementsPageClient />
    </Suspense>
  );
}
