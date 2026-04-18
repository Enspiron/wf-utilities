import path from 'path';
import { promises as fs } from 'fs';
import type {
  FeatureTimelineEntry,
  FeatureTimelinePayload,
  TimelineCategory,
  TimelineLang,
  TimelineSource,
  TimelineStatus,
} from '@/lib/feature-timeline/types';

const IS_PRODUCTION = process.env.VERCEL === '1';
const ORDEREDMAP_CDN_BASE = 'https://wfjukebox.b-cdn.net/orderedmaps';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const NONE_TOKEN = '(None)';
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_STOPWORDS = new Set([
  'dynamic',
  'home',
  'banner',
  'feature',
  'announcement',
  'dialog',
  'etc',
  'event',
  'guide',
  'new',
  'the',
  'and',
  'for',
  'with',
  'to',
]);

function cleanToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === NONE_TOKEN) return null;
  return trimmed;
}

function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(value);
}

function buildImageCandidates(pathToken: string | null): string[] {
  if (!pathToken) return [];
  if (/^https?:\/\//i.test(pathToken)) return [pathToken];

  const normalized = pathToken.replace(/^\/+/, '');
  if (!normalized) return [];

  if (hasImageExtension(normalized)) {
    return [`${CDN_ROOT}/${normalized}`];
  }

  return [`${CDN_ROOT}/${normalized}.png`, `${CDN_ROOT}/${normalized}.jpg`, `${CDN_ROOT}/${normalized}.webp`];
}

function parseUtcDateToken(value: string | null): { iso: string | null; warning: string | null } {
  if (!value) return { iso: null, warning: null };

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/);
  if (!match) {
    return { iso: null, warning: `Invalid date token: ${value}` };
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4] ?? '0', 10);
  const minute = Number.parseInt(match[5] ?? '0', 10);
  const second = Number.parseInt(match[6] ?? '0', 10);

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  if (Number.isNaN(date.getTime())) {
    return { iso: null, warning: `Invalid date token: ${value}` };
  }

  return { iso: date.toISOString(), warning: null };
}

function parseDateMillis(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveStatus(startAt: string | null, endAt: string | null, nowMs: number): TimelineStatus {
  const startMs = parseDateMillis(startAt);
  const endMs = parseDateMillis(endAt);

  if (startMs === null && endMs === null) return 'unknown';
  if (startMs !== null && nowMs < startMs) return 'upcoming';
  if (endMs !== null && nowMs > endMs) return 'ended';
  return 'live';
}

function durationDays(startAt: string | null, endAt: string | null): number | null {
  const startMs = parseDateMillis(startAt);
  const endMs = parseDateMillis(endAt);
  if (startMs === null || endMs === null) return null;
  if (endMs < startMs) return null;
  return Math.floor((endMs - startMs) / DAY_MS) + 1;
}

function humanizeSlugToken(token: string | null, fallback: string): string {
  if (!token) return fallback;

  const cleaned = token
    .replace(/^dynamic\//i, '')
    .replace(/^feature_banner\//i, '')
    .replace(/\.[a-z0-9]{2,5}$/i, '');

  const raw = cleaned.split('/').filter(Boolean).pop() || cleaned;
  const words = raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return fallback;

  return words
    .map((word) => {
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function inferCategory(parts: Array<string | null>): TimelineCategory {
  const text = parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();

  if (text.includes('/gacha/') || text.includes('pickup')) return 'gacha';
  if (
    text.includes('/event/') ||
    text.includes('world_story_event') ||
    text.includes('raid') ||
    text.includes('advent') ||
    text.includes('bossbattle')
  ) {
    return 'event';
  }
  if (text.includes('campaign')) return 'campaign';
  if (text.includes('comic')) return 'comic';
  if (text.includes('/payment/') || text.includes('fukubukuro')) return 'payment';
  if (text.includes('questionnaire') || text.includes('survey')) return 'survey';
  if (text.includes('tower') || text.includes('encyclopedia') || text.includes('haunt') || text.includes('feature_guide_dialog')) {
    return 'system';
  }
  return 'other';
}

function inferTags(source: TimelineSource, category: TimelineCategory, parts: Array<string | null>): string[] {
  const tags = new Set<string>([source, category]);

  for (const part of parts) {
    if (!part) continue;

    const normalized = part
      .replace(/^https?:\/\//i, '')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .toLowerCase();

    for (const token of normalized.split(/[^a-z0-9]+/).filter(Boolean)) {
      if (TOKEN_STOPWORDS.has(token)) continue;
      if (token.length < 3) continue;
      tags.add(token);
      if (tags.size >= 18) break;
    }

    if (tags.size >= 18) break;
  }

  return [...tags];
}

function buildSourceApiUrl(dataFolder: string, category: string, file: string): string[] {
  return [
    `${ORDEREDMAP_CDN_BASE}/${dataFolder}/${category}/${file}.json`,
    `${GITHUB_RAW_URL}/${dataFolder}/${category}/${file}.json`,
  ];
}

async function loadOrderedMapData(lang: TimelineLang, category: string, file: string): Promise<unknown> {
  const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';

  if (IS_PRODUCTION) {
    const urls = buildSourceApiUrl(dataFolder, category, file);

    for (const url of urls) {
      const response = await fetch(url, { next: { revalidate: 3600 } });
      if (!response.ok) continue;
      return response.json();
    }

    throw new Error(`Could not load ${category}/${file} for ${lang}.`);
  }

  const filePath = path.join(process.cwd(), 'public', 'data', dataFolder, category, `${file}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

function normalizeFeatureBannerRows(rows: Record<string, unknown>, lang: TimelineLang, nowMs: number): FeatureTimelineEntry[] {
  const output: FeatureTimelineEntry[] = [];

  for (const [rowKey, row] of Object.entries(rows)) {
    if (!Array.isArray(row)) continue;

    const warnings: string[] = [];
    const title = cleanToken(row[2]) || `feature_banner_${rowKey}`;
    const imagePath = cleanToken(row[21]);
    const internalId = cleanToken(row[0]);
    const targetRef = cleanToken(row[3]);
    const startRaw = cleanToken(row[23]);
    const endRaw = cleanToken(row[24]);

    const startAt = parseUtcDateToken(startRaw);
    const endAt = parseUtcDateToken(endRaw);

    if (startAt.warning) warnings.push(startAt.warning);
    if (endAt.warning) warnings.push(endAt.warning);
    if (!imagePath) warnings.push('Missing imagePath');

    const status = deriveStatus(startAt.iso, endAt.iso, nowMs);
    const category = inferCategory([title, targetRef, imagePath]);

    output.push({
      uid: `feature_banner:${rowKey}`,
      source: 'feature_banner',
      rowKey,
      sourceFile: 'feature_banner/feature_banner',
      lang,
      title,
      subtitle: targetRef ? `target: ${targetRef}` : 'Home feature banner',
      description: null,
      imagePath,
      imageUrlCandidates: buildImageCandidates(imagePath),
      startAt: startAt.iso,
      endAt: endAt.iso,
      status,
      durationDays: durationDays(startAt.iso, endAt.iso),
      isPersistent: endAt.iso === null,
      isScheduled: startAt.iso !== null || endAt.iso !== null,
      category,
      tags: inferTags('feature_banner', category, [title, targetRef, imagePath]),
      priorityCode: internalId,
      refs: {
        internalId,
        bannerKey: cleanToken(row[2]),
        targetRef,
      },
      raw: row,
      parseWarnings: warnings,
      recurrenceHints: null,
    });
  }

  return output;
}

function normalizeFeatureAnnouncementRows(rows: Record<string, unknown>, lang: TimelineLang, nowMs: number): FeatureTimelineEntry[] {
  const output: FeatureTimelineEntry[] = [];

  for (const [rowKey, row] of Object.entries(rows)) {
    if (!Array.isArray(row)) continue;

    const warnings: string[] = [];
    const token = cleanToken(row[1]);
    const imagePath = token;
    const internalId = cleanToken(row[0]);

    const startAt = parseUtcDateToken(cleanToken(row[2]));
    const endAt = parseUtcDateToken(cleanToken(row[3]));

    if (startAt.warning) warnings.push(startAt.warning);
    if (endAt.warning) warnings.push(endAt.warning);
    if (!imagePath) warnings.push('Missing imagePath');

    const title = humanizeSlugToken(token, `Announcement ${rowKey}`);
    const status = deriveStatus(startAt.iso, endAt.iso, nowMs);
    const category = inferCategory([token, title]);

    output.push({
      uid: `feature_announcement:${rowKey}`,
      source: 'feature_announcement',
      rowKey,
      sourceFile: 'feature_banner/feature_announcement',
      lang,
      title,
      subtitle: token || 'Feature announcement',
      description: null,
      imagePath,
      imageUrlCandidates: buildImageCandidates(imagePath),
      startAt: startAt.iso,
      endAt: endAt.iso,
      status,
      durationDays: durationDays(startAt.iso, endAt.iso),
      isPersistent: endAt.iso === null,
      isScheduled: startAt.iso !== null || endAt.iso !== null,
      category,
      tags: inferTags('feature_announcement', category, [token, title]),
      priorityCode: internalId,
      refs: {
        internalId,
        bannerKey: null,
        targetRef: token,
      },
      raw: row,
      parseWarnings: warnings,
      recurrenceHints: null,
    });
  }

  return output;
}

function normalizeFeatureGuideDialogRows(rows: Record<string, unknown>, lang: TimelineLang, nowMs: number): FeatureTimelineEntry[] {
  const output: FeatureTimelineEntry[] = [];

  for (const [rowKey, row] of Object.entries(rows)) {
    if (!Array.isArray(row)) continue;

    const warnings: string[] = [];
    const title = cleanToken(row[1]) || `Guide Dialog ${rowKey}`;
    const description = cleanToken(row[3]);
    const imagePath = cleanToken(row[2]);
    const internalId = cleanToken(row[0]);
    const bannerKey = cleanToken(row[5]);
    const targetRef = cleanToken(row[2]);

    const startAt = parseUtcDateToken(cleanToken(row[24]));
    const endAt = parseUtcDateToken(cleanToken(row[25]));

    if (startAt.warning) warnings.push(startAt.warning);
    if (endAt.warning) warnings.push(endAt.warning);
    if (!imagePath) warnings.push('Missing imagePath');

    const recurrenceStart = cleanToken(row[26]);
    const recurrenceEnd = cleanToken(row[27]);

    if (recurrenceStart || recurrenceEnd) {
      warnings.push('Has recurrence hints (display-only)');
    }

    const status = deriveStatus(startAt.iso, endAt.iso, nowMs);
    const category = inferCategory([title, description, imagePath, 'feature_guide_dialog']);

    output.push({
      uid: `feature_guide_dialog:${rowKey}`,
      source: 'feature_guide_dialog',
      rowKey,
      sourceFile: 'feature_banner/feature_guide_dialog',
      lang,
      title,
      subtitle: imagePath ? `guide: ${imagePath}` : 'Feature guide dialog',
      description,
      imagePath,
      imageUrlCandidates: buildImageCandidates(imagePath),
      startAt: startAt.iso,
      endAt: endAt.iso,
      status,
      durationDays: durationDays(startAt.iso, endAt.iso),
      isPersistent: endAt.iso === null,
      isScheduled: startAt.iso !== null || endAt.iso !== null,
      category,
      tags: inferTags('feature_guide_dialog', category, [title, description, imagePath]),
      priorityCode: internalId,
      refs: {
        internalId,
        bannerKey,
        targetRef,
      },
      raw: row,
      parseWarnings: warnings,
      recurrenceHints: {
        startHint: recurrenceStart,
        endHint: recurrenceEnd,
      },
    });
  }

  return output;
}

function byTimeDesc(a: FeatureTimelineEntry, b: FeatureTimelineEntry): number {
  const aStart = parseDateMillis(a.startAt);
  const bStart = parseDateMillis(b.startAt);
  const aEnd = parseDateMillis(a.endAt);
  const bEnd = parseDateMillis(b.endAt);

  const aTime = aStart ?? aEnd ?? 0;
  const bTime = bStart ?? bEnd ?? 0;

  if (aTime !== bTime) return bTime - aTime;
  return a.uid.localeCompare(b.uid);
}

function buildCounts(entries: FeatureTimelineEntry[]): FeatureTimelinePayload['counts'] {
  const counts: FeatureTimelinePayload['counts'] = {
    total: entries.length,
    feature_banner: 0,
    feature_announcement: 0,
    feature_guide_dialog: 0,
    live: 0,
    upcoming: 0,
    ended: 0,
    unknown: 0,
  };

  for (const entry of entries) {
    counts[entry.source] += 1;
    counts[entry.status] += 1;
  }

  return counts;
}

export async function normalizeFeatureTimeline(lang: TimelineLang): Promise<FeatureTimelinePayload> {
  const nowMs = Date.now();
  const partialWarnings: string[] = [];
  const entries: FeatureTimelineEntry[] = [];

  const sources: Array<{
    source: TimelineSource;
    file: string;
    parser: (rows: Record<string, unknown>, parseLang: TimelineLang, now: number) => FeatureTimelineEntry[];
  }> = [
    {
      source: 'feature_banner',
      file: 'feature_banner',
      parser: normalizeFeatureBannerRows,
    },
    {
      source: 'feature_announcement',
      file: 'feature_announcement',
      parser: normalizeFeatureAnnouncementRows,
    },
    {
      source: 'feature_guide_dialog',
      file: 'feature_guide_dialog',
      parser: normalizeFeatureGuideDialogRows,
    },
  ];

  await Promise.all(
    sources.map(async ({ source, file, parser }) => {
      try {
        const dataset = await loadOrderedMapData(lang, 'feature_banner', file);
        if (!dataset || typeof dataset !== 'object') {
          partialWarnings.push(`Source ${source} returned no object payload.`);
          return;
        }

        entries.push(...parser(dataset as Record<string, unknown>, lang, nowMs));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        partialWarnings.push(`Source ${source} failed: ${message}`);
      }
    })
  );

  entries.sort(byTimeDesc);

  return {
    lang,
    generatedAt: new Date().toISOString(),
    counts: buildCounts(entries),
    entries,
    partialWarnings,
  };
}
