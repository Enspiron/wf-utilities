#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const BAD_EXT_RE = /\.(mp3|ogg|wav|m4a|aac|flac|awb|acb|json|orderedmap|txt|csv)$/i;
const PATH_TOKEN_RE = /https?:\/\/[^\s"'`]+|\/?[A-Za-z0-9._$-]+(?:\/[A-Za-z0-9._$-]+)+/g;
const INDEX_VERSION = 2;

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function normalizeAssetPath(raw) {
  const cleaned = String(raw).trim().split(/[?#]/)[0].replace(/[),.;]+$/, '');
  if (!cleaned || cleaned === '(None)') return '';
  if (cleaned.startsWith(CDN_ROOT)) {
    return cleaned.slice(CDN_ROOT.length).replace(/^\/+/, '');
  }
  return cleaned.replace(/^\/+/, '');
}

function normalizeTreePath(raw) {
  return raw.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function stripImageExtension(assetPath) {
  return normalizeAssetPath(assetPath).replace(IMAGE_EXT_RE, '');
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function parseAssetTreeReport(contents, reportPath) {
  const files = new Set();
  const stack = [];
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

async function getAssetTreeIndex(reportPath) {
  if (!(await fileExists(reportPath))) {
    throw new Error(`Asset tree report not found: ${reportPath}`);
  }

  const contents = await fs.readFile(reportPath, 'utf8');
  return parseAssetTreeReport(contents, reportPath);
}

function getAssetAvailability(assetPath, assetTree) {
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

function isProbablyAssetPath(raw) {
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

function getTags(assetPath, sourceFile) {
  const lower = `${assetPath} ${sourceFile}`.toLowerCase();
  const tags = new Set();
  if (lower.includes('sprite_sheet')) tags.add('sprite_sheet');
  if (lower.includes('battle/boss') || lower.includes('/boss/')) tags.add('boss');
  if (lower.includes('battle/funnel') || lower.includes('/funnel/')) tags.add('funnel');
  if (lower.includes('field_object')) tags.add('field_object');
  if (lower.includes('character/')) tags.add('character');
  if (lower.includes('animation_background')) tags.add('background');
  return Array.from(tags);
}

function buildImageSources(assetPath) {
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

  const sources = new Set();
  for (const candidate of directPaths) {
    sources.add(`${CDN_ROOT}/${candidate}`);
    if (!candidate.startsWith('wfjukebox/')) {
      sources.add(`${CDN_ROOT}/wfjukebox/${candidate}`);
    }
  }
  return Array.from(sources);
}

function humanizePath(assetPath) {
  const last = normalizeAssetPath(assetPath).split('/').filter(Boolean).pop() || assetPath;
  return (
    last
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase()) || assetPath
  );
}

function isReadableLabel(value) {
  const token = value.trim();
  if (!token || token === '(None)') return false;
  if (token.length > 80) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return false;
  if (/^(true|false|unknown|class\d+|p_[a-z0-9_-]+)$/i.test(token)) return false;
  if (isProbablyAssetPath(token)) return false;
  if (token.includes(',') && /^[A-Za-z,]+$/.test(token)) return false;
  return true;
}

function deriveLabelFromContext(context, fallbackPath) {
  if (Array.isArray(context)) {
    const readable = context.find((entry) => typeof entry === 'string' && isReadableLabel(entry));
    if (typeof readable === 'string') return readable.trim();
  }

  if (context && typeof context === 'object') {
    const values = Object.values(context);
    const readable = values.find((entry) => typeof entry === 'string' && isReadableLabel(entry));
    if (typeof readable === 'string') return readable.trim();
  }

  return humanizePath(fallbackPath);
}

function labelScore(label) {
  let score = 0;
  if (/[A-Za-z]/.test(label)) score += 3;
  if (!/[\u00c0-\uffff]/.test(label)) score += 2;
  if (!label.includes('/')) score += 1;
  return score;
}

function collectContextStrings(context) {
  const output = [];
  if (Array.isArray(context)) {
    for (const entry of context) {
      if (typeof entry === 'string' && entry.trim() && output.length < 8) output.push(entry.trim());
    }
  } else if (context && typeof context === 'object') {
    for (const entry of Object.values(context)) {
      if (typeof entry === 'string' && entry.trim() && output.length < 8) output.push(entry.trim());
    }
  }
  return output;
}

function candidateSortPriority(candidate) {
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

function addCandidate(candidates, rawPath, params) {
  const assetPath = normalizeAssetPath(rawPath);
  if (!isProbablyAssetPath(assetPath)) return;

  const id = assetPath.toLowerCase();
  const tags = getTags(assetPath, params.file);
  const availability = getAssetAvailability(assetPath, params.assetTree);
  if (!availability.image) return;
  if (!availability.fullMetadata && !tags.includes('sprite_sheet')) return;
  if (availability.fullMetadata && !tags.includes('metadata')) tags.push('metadata');

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

function scanValue(value, candidates, params, depth = 0) {
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
    for (const [key, entry] of Object.entries(value)) {
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

async function listJsonFiles(root) {
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

async function buildIndex({ dataRoot, assetTreePath, outputPath }) {
  const candidates = new Map();
  const assetTree = await getAssetTreeIndex(assetTreePath);
  let scannedFiles = 0;

  for (const lang of ['en', 'jp']) {
    const root = path.join(dataRoot, lang === 'en' ? 'datalist_en' : 'datalist');
    const jsonFiles = await listJsonFiles(root);

    for (const fullPath of jsonFiles) {
      let parsed;
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
    .map((candidate) => {
      const asset = { ...candidate };
      delete asset.score;
      return asset;
    })
    .sort((a, b) => {
      const aPriority = candidateSortPriority(a);
      const bPriority = candidateSortPriority(b);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.path.localeCompare(b.path);
    });

  const payload = {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    scannedFiles,
    assetCount: assets.length,
    assetTreePath,
    assets,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

const cwd = process.cwd();
const dataRoot = path.resolve(getArg('--data-root') || path.join(cwd, 'public', 'data'));
const assetTreePath = path.resolve(
  getArg('--asset-tree') ||
    process.env.WF_ASSET_TREE_PATH ||
    path.resolve(cwd, '..', 'WFDatamine', 'output', 'asset-tree.txt')
);
const outputPath = path.resolve(getArg('--output') || path.join(dataRoot, 'sprite-sheets-index.json'));

try {
  const payload = await buildIndex({ dataRoot, assetTreePath, outputPath });
  console.log(`Wrote ${payload.assetCount} sprite sheet candidates to ${outputPath}`);
  console.log(`Scanned ${payload.scannedFiles} datalist files using ${assetTreePath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
