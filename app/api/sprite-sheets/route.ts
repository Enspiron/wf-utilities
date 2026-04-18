import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { DATA_CACHE_HEADERS, DATA_CDN_BASE } from '@/lib/data-source';

type Lang = 'jp' | 'en';

type SpriteSheetCandidate = {
  id: string;
  path: string;
  label: string;
  category: string;
  file: string;
  lang: Lang;
  sourceKey: string;
  tags: string[];
  sources: string[];
  context: string[];
  availability?: AssetAvailability;
};

type MutableCandidate = SpriteSheetCandidate & {
  score: number;
};

type AssetTreeIndex = {
  path: string;
  files: Set<string>;
};

type AssetAvailability = {
  image: boolean;
  atlas: boolean;
  parts: boolean;
  timeline: boolean;
  fullMetadata: boolean;
};

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const BAD_EXT_RE = /\.(mp3|ogg|wav|m4a|aac|flac|awb|acb|json|orderedmap|txt|csv)$/i;
const PATH_TOKEN_RE = /https?:\/\/[^\s"'`]+|\/?[A-Za-z0-9._$-]+(?:\/[A-Za-z0-9._$-]+)+/g;
const CACHE_MS = 10 * 60 * 1000;
const CACHE_VERSION = 2;
const PREBUILT_INDEX_RELATIVE_PATH = 'sprite-sheets-index.json';

type PayloadSource = 'local-scan' | 'local-scan-unverified' | 'prebuilt-local' | 'prebuilt-remote';

type CachedPayload = {
  at: number;
  version: number;
  assets: SpriteSheetCandidate[];
  scannedFiles: number;
  source: PayloadSource;
};

let cachedPayload: CachedPayload | null = null;
let cachedAssetTree: { at: number; index: AssetTreeIndex | null } | null = null;

function normalizeAssetPath(raw: string): string {
  const cleaned = raw.trim().split(/[?#]/)[0].replace(/[),.;]+$/, '');
  if (!cleaned || cleaned === '(None)') return '';
  if (cleaned.startsWith(CDN_ROOT)) {
    return cleaned.slice(CDN_ROOT.length).replace(/^\/+/, '');
  }
  return cleaned.replace(/^\/+/, '');
}

function normalizeTreePath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function stripImageExtension(assetPath: string): string {
  return normalizeAssetPath(assetPath).replace(IMAGE_EXT_RE, '');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function getAssetTreePath(): Promise<string | null> {
  if (process.env.WF_ASSET_TREE_PATH) {
    return (await fileExists(process.env.WF_ASSET_TREE_PATH)) ? process.env.WF_ASSET_TREE_PATH : null;
  }

  const candidates = [
    path.resolve(process.cwd(), '..', 'WFDatamine', 'output', 'asset-tree.txt'),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  return null;
}

function parseAssetTreeReport(contents: string, reportPath: string): AssetTreeIndex {
  const files = new Set<string>();
  const stack: string[] = [];
  let inTree = false;

  for (const line of contents.split(/\r?\n/)) {
    if (line === '## Tree') {
      inTree = true;
      continue;
    }
    if (!inTree || !line || line === 'assets/') continue;

    const markerIndex = line.indexOf('+-- ');
    if (markerIndex < 0) continue;

    const depth = Math.floor(markerIndex / 4);
    const rawName = line.slice(markerIndex + 4).replace(/ \[[^\]]+\]$/, '');
    stack.length = depth;

    if (rawName.endsWith('/')) {
      stack[depth] = rawName.slice(0, -1);
      continue;
    }

    files.add(normalizeTreePath([...stack.slice(0, depth), rawName].join('/')));
  }

  return { path: reportPath, files };
}

async function getAssetTreeIndex(): Promise<AssetTreeIndex | null> {
  const now = Date.now();
  if (cachedAssetTree && now - cachedAssetTree.at < CACHE_MS) {
    return cachedAssetTree.index;
  }

  const reportPath = await getAssetTreePath();
  if (!reportPath) {
    cachedAssetTree = { at: now, index: null };
    return null;
  }

  try {
    const contents = await fs.readFile(reportPath, 'utf8');
    const index = parseAssetTreeReport(contents, reportPath);
    cachedAssetTree = { at: now, index };
    return index;
  } catch {
    cachedAssetTree = { at: now, index: null };
    return null;
  }
}

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizePrebuiltPayload(raw: unknown, source: PayloadSource): Omit<CachedPayload, 'at' | 'version'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as { assets?: unknown; scannedFiles?: unknown };
  if (!Array.isArray(payload.assets)) return null;

  const assets: SpriteSheetCandidate[] = [];
  for (const entry of payload.assets) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<SpriteSheetCandidate>;
    if (typeof candidate.path !== 'string') continue;

    const assetPath = normalizeAssetPath(candidate.path);
    if (!assetPath) continue;

    assets.push({
      id: typeof candidate.id === 'string' ? candidate.id : assetPath.toLowerCase(),
      path: assetPath,
      label: typeof candidate.label === 'string' ? candidate.label : humanizePath(assetPath),
      category: typeof candidate.category === 'string' ? candidate.category : 'unknown',
      file: typeof candidate.file === 'string' ? candidate.file : 'sprite-sheets-index',
      lang: candidate.lang === 'jp' ? 'jp' : 'en',
      sourceKey: typeof candidate.sourceKey === 'string' ? candidate.sourceKey : '',
      tags: coerceStringArray(candidate.tags),
      sources: coerceStringArray(candidate.sources).length ? coerceStringArray(candidate.sources) : buildImageSources(assetPath),
      context: coerceStringArray(candidate.context),
      availability: candidate.availability,
    });
  }

  return {
    assets,
    scannedFiles: typeof payload.scannedFiles === 'number' ? payload.scannedFiles : 0,
    source,
  };
}

async function getPrebuiltPayload(): Promise<Omit<CachedPayload, 'at' | 'version'> | null> {
  const localPath = path.join(process.cwd(), 'public', 'data', PREBUILT_INDEX_RELATIVE_PATH);
  if (await fileExists(localPath)) {
    try {
      const parsed = JSON.parse(await fs.readFile(localPath, 'utf8'));
      const payload = normalizePrebuiltPayload(parsed, 'prebuilt-local');
      if (payload?.assets.length) return payload;
    } catch {
      // Fall through to the hosted copy.
    }
  }

  try {
    const response = await fetch(`${DATA_CDN_BASE}/${PREBUILT_INDEX_RELATIVE_PATH}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const payload = normalizePrebuiltPayload(await response.json(), 'prebuilt-remote');
    return payload?.assets.length ? payload : null;
  } catch {
    return null;
  }
}

function getAssetAvailability(assetPath: string, assetTree: AssetTreeIndex): AssetAvailability {
  const base = normalizeTreePath(stripImageExtension(assetPath));
  const image = assetTree.files.has(`${base}.png`);
  const atlas = assetTree.files.has(`${base}.atlas.json`);
  const parts = assetTree.files.has(`${base}.parts.json`);
  const timeline = assetTree.files.has(`${base}.timeline.json`);

  return {
    image,
    atlas,
    parts,
    timeline,
    fullMetadata: image && atlas && parts && timeline,
  };
}

function isProbablyAssetPath(raw: string): boolean {
  const normalized = normalizeAssetPath(raw);
  const lower = normalized.toLowerCase();
  if (!lower || lower.length < 4 || !lower.includes('/')) return false;
  if (/\s/.test(lower) || BAD_EXT_RE.test(lower)) return false;
  if (
    lower.startsWith('bgm/') ||
    lower.startsWith('sound_effect/') ||
    lower.includes('/voice/') ||
    lower.includes('/scenario/')
  ) {
    return false;
  }

  return (
    lower.includes('sprite_sheet') ||
    lower.startsWith('battle/boss/') ||
    lower.startsWith('battle/funnel/') ||
    lower.startsWith('battle/field_object/') ||
    lower.includes('/boss/') ||
    lower.includes('/funnel/') ||
    lower.includes('animation_background')
  );
}

function getTags(assetPath: string, sourceFile: string): string[] {
  const lower = `${assetPath} ${sourceFile}`.toLowerCase();
  const tags = new Set<string>();
  if (lower.includes('sprite_sheet')) tags.add('sprite_sheet');
  if (lower.includes('battle/boss') || lower.includes('/boss/')) tags.add('boss');
  if (lower.includes('battle/funnel') || lower.includes('/funnel/')) tags.add('funnel');
  if (lower.includes('field_object')) tags.add('field_object');
  if (lower.includes('character/')) tags.add('character');
  if (lower.includes('animation_background')) tags.add('background');
  return Array.from(tags);
}

function buildImageSources(assetPath: string): string[] {
  if (/^https?:\/\//i.test(assetPath)) {
    const noQuery = assetPath.split(/[?#]/)[0];
    if (IMAGE_EXT_RE.test(noQuery)) return [noQuery];
    const base = noQuery.replace(/\.[a-z0-9]{2,5}$/i, '');
    return [`${base}.png`, `${base}.jpg`, `${base}.webp`];
  }

  const normalized = normalizeAssetPath(assetPath);
  const withoutExt = normalized.replace(/\.[a-z0-9]{2,5}$/i, '');
  const directPaths = IMAGE_EXT_RE.test(normalized)
    ? [normalized]
    : [`${withoutExt}.png`, `${withoutExt}.jpg`, `${withoutExt}.webp`];

  const sources = new Set<string>();
  for (const candidate of directPaths) {
    sources.add(`${CDN_ROOT}/${candidate}`);
    if (!candidate.startsWith('wfjukebox/')) {
      sources.add(`${CDN_ROOT}/wfjukebox/${candidate}`);
    }
  }
  return Array.from(sources);
}

function humanizePath(assetPath: string): string {
  const last = normalizeAssetPath(assetPath).split('/').filter(Boolean).pop() || assetPath;
  return last
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || assetPath;
}

function isReadableLabel(value: string): boolean {
  const token = value.trim();
  if (!token || token === '(None)') return false;
  if (token.length > 80) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return false;
  if (/^(true|false|unknown|class\d+|p_[a-z0-9_-]+)$/i.test(token)) return false;
  if (isProbablyAssetPath(token)) return false;
  if (token.includes(',') && /^[A-Za-z,]+$/.test(token)) return false;
  return true;
}

function deriveLabelFromContext(context: unknown, fallbackPath: string): string {
  if (Array.isArray(context)) {
    const readable = context.find((entry) => typeof entry === 'string' && isReadableLabel(entry));
    if (typeof readable === 'string') return readable.trim();
  }

  if (context && typeof context === 'object') {
    const values = Object.values(context as Record<string, unknown>);
    const readable = values.find((entry) => typeof entry === 'string' && isReadableLabel(entry));
    if (typeof readable === 'string') return readable.trim();
  }

  return humanizePath(fallbackPath);
}

function labelScore(label: string): number {
  let score = 0;
  if (/[A-Za-z]/.test(label)) score += 3;
  if (!/[\u00c0-\uffff]/.test(label)) score += 2;
  if (!label.includes('/')) score += 1;
  return score;
}

function collectContextStrings(context: unknown): string[] {
  const output: string[] = [];
  if (Array.isArray(context)) {
    for (const entry of context) {
      if (typeof entry === 'string' && entry.trim() && output.length < 8) output.push(entry.trim());
    }
  } else if (context && typeof context === 'object') {
    for (const entry of Object.values(context as Record<string, unknown>)) {
      if (typeof entry === 'string' && entry.trim() && output.length < 8) output.push(entry.trim());
    }
  }
  return output;
}

function candidateSortPriority(candidate: SpriteSheetCandidate): number {
  const lower = candidate.path.toLowerCase();
  const parts = lower.split('/').filter(Boolean);
  const last = parts.at(-1);
  const parent = parts.at(-2);

  if (lower.startsWith('battle/boss/') && last && parent && last === parent) return 0;
  if (lower.startsWith('battle/boss/')) return 1;
  if (candidate.tags.includes('sprite_sheet')) return 2;
  if (candidate.tags.includes('boss')) return 3;
  if (candidate.tags.includes('funnel')) return 4;
  return 7;
}

function addCandidate(
  candidates: Map<string, MutableCandidate>,
  rawPath: string,
  params: { lang: Lang; category: string; file: string; sourceKey: string; context: unknown; assetTree: AssetTreeIndex | null }
) {
  const assetPath = normalizeAssetPath(rawPath);
  if (!isProbablyAssetPath(assetPath)) return;

  const id = assetPath.toLowerCase();
  const tags = getTags(assetPath, params.file);
  const availability = params.assetTree ? getAssetAvailability(assetPath, params.assetTree) : undefined;
  if (availability && !availability.image) return;
  if (availability && !availability.fullMetadata && !tags.includes('sprite_sheet')) return;
  if (availability?.fullMetadata && !tags.includes('metadata')) tags.push('metadata');

  const label = deriveLabelFromContext(params.context, assetPath);
  const score = labelScore(label) + (params.lang === 'en' ? 2 : 0);
  const context = collectContextStrings(params.context);

  const existing = candidates.get(id);
  if (existing) {
    for (const tag of tags) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag);
    }
    for (const source of buildImageSources(assetPath)) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
    }
    if (score > existing.score) {
      existing.label = label;
      existing.lang = params.lang;
      existing.category = params.category;
      existing.file = params.file;
      existing.sourceKey = params.sourceKey;
      existing.context = context;
      existing.availability = availability;
      existing.score = score;
    }
    return;
  }

  candidates.set(id, {
    id,
    path: assetPath,
    label,
    category: params.category,
    file: params.file,
    lang: params.lang,
    sourceKey: params.sourceKey,
    tags,
    sources: buildImageSources(assetPath),
    context,
    availability,
    score,
  });
}

function scanValue(
  value: unknown,
  candidates: Map<string, MutableCandidate>,
  params: { lang: Lang; category: string; file: string; sourceKey: string; context: unknown; assetTree: AssetTreeIndex | null },
  depth = 0
) {
  if (depth > 8 || value === null || value === undefined) return;

  if (typeof value === 'string') {
    const tokens = value.match(PATH_TOKEN_RE) || [value];
    for (const token of tokens) addCandidate(candidates, token, params);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      scanValue(
        entry,
        candidates,
        {
          ...params,
          sourceKey: `${params.sourceKey}[${index}]`,
          context: value,
        },
        depth + 1
      );
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      scanValue(
        entry,
        candidates,
        {
          ...params,
          sourceKey: params.sourceKey ? `${params.sourceKey}.${key}` : key,
          context: value,
        },
        depth + 1
      );
    }
  }
}

async function listJsonFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listJsonFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith('.json')) return [fullPath];
      return [];
    })
  );
  return files.flat();
}

async function buildPayload(): Promise<CachedPayload> {
  const now = Date.now();
  if (cachedPayload && cachedPayload.version === CACHE_VERSION && now - cachedPayload.at < CACHE_MS) {
    return cachedPayload;
  }

  const candidates = new Map<string, MutableCandidate>();
  const assetTree = await getAssetTreeIndex();
  if (!assetTree) {
    const prebuilt = await getPrebuiltPayload();
    if (prebuilt) {
      cachedPayload = { at: now, version: CACHE_VERSION, ...prebuilt };
      return cachedPayload;
    }
  }

  let scannedFiles = 0;

  for (const lang of ['en', 'jp'] as const) {
    const root = path.join(process.cwd(), 'public', 'data', lang === 'en' ? 'datalist_en' : 'datalist');
    let jsonFiles: string[] = [];
    try {
      jsonFiles = await listJsonFiles(root);
    } catch {
      continue;
    }

    for (const fullPath of jsonFiles) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await fs.readFile(fullPath, 'utf8'));
      } catch {
        continue;
      }

      scannedFiles += 1;
      const relative = path.relative(root, fullPath).replace(/\\/g, '/');
      const category = relative.split('/')[0] || 'unknown';
      scanValue(parsed, candidates, {
        lang,
        category,
        file: relative.replace(/\.json$/i, ''),
        sourceKey: '',
        context: parsed,
        assetTree,
      });
    }
  }

  const assets = Array.from(candidates.values())
    .map((candidate) => ({
      id: candidate.id,
      path: candidate.path,
      label: candidate.label,
      category: candidate.category,
      file: candidate.file,
      lang: candidate.lang,
      sourceKey: candidate.sourceKey,
      tags: candidate.tags,
      sources: candidate.sources,
      context: candidate.context,
      availability: candidate.availability,
    }))
    .sort((a, b) => {
      const aPriority = candidateSortPriority(a);
      const bPriority = candidateSortPriority(b);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.path.localeCompare(b.path);
    });

  if (!assets.length) {
    const prebuilt = await getPrebuiltPayload();
    if (prebuilt) {
      cachedPayload = { at: now, version: CACHE_VERSION, ...prebuilt };
      return cachedPayload;
    }
  }

  cachedPayload = {
    at: now,
    version: CACHE_VERSION,
    assets,
    scannedFiles,
    source: assetTree ? 'local-scan' : 'local-scan-unverified',
  };
  return cachedPayload;
}

export async function GET() {
  try {
    const payload = await buildPayload();
    return NextResponse.json(
      {
        assets: payload.assets,
        count: payload.assets.length,
        scannedFiles: payload.scannedFiles,
        source: payload.source,
        generatedAt: new Date().toISOString(),
      },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Failed to build sprite sheet index:', error);
    return NextResponse.json({ assets: [], count: 0, error: 'Failed to build sprite sheet index' }, { status: 500 });
  }
}
