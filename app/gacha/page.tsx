'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Clock3,
  Gem,
  Languages,
  Loader2,
  Search,
  Sparkles,
  Ticket,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Lang = 'en' | 'jp';
type StatusFilter = 'all' | 'live' | 'upcoming' | 'ended' | 'unknown';
type PoolFilter = 'all' | 'character' | 'equipment';
type GachaStatus = 'live' | 'upcoming' | 'ended' | 'unknown';
type PoolKind = 'character' | 'equipment' | 'mixed' | 'other';
type OddsPoolKey = 'character3' | 'character4' | 'character5' | 'equipment3' | 'equipment4' | 'equipment5';

interface GachaOddsKeys {
  character3: string | null;
  character4: string | null;
  character5: string | null;
  equipment3: string | null;
  equipment4: string | null;
  equipment5: string | null;
}

interface GachaEntry {
  order: string;
  orderNum: number;
  gachaId: string;
  title: string;
  bannerPath: string | null;
  startAt: Date | null;
  endAt: Date | null;
  archiveEndAt: Date | null;
  oddsKeys: GachaOddsKeys;
  poolKind: PoolKind;
}

interface SummaryRow {
  name: string;
  rank: number | null;
  odd: number | null;
  rate: number | null;
  localRate: number | null;
  isPickup: boolean;
}

interface SummarySection {
  id: string;
  label: string;
  rows: SummaryRow[];
}

interface RateUpCharacter {
  name: string;
  rate: number | null;
  rarity: number | null;
  sectionId: string;
  sectionLabel: string;
}

interface OddsRow {
  key: string;
  assetId: string;
  rarity: number | null;
  weight: number | null;
  isPickup: boolean;
  isLimited: boolean;
  isFeature: boolean;
}

interface OddsPool {
  poolKey: OddsPoolKey;
  sourceFile: string;
  rows: OddsRow[];
  totalWeight: number;
}

interface BannerDetail {
  summaryFile: string | null;
  summarySections: SummarySection[];
  rawPools: OddsPool[];
  missingPoolKeys: OddsPoolKey[];
}

interface OrderedMapDataPayload {
  data?: unknown;
}

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const NONE_TOKEN = '(None)';

const POOL_LABELS: Record<OddsPoolKey, string> = {
  character3: 'Character 3★',
  character4: 'Character 4★',
  character5: 'Character 5★',
  equipment3: 'Armament 3★',
  equipment4: 'Armament 4★',
  equipment5: 'Armament 5★',
};

const SUMMARY_KEY_LABELS: Record<string, string> = {
  rarity3: 'Character 3★',
  rarity4: 'Character 4★',
  rarity5: 'Character 5★',
  equipment3: 'Armament 3★',
  equipment4: 'Armament 4★',
  equipment5: 'Armament 5★',
};

const STATUS_LABELS: Record<GachaStatus, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  ended: 'Ended',
  unknown: 'Unknown',
};

function cleanToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === NONE_TOKEN) return null;
  return trimmed;
}

function parseDateToken(value: unknown): Date | null {
  const token = cleanToken(value);
  if (!token) return null;
  const normalized = token.includes('T') ? token : token.replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(token);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toSafeNumber(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function derivePoolKind(oddsKeys: GachaOddsKeys): PoolKind {
  const hasCharacter = Boolean(oddsKeys.character3 || oddsKeys.character4 || oddsKeys.character5);
  const hasEquipment = Boolean(oddsKeys.equipment3 || oddsKeys.equipment4 || oddsKeys.equipment5);
  if (hasCharacter && hasEquipment) return 'mixed';
  if (hasCharacter) return 'character';
  if (hasEquipment) return 'equipment';
  return 'other';
}

function parseGachaEntries(input: unknown): GachaEntry[] {
  if (!input || typeof input !== 'object') return [];

  const output: GachaEntry[] = [];
  for (const [order, value] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;

    const gachaId = cleanToken(value[0]);
    const title = cleanToken(value[1]);
    if (!gachaId) continue;

    const oddsKeys: GachaOddsKeys = {
      character3: cleanToken(value[14]),
      character4: cleanToken(value[15]),
      character5: cleanToken(value[16]),
      equipment3: cleanToken(value[22]),
      equipment4: cleanToken(value[23]),
      equipment5: cleanToken(value[24]),
    };

    output.push({
      order,
      orderNum: Number.parseInt(order, 10) || 0,
      gachaId,
      title: title || gachaId,
      bannerPath: cleanToken(value[3]),
      startAt: parseDateToken(value[29]),
      endAt: parseDateToken(value[30]),
      archiveEndAt: parseDateToken(value[31]),
      oddsKeys,
      poolKind: derivePoolKind(oddsKeys),
    });
  }

  output.sort((a, b) => {
    const aTime = a.startAt?.getTime() ?? 0;
    const bTime = b.startAt?.getTime() ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.orderNum - a.orderNum;
  });

  return output;
}

function getBannerCandidates(pathValue: string | null): string[] {
  if (!pathValue) return [];
  if (/^https?:\/\//i.test(pathValue)) return [pathValue];

  const normalized = pathValue.replace(/^\/+/, '');
  if (!normalized) return [];
  if (/\.[a-z0-9]{2,5}$/i.test(normalized)) return [`${CDN_ROOT}/${normalized}`];

  return [`${CDN_ROOT}/${normalized}.png`, `${CDN_ROOT}/${normalized}.jpg`, `${CDN_ROOT}/${normalized}.webp`];
}

function getGachaStatus(entry: GachaEntry, nowMs: number): GachaStatus {
  if (!entry.startAt || !entry.endAt) return 'unknown';
  const startMs = entry.startAt.getTime();
  const endMs = entry.endAt.getTime();
  if (nowMs < startMs) return 'upcoming';
  if (nowMs > endMs) return 'ended';
  return 'live';
}

function formatDateTime(value: Date | null): string {
  if (!value) return 'Unknown';
  return value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--';
  return `${value.toFixed(3)}%`;
}

function getSummaryCandidateNames(entry: GachaEntry): string[] {
  const names = [
    `${entry.gachaId}_${entry.title}`,
    `${entry.gachaId}_${entry.title.replace(/[\\/:*?"<>|]/g, '_')}`,
    `${entry.gachaId}_${entry.title.replace(/[\\/:*?"<>|]/g, ' ')}`,
  ];

  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

function extractRateUpCharactersFromSections(sections: SummarySection[]): RateUpCharacter[] {
  const output: RateUpCharacter[] = [];

  for (const section of sections) {
    if (!section.id.startsWith('rarity')) continue;

    const nonPickupRates = section.rows
      .filter((row) => !row.isPickup && row.rate !== null)
      .map((row) => row.rate as number);
    const baseline =
      nonPickupRates.length > 0
        ? nonPickupRates.reduce((sum, rate) => sum + rate, 0) / nonPickupRates.length
        : null;

    for (const row of section.rows) {
      if (!row.isPickup) continue;
      if (baseline !== null) {
        if (row.rate === null) continue;
        if (row.rate <= baseline) continue;
      }

      output.push({
        name: row.name,
        rate: row.rate,
        rarity: row.rank,
        sectionId: section.id,
        sectionLabel: section.label,
      });
    }
  }

  const deduped = new Map<string, RateUpCharacter>();
  for (const item of output) {
    const key = `${item.sectionId}::${item.name.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return Array.from(deduped.values()).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

function getSummarySections(data: unknown): SummarySection[] {
  if (!data || typeof data !== 'object') return [];

  const sections: SummarySection[] = [];
  for (const [key, label] of Object.entries(SUMMARY_KEY_LABELS)) {
    const rows = (data as Record<string, unknown>)[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const parsedRows: SummaryRow[] = rows
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const dataRow = row as Record<string, unknown>;
        const nameToken = cleanToken(dataRow.name) || 'Unknown';
        return {
          name: nameToken,
          rank: toSafeNumber(dataRow.rank),
          odd: toSafeNumber(dataRow.odd),
          rate: toSafeNumber(dataRow.rate),
          localRate: toSafeNumber(dataRow.localRate),
          isPickup: toBool(dataRow.isPickup),
        };
      })
      .filter((row): row is SummaryRow => row !== null);

    if (parsedRows.length === 0) continue;
    sections.push({ id: key, label, rows: parsedRows });
  }

  return sections;
}

function parseOddsPool(poolKey: OddsPoolKey, sourceFile: string, data: unknown): OddsPool | null {
  if (!data || typeof data !== 'object') return null;
  const firstValue = Object.values(data as Record<string, unknown>)[0];
  if (!firstValue || typeof firstValue !== 'object') return null;

  const rows: OddsRow[] = [];
  for (const [index, value] of Object.entries(firstValue as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;

    const assetId = cleanToken(value[0]) || `row_${index}`;
    rows.push({
      key: `${poolKey}_${index}`,
      assetId,
      rarity: toSafeNumber(value[1]),
      weight: toSafeNumber(value[2]),
      isPickup: toBool(value[3]),
      isLimited: toBool(value[4]),
      isFeature: toBool(value[5]),
    });
  }

  rows.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const totalWeight = rows.reduce((sum, row) => sum + (row.weight ?? 0), 0);

  return { poolKey, sourceFile, rows, totalWeight };
}

async function fetchOrderedMapData(
  lang: Lang,
  category: string,
  file: string,
  signal?: AbortSignal
): Promise<unknown | null> {
  const params = new URLSearchParams({ lang, category, file });
  const response = await fetch(`/api/orderedmap/data?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as OrderedMapDataPayload;
  return payload.data ?? null;
}

function BannerImage({
  pathValue,
  alt,
  className,
}: {
  pathValue: string | null;
  alt: string;
  className?: string;
}) {
  const candidates = useMemo(() => getBannerCandidates(pathValue), [pathValue]);
  const [index, setIndex] = useState(0);

  const activeSrc = candidates[index];
  if (!activeSrc) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[96px] w-full items-center justify-center rounded-md border border-dashed bg-muted/20',
          className
        )}
      >
        <Sparkles className='h-4 w-4 text-muted-foreground' />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeSrc}
      alt={alt}
      className={cn('h-full w-full rounded-md border object-cover', className)}
      loading='lazy'
      decoding='async'
      onError={() => {
        setIndex((current) => (current + 1 < candidates.length ? current + 1 : current));
      }}
    />
  );
}

export default function GachaPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [entries, setEntries] = useState<GachaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');
  const [rateUpQuery, setRateUpQuery] = useState('');
  const [rateUpOnly, setRateUpOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BannerDetail | null>(null);
  const [rateUpIndex, setRateUpIndex] = useState<Record<string, RateUpCharacter[]>>({});
  const [rateUpIndexReadyByLang, setRateUpIndexReadyByLang] = useState<Record<Lang, boolean>>({
    en: false,
    jp: false,
  });
  const [rateUpIndexLoading, setRateUpIndexLoading] = useState(false);
  const [rateUpIndexProgress, setRateUpIndexProgress] = useState({ done: 0, total: 0 });
  const [rateUpIndexError, setRateUpIndexError] = useState<string | null>(null);

  const detailCacheRef = useRef<Map<string, BannerDetail>>(new Map());
  const nowMs = Date.now();
  const rateUpQueryNormalized = rateUpQuery.trim().toLowerCase();
  const rateUpFilterActive = rateUpOnly || rateUpQueryNormalized.length > 0;
  const rateUpIndexReady = rateUpIndexReadyByLang[lang];

  useEffect(() => {
    const controller = new AbortController();

    async function loadGachaData() {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchOrderedMapData(lang, 'gacha', 'gacha', controller.signal);
        if (!payload) throw new Error('No gacha data returned');

        const parsed = parseGachaEntries(payload);
        setEntries(parsed);
        setSelectedOrder((current) => {
          if (current && parsed.some((entry) => entry.order === current)) return current;
          return parsed[0]?.order ?? null;
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Failed to load gacha page data:', loadError);
        setEntries([]);
        setSelectedOrder(null);
        setError('Failed to load gacha banners.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadGachaData();
    return () => controller.abort();
  }, [lang]);

  useEffect(() => {
    if (!rateUpFilterActive || entries.length === 0 || rateUpIndexReady) return;

    let cancelled = false;
    const controller = new AbortController();

    async function buildRateUpIndex() {
      setRateUpIndexLoading(true);
      setRateUpIndexError(null);
      setRateUpIndexProgress({ done: 0, total: entries.length });

      const batchSize = 10;
      let done = 0;

      for (let i = 0; i < entries.length; i += batchSize) {
        const slice = entries.slice(i, i + batchSize);
        const chunkResults = await Promise.all(
          slice.map(async (entry) => {
            const key = `${lang}:${entry.gachaId}`;

            const detailKey = `${lang}:${entry.gachaId}`;
            const cachedDetail = detailCacheRef.current.get(detailKey);
            if (cachedDetail?.summarySections.length) {
              return { key, chars: extractRateUpCharactersFromSections(cachedDetail.summarySections) };
            }

            let sections: SummarySection[] = [];
            for (const candidate of getSummaryCandidateNames(entry)) {
              const summaryData = await fetchOrderedMapData(lang, 'gacha_odds/summaries', candidate, controller.signal);
              if (!summaryData) continue;
              sections = getSummarySections(summaryData);
              if (sections.length > 0) break;
            }

            return { key, chars: extractRateUpCharactersFromSections(sections) };
          })
        );

        if (cancelled) return;
        const patch: Record<string, RateUpCharacter[]> = {};
        for (const result of chunkResults) patch[result.key] = result.chars;
        setRateUpIndex((prev) => ({ ...prev, ...patch }));

        done += slice.length;
        setRateUpIndexProgress({ done, total: entries.length });
      }

      if (cancelled) return;
      setRateUpIndexReadyByLang((prev) => ({ ...prev, [lang]: true }));
      setRateUpIndexLoading(false);
    }

    void buildRateUpIndex().catch((indexError) => {
      if (cancelled) return;
      console.error('Failed to build gacha rate-up index:', indexError);
      setRateUpIndexLoading(false);
      setRateUpIndexError('Rate-up index failed to load. You can still use normal banner filters.');
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entries, lang, rateUpFilterActive, rateUpIndexReady]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const status = getGachaStatus(entry, nowMs);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (poolFilter !== 'all' && entry.poolKind !== poolFilter) return false;
      if (q) {
        const haystack = `${entry.gachaId} ${entry.title}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (rateUpFilterActive) {
        const rateUps = rateUpIndex[`${lang}:${entry.gachaId}`] || [];
        const hasRateUp = rateUps.length > 0;

        if (rateUpIndexReady) {
          if (!hasRateUp) return false;
          if (rateUpQueryNormalized) {
            const matches = rateUps.some((rateUp) => rateUp.name.toLowerCase().includes(rateUpQueryNormalized));
            if (!matches) return false;
          }
        }
      }

      return true;
    });
  }, [
    entries,
    lang,
    nowMs,
    poolFilter,
    query,
    rateUpFilterActive,
    rateUpIndex,
    rateUpIndexReady,
    rateUpQueryNormalized,
    statusFilter,
  ]);

  const selectedEntry = useMemo(() => {
    if (filteredEntries.length === 0) return null;
    return filteredEntries.find((entry) => entry.order === selectedOrder) ?? filteredEntries[0];
  }, [filteredEntries, selectedOrder]);

  useEffect(() => {
    if (!selectedEntry) return;
    if (selectedEntry.order !== selectedOrder) {
      setSelectedOrder(selectedEntry.order);
    }
  }, [selectedEntry, selectedOrder]);

  useEffect(() => {
    const entry = selectedEntry;
    if (!entry) {
      setDetail(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }
    const activeEntry = entry;

    const cacheKey = `${lang}:${activeEntry.gachaId}`;
    const cached = detailCacheRef.current.get(cacheKey);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    const controller = new AbortController();

    async function loadBannerDetail() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const summaryCandidateNames = getSummaryCandidateNames(activeEntry);

        let summarySections: SummarySection[] = [];
        let summaryFile: string | null = null;

        for (const candidate of summaryCandidateNames) {
          const summaryData = await fetchOrderedMapData(lang, 'gacha_odds/summaries', candidate, controller.signal);
          if (!summaryData) continue;
          summarySections = getSummarySections(summaryData);
          summaryFile = candidate;
          break;
        }

        const rawPoolEntries = (
          Object.entries(activeEntry.oddsKeys) as Array<[OddsPoolKey, string | null]>
        ).filter(
          ([, poolFile]) => Boolean(poolFile)
        );

        const rawPools: OddsPool[] = [];
        const missingPoolKeys: OddsPoolKey[] = [];
        await Promise.all(
          rawPoolEntries.map(async ([poolKey, poolFile]) => {
            if (!poolFile) return;
            const poolData = await fetchOrderedMapData(lang, 'gacha_odds', poolFile, controller.signal);
            if (!poolData) {
              missingPoolKeys.push(poolKey);
              return;
            }
            const parsedPool = parseOddsPool(poolKey, poolFile, poolData);
            if (!parsedPool) {
              missingPoolKeys.push(poolKey);
              return;
            }
            rawPools.push(parsedPool);
          })
        );

        rawPools.sort((a, b) => b.rows.length - a.rows.length);
        missingPoolKeys.sort((a, b) => POOL_LABELS[a].localeCompare(POOL_LABELS[b]));

        const finalDetail: BannerDetail = {
          summaryFile,
          summarySections,
          rawPools,
          missingPoolKeys,
        };
        const rateUpKey = `${lang}:${activeEntry.gachaId}`;
        const detailRateUps = extractRateUpCharactersFromSections(summarySections);

        detailCacheRef.current.set(cacheKey, finalDetail);
        if (!controller.signal.aborted) {
          setDetail(finalDetail);
          setRateUpIndex((prev) => (prev[rateUpKey] ? prev : { ...prev, [rateUpKey]: detailRateUps }));
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Failed to load gacha detail:', loadError);
        setDetail(null);
        setDetailError('Could not load odds detail for this banner.');
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }

    void loadBannerDetail();
    return () => controller.abort();
  }, [lang, selectedEntry]);

  const statusCounts = useMemo(() => {
    const counts: Record<GachaStatus, number> = {
      live: 0,
      upcoming: 0,
      ended: 0,
      unknown: 0,
    };
    for (const entry of entries) {
      counts[getGachaStatus(entry, nowMs)] += 1;
    }
    return counts;
  }, [entries, nowMs]);

  const selectedEntryRateUps = useMemo(() => {
    if (!selectedEntry) return [];
    const indexed = rateUpIndex[`${lang}:${selectedEntry.gachaId}`];
    if (indexed) return indexed;
    if (detail?.summarySections.length) return extractRateUpCharactersFromSections(detail.summarySections);
    return [];
  }, [detail, lang, rateUpIndex, selectedEntry]);

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.08),transparent_45%)]'>
      <div className='mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/85 backdrop-blur'>
          <CardHeader className='pb-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2 text-xl'>
                  <Ticket className='h-5 w-5 text-primary' />
                  Gacha Banner Explorer
                </CardTitle>
                <CardDescription>
                  Banner-first view with searchable portals, lifecycle status, and odds pool details.
                </CardDescription>
              </div>
              <div className='inline-flex items-center gap-1 rounded-md border bg-muted/20 p-1'>
                <Button
                  size='sm'
                  variant={lang === 'en' ? 'default' : 'ghost'}
                  onClick={() => setLang('en')}
                  className='gap-1.5'
                >
                  <Languages className='h-3.5 w-3.5' />
                  EN
                </Button>
                <Button size='sm' variant={lang === 'jp' ? 'default' : 'ghost'} onClick={() => setLang('jp')}>
                  JP
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]'>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Search by banner title or key'
                  className='pl-9'
                />
              </div>
              <div className='inline-flex rounded-md border bg-muted/20 p-1'>
                {(['all', 'live', 'upcoming', 'ended'] as const).map((status) => (
                  <Button
                    key={status}
                    size='sm'
                    variant={statusFilter === status ? 'default' : 'ghost'}
                    onClick={() => setStatusFilter(status)}
                    className='capitalize'
                  >
                    {status}
                  </Button>
                ))}
              </div>
              <div className='inline-flex rounded-md border bg-muted/20 p-1'>
                {(['all', 'character', 'equipment'] as const).map((pool) => (
                  <Button
                    key={pool}
                    size='sm'
                    variant={poolFilter === pool ? 'default' : 'ghost'}
                    onClick={() => setPoolFilter(pool)}
                    className='capitalize'
                  >
                    {pool}
                  </Button>
                ))}
              </div>
            </div>
            <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='relative'>
                <Gem className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={rateUpQuery}
                  onChange={(event) => setRateUpQuery(event.target.value)}
                  placeholder='Search rate-up character (pickup + above baseline)'
                  className='pl-9'
                />
              </div>
              <div className='inline-flex rounded-md border bg-muted/20 p-1'>
                <Button
                  size='sm'
                  variant={rateUpOnly ? 'default' : 'ghost'}
                  onClick={() => setRateUpOnly((value) => !value)}
                >
                  Has Rate-Up
                </Button>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <Badge variant='outline'>Total: {entries.length}</Badge>
              <Badge variant='outline'>Filtered: {filteredEntries.length}</Badge>
              <Badge variant='outline'>Live: {statusCounts.live}</Badge>
              <Badge variant='outline'>Upcoming: {statusCounts.upcoming}</Badge>
              <Badge variant='outline'>Ended: {statusCounts.ended}</Badge>
              {rateUpFilterActive ? (
                <Badge variant='outline' className='gap-1'>
                  {rateUpIndexLoading ? <Loader2 className='h-3 w-3 animate-spin' /> : null}
                  Rate-Up Index: {rateUpIndexReady ? 'Ready' : `${rateUpIndexProgress.done}/${rateUpIndexProgress.total || entries.length}`}
                </Badge>
              ) : null}
            </div>
            {rateUpIndexError ? (
              <p className='text-xs text-amber-300'>{rateUpIndexError}</p>
            ) : null}
            {rateUpFilterActive && !rateUpIndexReady ? (
              <p className='text-xs text-muted-foreground'>
                Building character pickup index. Rate-up filters apply fully when indexing completes.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <div className='grid gap-4 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]'>
          <Card className='border-border/60 bg-background/85'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Banner List</CardTitle>
              <CardDescription>Sorted by start date (newest first).</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='flex h-[360px] items-center justify-center text-sm text-muted-foreground'>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Loading gacha banners...
                </div>
              ) : error ? (
                <p className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                  {error}
                </p>
              ) : filteredEntries.length === 0 ? (
                <div className='flex h-[360px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground'>
                  No banners match the current filters.
                </div>
              ) : (
                <div className='h-[calc(100vh-20rem)] min-h-[420px] overflow-y-auto pr-1'>
                  <div className='space-y-2'>
                    {filteredEntries.map((entry) => {
                      const selected = selectedEntry?.order === entry.order;
                      const status = getGachaStatus(entry, nowMs);
                      const rateUps = rateUpIndex[`${lang}:${entry.gachaId}`] || [];
                      const topRateUps = rateUps.slice(0, 2).map((item) => item.name);
                      return (
                        <button
                          key={entry.order}
                          type='button'
                          onClick={() => setSelectedOrder(entry.order)}
                          className={cn(
                            'w-full rounded-lg border p-2 text-left transition',
                            selected
                              ? 'border-primary bg-primary/8 shadow-sm'
                              : 'border-border/70 bg-muted/10 hover:border-primary/40 hover:bg-muted/20'
                          )}
                        >
                          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                            <div className='min-w-0 flex-1'>
                              <p className='truncate text-sm font-semibold'>{entry.title}</p>
                              <p className='truncate text-xs text-muted-foreground'>{entry.gachaId}</p>
                              <div className='mt-2 flex flex-wrap items-center gap-1'>
                                <Badge
                                  variant='outline'
                                  className={cn(
                                    status === 'live' && 'border-emerald-500/40 text-emerald-300',
                                    status === 'upcoming' && 'border-cyan-500/40 text-cyan-300',
                                    status === 'ended' && 'border-amber-500/40 text-amber-300'
                                  )}
                                >
                                  {STATUS_LABELS[status]}
                                </Badge>
                                <Badge variant='outline' className='capitalize'>
                                  {entry.poolKind}
                                </Badge>
                                {rateUps.length > 0 ? (
                                  <Badge variant='outline' className='border-fuchsia-500/40 text-fuchsia-300'>
                                    Rate-Up: {rateUps.length}
                                  </Badge>
                                ) : null}
                              </div>
                              {topRateUps.length > 0 ? (
                                <p className='mt-1 truncate text-[11px] text-fuchsia-200/90'>
                                  {topRateUps.join(', ')}
                                  {rateUps.length > topRateUps.length ? ' ...' : ''}
                                </p>
                              ) : null}
                            </div>
                            <div className='h-[76px] w-full shrink-0 sm:w-[152px]'>
                              <BannerImage pathValue={entry.bannerPath} alt={entry.title} className='h-[76px] w-full' />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='border-border/60 bg-background/85'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Banner Detail</CardTitle>
              <CardDescription>Selected portal metadata and odds breakdown.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {!selectedEntry ? (
                <div className='flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground'>
                  Select a banner to inspect details.
                </div>
              ) : (
                <>
                  <div className='overflow-hidden rounded-xl border bg-muted/10'>
                    <BannerImage
                      key={`${selectedEntry.gachaId}:${selectedEntry.bannerPath ?? 'none'}`}
                      pathValue={selectedEntry.bannerPath}
                      alt={selectedEntry.title}
                      className='h-[220px] w-full'
                    />
                    <div className='grid gap-2 border-t p-3 md:grid-cols-2'>
                      <div className='min-w-0'>
                        <p className='truncate text-base font-semibold'>{selectedEntry.title}</p>
                        <p className='truncate text-xs text-muted-foreground'>{selectedEntry.gachaId}</p>
                      </div>
                      <div className='flex flex-wrap items-center gap-1 md:justify-end'>
                        <Badge variant='outline' className='capitalize'>
                          {selectedEntry.poolKind}
                        </Badge>
                        <Badge variant='outline'>{STATUS_LABELS[getGachaStatus(selectedEntry, nowMs)]}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-2 rounded-lg border bg-muted/10 p-3 sm:grid-cols-3'>
                    <div>
                      <p className='mb-1 flex items-center gap-1 text-xs text-muted-foreground'>
                        <CalendarClock className='h-3.5 w-3.5' />
                        Start
                      </p>
                      <p className='text-sm font-medium'>{formatDateTime(selectedEntry.startAt)}</p>
                    </div>
                    <div>
                      <p className='mb-1 flex items-center gap-1 text-xs text-muted-foreground'>
                        <Clock3 className='h-3.5 w-3.5' />
                        End
                      </p>
                      <p className='text-sm font-medium'>{formatDateTime(selectedEntry.endAt)}</p>
                    </div>
                    <div>
                      <p className='mb-1 flex items-center gap-1 text-xs text-muted-foreground'>
                        <Sparkles className='h-3.5 w-3.5' />
                        Archive End
                      </p>
                      <p className='text-sm font-medium'>{formatDateTime(selectedEntry.archiveEndAt)}</p>
                    </div>
                  </div>

                  <div className='rounded-lg border bg-muted/10 p-3'>
                    <p className='mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>Odds Keys</p>
                    <div className='grid gap-2 sm:grid-cols-2'>
                      {(Object.entries(selectedEntry.oddsKeys) as Array<[OddsPoolKey, string | null]>).map(([key, value]) => (
                        <div key={key} className='rounded-md border bg-background/70 p-2'>
                          <p className='text-xs font-medium text-muted-foreground'>{POOL_LABELS[key]}</p>
                          <p className='truncate text-xs'>{value || 'Not set'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedEntryRateUps.length > 0 ? (
                    <div className='rounded-lg border bg-fuchsia-500/5 p-3'>
                      <p className='mb-2 flex items-center gap-1 text-sm font-semibold text-fuchsia-300'>
                        <Gem className='h-4 w-4' />
                        Character Rate-Up Picks
                      </p>
                      <div className='grid gap-2 sm:grid-cols-2'>
                        {selectedEntryRateUps.map((rateUp) => (
                          <div
                            key={`${rateUp.sectionId}:${rateUp.name}`}
                            className='rounded-md border border-fuchsia-500/20 bg-background/70 p-2'
                          >
                            <p className='truncate text-sm font-medium'>{rateUp.name}</p>
                            <p className='text-xs text-muted-foreground'>
                              {rateUp.sectionLabel} | Rate: {formatPercent(rateUp.rate)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detailLoading ? (
                    <div className='flex h-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground'>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Loading odds details...
                    </div>
                  ) : detailError ? (
                    <p className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                      {detailError}
                    </p>
                  ) : (
                    <>
                      {detail?.summarySections.length ? (
                        <div className='space-y-2 rounded-lg border bg-emerald-500/5 p-3'>
                          <p className='mb-1 flex items-center gap-1 text-sm font-semibold text-emerald-300'>
                            <Gem className='h-4 w-4' />
                            Parsed Rates
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Source: {detail.summaryFile ? `${detail.summaryFile}.json` : 'summary data'}
                          </p>
                          <div className='grid gap-2 lg:grid-cols-2'>
                            {detail.summarySections.map((section) => (
                              <div key={section.id} className='rounded-md border bg-background/70 p-2'>
                                <div className='mb-2 flex items-center justify-between'>
                                  <p className='text-sm font-medium'>{section.label}</p>
                                  <Badge variant='outline'>{section.rows.length}</Badge>
                                </div>
                                <div className='max-h-64 overflow-auto'>
                                  <table className='w-full border-collapse text-xs'>
                                    <thead>
                                      <tr className='border-b text-muted-foreground'>
                                        <th className='py-1 text-left font-medium'>Name</th>
                                        <th className='py-1 text-right font-medium'>Rate</th>
                                        <th className='py-1 text-right font-medium'>Pickup</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {section.rows.map((row, index) => (
                                        <tr key={`${section.id}_${row.name}_${index}`} className='border-b/40 border-b'>
                                          <td className='py-1 pr-2'>{row.name}</td>
                                          <td className='py-1 text-right'>{formatPercent(row.rate)}</td>
                                          <td className='py-1 text-right'>{row.isPickup ? 'Yes' : 'No'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {detail?.rawPools.length ? (
                        <div className='space-y-2 rounded-lg border bg-cyan-500/5 p-3'>
                          <p className='mb-1 flex items-center gap-1 text-sm font-semibold text-cyan-300'>
                            <Wrench className='h-4 w-4' />
                            Raw Odds Pools
                          </p>
                          <div className='space-y-2'>
                            {detail.rawPools.map((pool) => (
                              <div key={pool.poolKey} className='rounded-md border bg-background/70 p-2'>
                                <div className='mb-2 flex flex-wrap items-center gap-2'>
                                  <Badge variant='outline'>{POOL_LABELS[pool.poolKey]}</Badge>
                                  <Badge variant='outline'>Rows: {pool.rows.length}</Badge>
                                  <Badge variant='outline'>Total Weight: {pool.totalWeight.toLocaleString('en-US')}</Badge>
                                  <span className='text-xs text-muted-foreground'>File: {pool.sourceFile}.json</span>
                                </div>
                                <div className='max-h-64 overflow-auto'>
                                  <table className='w-full border-collapse text-xs'>
                                    <thead>
                                      <tr className='border-b text-muted-foreground'>
                                        <th className='py-1 text-left font-medium'>Asset ID</th>
                                        <th className='py-1 text-right font-medium'>Weight</th>
                                        <th className='py-1 text-right font-medium'>Pool %</th>
                                        <th className='py-1 text-right font-medium'>Pickup</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pool.rows.map((row) => {
                                        const poolRate =
                                          pool.totalWeight > 0 && row.weight !== null
                                            ? (row.weight / pool.totalWeight) * 100
                                            : null;
                                        return (
                                          <tr key={row.key} className='border-b/40 border-b'>
                                            <td className='py-1 pr-2'>{row.assetId}</td>
                                            <td className='py-1 text-right'>
                                              {row.weight === null ? '--' : row.weight.toLocaleString('en-US')}
                                            </td>
                                            <td className='py-1 text-right'>{formatPercent(poolRate)}</td>
                                            <td className='py-1 text-right'>{row.isPickup ? 'Yes' : 'No'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {detail && detail.summarySections.length === 0 && detail.rawPools.length === 0 ? (
                        <div className='rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground'>
                          No odds detail could be parsed for this banner.
                        </div>
                      ) : null}

                      {detail?.missingPoolKeys.length ? (
                        <div className='rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
                          Missing odds files: {detail.missingPoolKeys.map((key) => POOL_LABELS[key]).join(', ')}
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
