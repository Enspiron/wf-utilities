#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const BAD_EXT_RE = /\.(mp3|ogg|wav|m4a|aac|flac|awb|acb|json|orderedmap|txt|csv)$/i;
const PATH_TOKEN_RE = /https?:\/\/[^\s"'`]+|\/?[A-Za-z0-9._$-]+(?:\/[A-Za-z0-9._$-]+)+/g;
const INDEX_VERSION = 5;
const PREVIEW_FRAME_MS = 33;
const FRAME_MASK = 0x3fffffff;
const PREVIEW_SEQUENCE_NAMES = ['neutral', 'idle', 'wait', 'stand', 'move', 'move_out', 'start'];

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function normalizeAssetPath(raw) {
  let cleaned = String(raw).trim().replace(/\\/g, '/').split(/[?#]/)[0].replace(/[),.;]+$/, '');
  if (!cleaned || cleaned === '(None)') return '';
  if (cleaned.startsWith(CDN_ROOT)) {
    cleaned = cleaned.slice(CDN_ROOT.length);
  }
  const assetsIndex = cleaned.toLowerCase().lastIndexOf('/assets/');
  if (assetsIndex >= 0) {
    cleaned = cleaned.slice(assetsIndex + '/assets/'.length);
  }
  return cleaned.replace(/^\/+/, '').replace(/^assets\//i, '');
}

function normalizeTreePath(raw) {
  return raw.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function stripImageExtension(assetPath) {
  return normalizeAssetPath(assetPath).replace(IMAGE_EXT_RE, '');
}

function getCharacterPixelartInfo(assetPath) {
  const normalized = stripImageExtension(assetPath).toLowerCase();
  const match = normalized.match(/^character\/([^/]+)\/pixelart\/(sprite_sheet|special_sprite_sheet)$/);
  if (!match) return null;

  const directory = normalized.split('/').slice(0, -1).join('/');
  const sheetName = match[2];
  const prefix = sheetName === 'special_sprite_sheet' ? 'special' : 'pixelart';

  return {
    characterId: match[1],
    sheetName,
    prefix,
    directory,
    atlas: `${normalized}.atlas.json`,
    frame: `${directory}/${prefix}.frame.json`,
    timeline: `${directory}/${prefix}.timeline.json`,
  };
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
  const directParts = assetTree.files.has(`${base}.parts.json`);
  const directTimeline = assetTree.files.has(`${base}.timeline.json`);
  const pixelart = getCharacterPixelartInfo(base);
  const frame = Boolean(pixelart && assetTree.files.has(pixelart.frame));
  const timeline = directTimeline || Boolean(pixelart && assetTree.files.has(pixelart.timeline));
  const parts = directParts;

  return {
    image,
    atlas,
    parts,
    frame,
    timeline,
    metadataKind: image && atlas && directParts && directTimeline ? 'parts' : image && atlas && frame && timeline ? 'frame' : undefined,
    fullMetadata: image && atlas && ((directParts && directTimeline) || (frame && timeline)),
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
  if (lower.includes('/pixelart/')) tags.add('pixelart');
  if (lower.includes('special_sprite_sheet')) tags.add('special');
  if (lower.includes('animation_background')) tags.add('background');
  return Array.from(tags);
}

function buildImageSources(assetPath) {
  if (/^https?:\/\//i.test(assetPath) && !assetPath.trim().startsWith(CDN_ROOT)) {
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
  if (getCharacterPixelartInfo(normalized)) {
    sources.add(`/assets/${IMAGE_EXT_RE.test(normalized) ? normalized : `${withoutExt}.png`}`);
  }
  for (const candidate of directPaths) {
    sources.add(`${CDN_ROOT}/${candidate}`);
    if (!candidate.startsWith('wfjukebox/')) {
      sources.add(`${CDN_ROOT}/wfjukebox/${candidate}`);
    }
  }
  return Array.from(sources);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSegmentKind(value) {
  return value >>> 30;
}

function getSegmentStart(value) {
  return value & FRAME_MASK;
}

function getDuration(value) {
  if (value === undefined || value === null) return 1;
  return Math.max(1, value & 0xffff);
}

function getFutureFrame(loopKind, frame, offset, totalFrames) {
  if (loopKind === 0) return frame;
  if (loopKind === 1) return Math.ceil(Math.min(frame + offset, Math.max(0, totalFrames - 1)));
  if (loopKind === 2 && totalFrames > 0) return (frame + offset) % totalFrames;
  return 0;
}

function addFrame(graphic, frameIndex, state) {
  if (frameIndex < 0 || frameIndex >= graphic.frames.length) return;
  graphic.frames[frameIndex] = {
    ...state,
    next: graphic.frames[frameIndex],
  };
}

function addImageSegment(graphic, segment) {
  const startFrame = getSegmentStart(segment.s);
  let elapsed = 0;
  for (const record of segment.l || []) {
    const duration = getDuration(record.t);
    for (let offset = 0; offset < duration; offset += 1) {
      addFrame(graphic, startFrame + elapsed + offset, {
        id: segment.i,
        referencingFrame: 0,
        indexForPath: 0,
      });
    }
    elapsed += duration;
  }
}

function addGraphicSegment(graphic, segment, descriptors, indexForPath) {
  const childId = segment.i;
  const childTotalFrames = Math.max(1, toNumber(descriptors[childId]?.t, 1));
  const startFrame = getSegmentStart(segment.s);
  let elapsed = 0;

  for (const record of segment.l || []) {
    const duration = getDuration(record.t);
    const reference = record.r ?? 0;
    const loopKind = reference >>> 30;
    const referenceFrame = reference & FRAME_MASK;

    for (let offset = 0; offset < duration; offset += 1) {
      addFrame(graphic, startFrame + elapsed + offset, {
        id: childId,
        referencingFrame: getFutureFrame(loopKind, referenceFrame, offset, childTotalFrames),
        indexForPath,
      });
    }

    elapsed += duration;
  }
}

function buildGraphics(parts) {
  const descriptors = parts.g || [];
  return descriptors.map((descriptor) => {
    const totalFrame = Math.max(1, toNumber(descriptor.t, 1));
    const graphic = {
      totalFrame,
      frames: new Array(totalFrame),
    };
    const segments = descriptor.s || [];

    for (let index = 1; index <= segments.length; index += 1) {
      const segment = segments[segments.length - index];
      const kind = getSegmentKind(segment.s);

      if (kind === 0) {
        addImageSegment(graphic, segment);
      } else if (kind === 2) {
        addGraphicSegment(graphic, segment, descriptors, index);
      }
    }

    return graphic;
  });
}

function resolveFinalFrame(graphics, graphicIndex, frameIndex, depth = 0) {
  if (depth > 24) return null;

  let state = graphics[graphicIndex]?.frames[frameIndex];
  while (state) {
    if (state.indexForPath === 0) return state;

    const resolved = resolveFinalFrame(graphics, state.id, state.referencingFrame, depth + 1);
    if (resolved) return resolved;

    state = state.next;
  }

  return null;
}

function buildMetadataFrames(metadata, sequence, frameMs) {
  const begin = Math.max(1, Math.floor(toNumber(sequence.begin, 1)));
  const end = Math.max(begin, Math.floor(toNumber(sequence.end, begin)));
  const delay = Math.max(1, Math.round(frameMs));
  const atlasByName = new Map(metadata.atlas.map((entry) => [entry.n, entry]));
  const imageAtlas = (metadata.parts.i || []).map((image) => (image.p ? atlasByName.get(image.p) : undefined));
  const graphics = buildGraphics(metadata.parts);
  const frames = [];

  for (let sourceFrame = begin; sourceFrame <= end; sourceFrame += 1) {
    const finalState = resolveFinalFrame(graphics, 0, sourceFrame - 1);
    if (!finalState) continue;

    const atlas = imageAtlas[finalState.id];
    if (!atlas) continue;

    const last = frames.at(-1);
    if (last?.imageIndex === finalState.id) {
      last.delayMs += delay;
    } else {
      frames.push({
        atlas,
        imageIndex: finalState.id,
        sourceFrame,
        delayMs: delay,
      });
    }
  }

  return frames;
}

function isUsableMetadata(metadata) {
  return (
    metadata &&
    typeof metadata === 'object' &&
    Array.isArray(metadata.atlas) &&
    Array.isArray(metadata.timeline?.sequences) &&
    metadata.parts &&
    Array.isArray(metadata.parts.i) &&
    Array.isArray(metadata.parts.g)
  );
}

function choosePreviewFrame(metadata) {
  const sequences = metadata.timeline.sequences || [];
  const candidates = sequences
    .map((sequence) => ({
      sequence,
      frames: buildMetadataFrames(metadata, sequence, PREVIEW_FRAME_MS),
    }))
    .filter(({ frames }) => frames.length > 0);

  if (candidates.length === 0) return null;

  for (const preferredName of PREVIEW_SEQUENCE_NAMES) {
    const match = candidates.find(({ frames, sequence }) => (
      frames.length > 1 && sequence.name.toLowerCase() === preferredName
    ));
    if (match) return { sequence: match.sequence, frame: match.frames[0] };
  }

  const loop = candidates.find(({ frames, sequence }) => frames.length > 1 && sequence.kind === 'loop');
  if (loop) return { sequence: loop.sequence, frame: loop.frames[0] };

  const animated = candidates.find(({ frames }) => frames.length > 1);
  if (animated) return { sequence: animated.sequence, frame: animated.frames[0] };

  const fallback = candidates[0];
  return { sequence: fallback.sequence, frame: fallback.frames[0] };
}

function compactPreviewValue(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function getTimelineEnd(timeline) {
  const sequences = Array.isArray(timeline?.sequences) ? timeline.sequences : [];
  return Math.max(
    1,
    ...sequences.map((sequence) => Math.floor(toNumber(sequence.end, sequence.begin || 1)))
  );
}

function getAtlasFrameStart(entry, prefix) {
  const name = typeof entry?.n === 'string' ? entry.n : '';
  const match = name.match(new RegExp(`${prefix}(\\d+)$`, 'i'));
  if (!match) return null;
  return Math.max(0, Number.parseInt(match[1], 10) - 2);
}

function buildFramePartsFromAtlas(atlas, timeline, prefix) {
  if (!Array.isArray(atlas)) return null;

  const ordered = atlas
    .map((entry, index) => ({
      index,
      start: getAtlasFrameStart(entry, prefix),
    }))
    .filter((entry) => entry.start !== null)
    .sort((a, b) => a.start - b.start || a.index - b.index);

  if (!ordered.length) return null;

  ordered[0].start = 0;
  const totalFrames = Math.max(getTimelineEnd(timeline), ordered.at(-1).start + 1);
  const segments = ordered
    .filter((entry) => entry.start < totalFrames)
    .map((entry, index) => {
      const nextStart = ordered[index + 1]?.start ?? totalFrames;
      return {
        s: entry.start,
        i: entry.index,
        l: [{ t: Math.max(1, nextStart - entry.start) }],
      };
    });

  return {
    i: atlas.map((entry) => ({ p: entry.n })),
    g: [{ t: totalFrames, s: segments }],
  };
}

async function readJsonIfExists(filePath) {
  if (!(await fileExists(filePath))) return null;
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function readMetadataForAsset(asset, assetsRoot) {
  const basePath = path.join(assetsRoot, ...asset.path.split('/'));
  const pixelart = getCharacterPixelartInfo(asset.path);

  if (pixelart) {
    const pixelartDirectory = path.join(assetsRoot, ...pixelart.directory.split('/'));
    const [atlas, timeline] = await Promise.all([
      readJsonIfExists(`${basePath}.atlas.json`),
      readJsonIfExists(path.join(pixelartDirectory, `${pixelart.prefix}.timeline.json`)),
    ]);
    const parts = buildFramePartsFromAtlas(atlas, timeline, pixelart.prefix);
    return { atlas, timeline, parts };
  }

  const [atlas, timeline, parts] = await Promise.all([
    readJsonIfExists(`${basePath}.atlas.json`),
    readJsonIfExists(`${basePath}.timeline.json`),
    readJsonIfExists(`${basePath}.parts.json`),
  ]);

  return { atlas, timeline, parts };
}

async function buildPreview(asset, assetsRoot) {
  if (!asset.availability?.fullMetadata || !assetsRoot) return undefined;

  const metadata = await readMetadataForAsset(asset, assetsRoot);
  if (!isUsableMetadata(metadata)) return undefined;

  const chosen = choosePreviewFrame(metadata);
  if (!chosen) return undefined;

  const entry = chosen.frame.atlas;
  return compactPreviewValue({
    source: asset.sources[0] || `${CDN_ROOT}/${asset.path}.png`,
    sequence: chosen.sequence.name,
    x: entry.x,
    y: entry.y,
    w: entry.w,
    h: entry.h,
    r: entry.r,
    fx: entry.fx,
    fy: entry.fy,
    fw: entry.fw,
    fh: entry.fh,
  });
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

function humanizeCharacterId(value) {
  return (
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase()) || value
  );
}

function getPixelartLabel(assetPath) {
  const info = getCharacterPixelartInfo(assetPath);
  if (!info) return humanizePath(assetPath);
  return `${humanizeCharacterId(info.characterId)} ${info.sheetName === 'special_sprite_sheet' ? 'Special' : 'Pixelart'}`;
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

function addAssetTreePixelartCandidates(candidates, assetTree) {
  for (const filePath of assetTree.files) {
    if (!filePath.endsWith('.png')) continue;
    const assetPath = stripImageExtension(filePath);
    const info = getCharacterPixelartInfo(assetPath);
    if (!info) continue;

    addCandidate(candidates, assetPath, {
      lang: 'en',
      category: 'character',
      file: 'asset-tree/character-pixelart',
      sourceKey: info.sheetName,
      context: {
        label: getPixelartLabel(assetPath),
        path: assetPath,
      },
      assetTree,
    });
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

async function buildIndex({ dataRoot, assetTreePath, assetsRoot, outputPath }) {
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

  addAssetTreePixelartCandidates(candidates, assetTree);

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

  const assetsWithPreviews = await Promise.all(
    assets.map(async (asset) => {
      const preview = await buildPreview(asset, assetsRoot);
      return preview ? { ...asset, preview } : asset;
    })
  );

  const payload = {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    scannedFiles,
    assetCount: assetsWithPreviews.length,
    assetTreePath,
    assetsRoot,
    assets: assetsWithPreviews,
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
const assetsRoot = path.resolve(
  getArg('--assets-root') ||
    process.env.WF_ASSETS_ROOT ||
    path.join(path.dirname(assetTreePath), 'assets')
);
const outputPath = path.resolve(getArg('--output') || path.join(dataRoot, 'sprite-sheets-index.json'));

try {
  const payload = await buildIndex({ dataRoot, assetTreePath, assetsRoot, outputPath });
  console.log(`Wrote ${payload.assetCount} sprite sheet candidates to ${outputPath}`);
  console.log(`Scanned ${payload.scannedFiles} datalist files using ${assetTreePath}`);
  console.log(`Resolved preview frames from ${assetsRoot}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
