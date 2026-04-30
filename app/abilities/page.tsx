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
import { buildAbilitySearchDocument } from '@/lib/search/documents';
import { ExternalLink, Sparkles } from 'lucide-react';

type AbilityRow = {
  /** Source file the ability came from. */
  source: 'ability' | 'leader_ability' | 'ability_soul';
  /** Ability ID (the orderedmap row key). */
  id: string;
  /** Column 0 — usually `<faceCode>_<n>` for abilities, `<faceCode>` for leader_ability. */
  key: string;
  /** Best-guess "trigger" or context column, only present for some sources. */
  trigger: string;
  /** Best-guess derived character face code (column 0 stripped of trailing `_N`). */
  faceCode: string;
  raw: unknown[];
};

type Source = AbilityRow['source'];

const SOURCE_META: Record<Source, { label: string; description: string; file: string }> = {
  ability: {
    label: 'Character Ability',
    description: 'Per-character abilities (`ability.json`). Keys look like `alk_1`, `alk_2`.',
    file: 'ability',
  },
  leader_ability: {
    label: 'Leader Ability',
    description: 'Leader buffs applied when this character leads a party (`leader_ability.json`).',
    file: 'leader_ability',
  },
  ability_soul: {
    label: 'Ability Soul',
    description: 'Soul-slot abilities awarded by mana board / equipment (`ability_soul.json`).',
    file: 'ability_soul',
  },
};

function asTextArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  if (Array.isArray(value[0])) return value[0] as unknown[];
  return value;
}

function deriveFaceCode(rawKey: string): string {
  // ability.json keys look like `alk_1` / `alk_2` etc. Strip the trailing index
  // so we can group abilities by character.
  const match = rawKey.match(/^(.*?)_(\d+)$/);
  return match ? match[1] : rawKey;
}

function rowsFromOrderedMap(map: Record<string, unknown>, source: Source): AbilityRow[] {
  const out: AbilityRow[] = [];
  for (const [id, raw] of Object.entries(map)) {
    const cells = asTextArray(raw);
    const key = String(cells[0] ?? '').trim();
    if (!key) continue;
    const trigger = source === 'ability' ? String(cells[2] ?? '').trim() : '';
    out.push({
      source,
      id,
      key,
      trigger,
      faceCode: deriveFaceCode(key),
      raw: cells,
    });
  }
  return out;
}

const PAGE_SIZE = 100;

function AbilitiesPageClient() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(qParam);
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all');
  const [rows, setRows] = useState<AbilityRow[]>([]);
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
        const sources: Source[] = ['ability', 'leader_ability', 'ability_soul'];
        const responses = await Promise.all(
          sources.map((source) =>
            fetch(`/api/orderedmap/data?category=ability&file=${SOURCE_META[source].file}&lang=en`)
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null)
          )
        );
        if (cancelled) return;

        const merged: AbilityRow[] = [];
        sources.forEach((source, idx) => {
          const payload = responses[idx];
          if (payload && typeof payload === 'object' && 'data' in payload) {
            const data = (payload as { data: unknown }).data;
            if (data && typeof data === 'object') {
              merged.push(...rowsFromOrderedMap(data as Record<string, unknown>, source));
            }
          }
        });
        setRows(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ability data.');
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const base = rows.filter((row) => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      return true;
    });

    if (!query.trim()) return base;

    const documents = base.map((row) => buildAbilitySearchDocument(row));
    const rowByDocumentId = new Map(base.map((row) => [`ability:${row.source}:${row.id}`, row]));

    return searchDocuments(documents, query).results
      .map((result) => rowByDocumentId.get(result.document.id))
      .filter((row): row is AbilityRow => Boolean(row));
  }, [rows, sourceFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = useMemo(() => {
    const acc: Record<Source, number> = { ability: 0, leader_ability: 0, ability_soul: 0 };
    for (const row of rows) acc[row.source] += 1;
    return acc;
  }, [rows]);

  return (
    <PageShell>
      <SurfaceCard>
        <CardHeader>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2 text-xl'>
                <Sparkles className='h-5 w-5 text-primary' /> Ability Browser
              </CardTitle>
              <CardDescription>
                Search across <code>ability.json</code>, <code>leader_ability.json</code>, and{' '}
                <code>ability_soul.json</code>. Keys are typically <code>{'<faceCode>_<n>'}</code> —
                useful for figuring out which character a referenced ability belongs to.
              </CardDescription>
            </div>
            <Badge variant='outline' className='border-primary/30 bg-primary/5'>
              {rows.length.toLocaleString('en-US')} abilities
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
              placeholder='Search ability key or use id:/face:/source:...'
            />
            <div className='flex flex-wrap gap-1'>
              {(['all', 'ability', 'leader_ability', 'ability_soul'] as const).map((source) => (
                <Button
                  key={source}
                  variant={sourceFilter === source ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setSourceFilter(source);
                    setPage(1);
                  }}
                >
                  {source === 'all'
                    ? `All (${rows.length})`
                    : `${SOURCE_META[source].label} (${counts[source]})`}
                </Button>
              ))}
            </div>
          </div>

          {error && <InlineError>{error}</InlineError>}

          {loading ? (
            <InlineLoading>Loading abilities...</InlineLoading>
          ) : (
            <>
              <p className='text-xs text-muted-foreground'>
                Showing {paginated.length.toLocaleString('en-US')} of{' '}
                {filtered.length.toLocaleString('en-US')} matches
                {filtered.length !== rows.length ? ` (filtered from ${rows.length.toLocaleString('en-US')})` : ''}.
              </p>
              <div className='overflow-hidden rounded-md border'>
                <table className='w-full text-sm'>
                  <thead className='border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground'>
                    <tr>
                      <th className='px-3 py-2 text-left'>Source</th>
                      <th className='px-3 py-2 text-left'>ID</th>
                      <th className='px-3 py-2 text-left'>Key</th>
                      <th className='px-3 py-2 text-left'>Face code</th>
                      <th className='px-3 py-2 text-left'>Trigger</th>
                      <th className='px-3 py-2'></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row) => {
                      const rowId = `${row.source}:${row.id}`;
                      const expanded = expandedId === rowId;
                      return (
                        <Fragment key={rowId}>
                          <tr className='border-t hover:bg-muted/20'>
                            <td className='px-3 py-2 align-top'>
                              <Badge variant='outline' className='whitespace-nowrap text-[10px]'>
                                {SOURCE_META[row.source].label}
                              </Badge>
                            </td>
                            <td className='px-3 py-2 align-top font-mono text-xs text-muted-foreground'>
                              {row.id}
                            </td>
                            <td className='px-3 py-2 align-top font-mono text-xs'>{row.key}</td>
                            <td className='px-3 py-2 align-top'>
                              {row.faceCode ? (
                                <Link
                                  href={`/characters/${encodeURIComponent(row.faceCode)}`}
                                  className='text-primary underline-offset-2 hover:underline'
                                >
                                  {row.faceCode}
                                </Link>
                              ) : (
                                <span className='text-muted-foreground'>—</span>
                              )}
                            </td>
                            <td className='px-3 py-2 align-top text-xs text-muted-foreground'>
                              {row.trigger || '—'}
                            </td>
                            <td className='px-3 py-2 align-top text-right'>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => setExpandedId(expanded ? null : rowId)}
                              >
                                {expanded ? 'Hide' : 'Raw'}
                              </Button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className='border-t bg-muted/10'>
                              <td colSpan={6} className='px-3 py-2'>
                                <div className='mb-1 flex items-center justify-between'>
                                  <span className='text-xs text-muted-foreground'>
                                    Raw orderedmap row ({row.raw.length} columns)
                                  </span>
                                  <Link
                                    href={`/orderedmap?category=ability&file=${SOURCE_META[row.source].file}&lang=en`}
                                    className='inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline'
                                  >
                                    Open in OrderedMap <ExternalLink className='h-3 w-3' />
                                  </Link>
                                </div>
                                <pre className='max-h-64 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-snug'>
                                  {JSON.stringify(row.raw, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={6} className='px-3 py-6 text-center text-sm text-muted-foreground'>
                          No abilities matched your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

function AbilitiesPageFallback() {
  return (
    <PageShell>
      <SurfaceCard>
        <CardContent className='flex min-h-48 items-center justify-center'>
          <InlineLoading>Loading abilities...</InlineLoading>
        </CardContent>
      </SurfaceCard>
    </PageShell>
  );
}

export default function AbilitiesPage() {
  return (
    <Suspense fallback={<AbilitiesPageFallback />}>
      <AbilitiesPageClient />
    </Suspense>
  );
}
