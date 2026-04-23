import path from 'node:path';
import { promises as fs } from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { ASSET_CDN_ROOT, buildBgmUrlFromPath, buildImageUrlFromPath, hasAudioExtension, normalizeAssetPath } from '@/lib/asset-url';
import { DATA_CACHE_HEADERS, fetchDatalistJson } from '@/lib/data-source';
import type { AtlasEntry, TimelineSequence } from '@/lib/sprite-animation';

type SceneIndex = {
  version: number;
  builtAt: string;
  storyScenes: StorySceneIndexEntry[];
  battleFields: BattleFieldIndexEntry[];
};

type StorySceneIndexEntry = {
  id: string;
  path: string;
  title: string;
  category: string;
  langs: Array<'en' | 'jp'>;
  movie: boolean;
  movieBase: string;
};

type BattleFieldIndexEntry = {
  id: string;
  title: string;
  fieldId: string;
  terrain: string;
  zoneId: string;
  category: string;
  thumbnail: string;
  layerCount: number;
};

type StoryCharacter = {
  id: string;
  name: string;
  color: string;
  voiceBase: string;
  expressionNames: string[];
  baseImages: string[];
  expressionImages: string[];
};

type ImageTrim = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DecodedScenarioCommand = {
  index: number;
  op: string;
  kind: string;
  label: string;
  speakerId?: string;
  speakerName?: string;
  speakerSlot?: string;
  text?: string;
  voicePath?: string;
  voiceUrl?: string;
  bgmPaths: string[];
  bgmUrls: string[];
  sceneName?: string;
  character?: {
    action: 'show' | 'hide' | 'focus' | 'control' | 'expression' | 'motion';
    id: string;
    name: string;
    slot: string;
    expression: string;
    motion: string;
    visible: boolean;
    color: string;
    baseImagePath: string;
    baseImageUrl: string;
    expressionImagePath: string;
    expressionImageUrl: string;
    expressionLayers: Array<{
      name: string;
      imagePath: string;
      imageUrl: string;
      trim: ImageTrim | null;
    }>;
    imagePath: string;
    imageUrl: string;
    baseImageTrim: ImageTrim | null;
    expressionImageTrim: ImageTrim | null;
    imageTrim: ImageTrim | null;
  };
  effect?: {
    action: 'apply' | 'clear';
    name: string;
    value: string;
  };
  assetPaths: string[];
  assetImageUrls: string[];
  rawFields: Array<{ index: number; value: string }>;
};

type MovieMetadata = {
  base: string;
  imageUrl: string;
  atlas: AtlasEntry[];
  timeline: {
    sequences: TimelineSequence[];
  };
  source: 'local' | 'cdn';
  orderedFrameNames: string[];
};

const INDEX_PATH = 'scene-index.json';
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const SAFE_DATA_PATH_RE = /^[A-Za-z0-9._/-]+$/;
const COMMAND_LABELS: Record<string, string> = {
  '0': 'Dialogue',
  '1': 'Wait / control',
  '2': 'Audio',
  '5': 'Movie scene',
  '6': 'Character sprite',
  '7': 'Character hide',
  '8': 'Stage clear / transition',
  '9': 'Character focus',
  '10': 'Character control',
  '11': 'Character control',
  '12': 'Expression change',
  '13': 'Character motion',
  '18': 'Stage effect',
  '20': 'Stage effect clear',
  '22': 'Scenario start',
};

function clean(value: unknown): string {
  const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).trim()
    : '';
  if (!text || text === '(None)' || text.toLowerCase() === 'none') return '';
  return text;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => clean(entry))
    .filter(Boolean);
}

function sanitizeDataPath(value: string): string {
  const normalized = normalizeAssetPath(value).replace(/\.json$/i, '');
  if (!normalized || !SAFE_DATA_PATH_RE.test(normalized) || normalized.includes('..')) return '';
  return normalized;
}

function localAssetsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.LOCAL_ASSETS_ENABLED === '1';
}

function withImageExtension(pathValue: string): string {
  const normalized = normalizeAssetPath(pathValue);
  return IMAGE_EXT_RE.test(normalized) ? normalized : `${normalized}.png`;
}

function withAudioExtension(pathValue: string): string {
  const normalized = normalizeAssetPath(pathValue);
  return hasAudioExtension(normalized) ? normalized : `${normalized}.mp3`;
}

function buildLocalAssetUrl(pathValue: string, kind: 'image' | 'audio' = 'image'): string {
  const assetPath = kind === 'audio' ? withAudioExtension(pathValue) : withImageExtension(pathValue);
  return `/api/local-assets?path=${encodeURIComponent(assetPath)}`;
}

function buildSceneImageUrlFromPath(pathValue?: string): string {
  if (!pathValue) return '';
  return localAssetsEnabled() ? buildLocalAssetUrl(pathValue) : buildImageUrlFromPath(pathValue);
}

function buildSceneAudioUrlFromPath(pathValue?: string): string {
  if (!pathValue) return '';
  return localAssetsEnabled() ? buildLocalAssetUrl(pathValue, 'audio') : `${ASSET_CDN_ROOT}/${normalizeAssetPath(pathValue)}.mp3`;
}

function humanize(value: string): string {
  return value
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || value;
}

function collectPathTokens(values: string[]): string[] {
  const paths = new Set<string>();
  for (const value of values) {
    if (!value.includes('/')) continue;
    for (const token of value.split(/[,\s]+/)) {
      const cleaned = clean(token).replace(/[),.;]+$/, '');
      if (!cleaned || !cleaned.includes('/')) continue;
      paths.add(normalizeAssetPath(cleaned).replace(IMAGE_EXT_RE, ''));
    }
  }
  return Array.from(paths);
}

function getBgmPaths(values: string[]): string[] {
  return collectPathTokens(values).filter((entry) => entry.startsWith('bgm/'));
}

function getVoicePath(values: string[]): string {
  return collectPathTokens(values).find((entry) => entry.includes('/voice/')) || '';
}

function getAssetPaths(values: string[]): string[] {
  return collectPathTokens(values).filter((entry) => !entry.startsWith('bgm/') && !entry.includes('/voice/'));
}

async function readSceneIndex(): Promise<SceneIndex> {
  return fetchDatalistJson<SceneIndex>(INDEX_PATH, { revalidate: 3600 });
}

async function readDatalistJson<T>(relativePath: string): Promise<T> {
  return fetchDatalistJson<T>(relativePath, { revalidate: 3600 });
}

async function readStoryCharacters(lang: 'en' | 'jp'): Promise<Record<string, StoryCharacter>> {
  const folder = lang === 'en' ? 'datalist_en' : 'datalist';
  const raw = await readDatalistJson<Record<string, unknown[]>>(`${folder}/story/story_character.json`);
  const result: Record<string, StoryCharacter> = {};

  for (const [id, row] of Object.entries(raw)) {
    if (!Array.isArray(row)) continue;
    result[id] = {
      id,
      name: clean(row[0]) || humanize(id),
      color: clean(row[1]) || '0xffffff',
      voiceBase: clean(row[2]),
      expressionNames: splitCsv(clean(row[3])),
      baseImages: splitCsv(clean(row[4])),
      expressionImages: splitCsv(clean(row[5])),
    };
  }

  return result;
}

async function readImageTrims(): Promise<Record<string, ImageTrim>> {
  const raw = await readDatalistJson<Record<string, unknown[]>>('datalist/generated/trimmed_image.json');
  const trims: Record<string, ImageTrim> = {};

  for (const [assetPath, row] of Object.entries(raw)) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [x, y, width, height] = row.map((entry) => Number(entry));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;
    trims[normalizeAssetPath(assetPath).replace(IMAGE_EXT_RE, '')] = { x, y, width, height };
  }

  return trims;
}

async function readScenario(pathValue: string, lang: 'en' | 'jp') {
  const folder = lang === 'en' ? 'datalist_en' : 'datalist';
  return readDatalistJson<Record<string, Record<string, unknown[]>>>(`${folder}/${pathValue}.json`);
}

function getScenarioRows(payload: Record<string, Record<string, unknown[]>>, pathValue: string): Array<[number, unknown[]]> {
  const key = Object.keys(payload).find((entry) => normalizeAssetPath(entry) === pathValue) || Object.keys(payload)[0];
  const rows = key ? payload[key] : null;
  if (!rows || typeof rows !== 'object') return [];

  return Object.entries(rows)
    .map(([index, row]) => [Number.parseInt(index, 10), Array.isArray(row) ? row : []] as [number, unknown[]])
    .filter(([index]) => Number.isFinite(index))
    .sort((a, b) => a[0] - b[0]);
}

function getImageTrim(trims: Record<string, ImageTrim>, pathValue: string): ImageTrim | null {
  const key = normalizeAssetPath(pathValue).replace(IMAGE_EXT_RE, '');
  return trims[key] || null;
}

function getExpressionAssets(character: StoryCharacter | undefined, expression: string, trims: Record<string, ImageTrim>) {
  if (!character) {
    return {
      baseImagePath: '',
      expressionImagePath: '',
      expressionLayers: [],
      imagePath: '',
      baseImageTrim: null,
      expressionImageTrim: null,
      imageTrim: null,
    };
  }
  const expressionNames = splitCsv(expression);
  const fallbackIndex = character.expressionNames.findIndex((entry) => entry === expression) >= 0
    ? character.expressionNames.findIndex((entry) => entry === expression)
    : 0;
  const firstExpressionIndex = expressionNames
    .map((entry) => character.expressionNames.findIndex((name) => name === entry))
    .find((entry) => entry >= 0);
  const safeIndex = firstExpressionIndex ?? fallbackIndex;
  const baseImagePath = clean(character.baseImages[safeIndex]) || clean(character.baseImages[0]);
  const baseImageTrim = baseImagePath ? getImageTrim(trims, baseImagePath) : null;
  const expressionLayers = expressionNames
    .map((name) => {
      const index = character.expressionNames.findIndex((entry) => entry === name);
      const imagePath = index >= 0 ? clean(character.expressionImages[index]) : '';
      return {
        name,
        imagePath,
        imageUrl: imagePath ? buildSceneImageUrlFromPath(imagePath) : '',
        trim: imagePath ? getImageTrim(trims, imagePath) : null,
      };
    })
    .filter((entry) => entry.imagePath);
  const expressionImagePath = expressionLayers[0]?.imagePath || '';
  const expressionImageTrim = expressionLayers[0]?.trim || null;
  const imagePath = expressionImagePath || baseImagePath;

  return {
    baseImagePath,
    expressionImagePath,
    expressionLayers,
    imagePath,
    baseImageTrim,
    expressionImageTrim,
    imageTrim: expressionImageTrim || baseImageTrim,
  };
}

function buildCharacterCommand(
  characters: Record<string, StoryCharacter>,
  trims: Record<string, ImageTrim>,
  {
    action,
    id,
    slot,
    expression,
    motion,
    visible,
  }: {
    action: NonNullable<DecodedScenarioCommand['character']>['action'];
    id: string;
    slot?: string;
    expression?: string;
    motion?: string;
    visible?: boolean;
  }
): DecodedScenarioCommand['character'] {
  const character = characters[id];
  const shouldResolveAssets = action === 'show' || Boolean(expression);
  const assets = shouldResolveAssets ? getExpressionAssets(character, expression || '', trims) : {
    baseImagePath: '',
    expressionImagePath: '',
    expressionLayers: [],
    imagePath: '',
    baseImageTrim: null,
    expressionImageTrim: null,
    imageTrim: null,
  };

  return {
    action,
    id,
    name: character?.name || humanize(id),
    slot: slot || '',
    expression: expression || '',
    motion: motion || '',
    visible: visible ?? true,
    color: character?.color || '0xffffff',
    baseImagePath: assets.baseImagePath,
    baseImageUrl: assets.baseImagePath ? buildSceneImageUrlFromPath(assets.baseImagePath) : '',
    expressionImagePath: assets.expressionImagePath,
    expressionImageUrl: assets.expressionImagePath ? buildSceneImageUrlFromPath(assets.expressionImagePath) : '',
    expressionLayers: assets.expressionLayers,
    imagePath: assets.imagePath,
    imageUrl: assets.imagePath ? buildSceneImageUrlFromPath(assets.imagePath) : '',
    baseImageTrim: assets.baseImageTrim,
    expressionImageTrim: assets.expressionImageTrim,
    imageTrim: assets.imageTrim,
  };
}

function decodeScenarioRows(
  rows: Array<[number, unknown[]]>,
  characters: Record<string, StoryCharacter>,
  trims: Record<string, ImageTrim>
): DecodedScenarioCommand[] {
  return rows.map(([index, row]) => {
    const values = row.map(clean);
    const op = values[0] || '';
    const bgmPaths = getBgmPaths(values);
    const voicePath = op === '0' ? clean(values[6]) : getVoicePath(values);
    const assetPaths = getAssetPaths(values);
    const rawFields = values
      .map((value, fieldIndex) => ({ index: fieldIndex, value }))
      .filter((field) => field.value);

    let kind = 'unknown';
    let sceneName = '';
    let speakerId = '';
    let text = '';
    let characterCommand: DecodedScenarioCommand['character'];
    let effectCommand: DecodedScenarioCommand['effect'];

    if (op === '0') {
      kind = 'dialogue';
      speakerId = clean(values[4]);
      text = clean(values[5]).replace(/\\n/g, '\n');
    } else if (op === '2') {
      kind = 'audio';
    } else if (op === '5') {
      kind = 'scene';
      sceneName = clean(values[1]);
    } else if (op === '6') {
      kind = 'character';
      const characterId = clean(values[12]);
      const expression = clean(values[14]);
      if (characterId) {
        characterCommand = buildCharacterCommand(characters, trims, {
          action: 'show',
          id: characterId,
          slot: clean(values[13]) || '0',
          expression,
          motion: clean(values[15]),
          visible: true,
        });
      }
    } else if (op === '7') {
      kind = 'character';
      const characterId = clean(values[16]);
      if (characterId) {
        characterCommand = buildCharacterCommand(characters, trims, {
          action: 'hide',
          id: characterId,
          expression: clean(values[17]),
          visible: false,
        });
      }
    } else if (op === '9') {
      kind = 'character';
      const characterId = clean(values[9]);
      if (characterId) {
        characterCommand = buildCharacterCommand(characters, trims, {
          action: 'focus',
          id: characterId,
        });
      }
    } else if (op === '10' || op === '11') {
      kind = 'character';
      const characterId = clean(values[Number(op)]);
      if (characterId) {
        characterCommand = buildCharacterCommand(characters, trims, {
          action: 'control',
          id: characterId,
        });
      }
    } else if (op === '12') {
      kind = 'character';
      const characterId = clean(values[19]);
      const expression = clean(values[20]);
      if (characterId) {
        characterCommand = buildCharacterCommand(characters, trims, {
          action: 'expression',
          id: characterId,
          expression,
        });
      }
    } else if (op === '13') {
      kind = 'character';
      const characterId = clean(values[21]);
      if (characterId) {
        characterCommand = buildCharacterCommand(characters, trims, {
          action: 'motion',
          id: characterId,
          motion: clean(values[22]),
        });
      }
    } else if (op === '18') {
      kind = 'effect';
      effectCommand = {
        action: 'apply',
        name: clean(values[29]) || 'Effect',
        value: clean(values[30]),
      };
    } else if (op === '20') {
      kind = 'effect';
      effectCommand = {
        action: 'clear',
        name: 'Effect',
        value: clean(values[33]),
      };
    } else if (op === '22') {
      kind = 'start';
    } else if (assetPaths.length > 0) {
      kind = 'asset';
    }

    const speaker = characters[speakerId];

    return {
      index,
      op,
      kind,
      label: COMMAND_LABELS[op] || `Command ${op || '?'}`,
      speakerId: speakerId || undefined,
      speakerName: speaker ? speaker.name : speakerId ? humanize(speakerId) : undefined,
      speakerSlot: op === '0' ? clean(values[8]) || undefined : undefined,
      text: text || undefined,
      voicePath: voicePath || undefined,
      voiceUrl: voicePath ? buildSceneAudioUrlFromPath(voicePath) : undefined,
      bgmPaths,
      bgmUrls: bgmPaths.map((entry) => (localAssetsEnabled() ? buildSceneAudioUrlFromPath(entry) : buildBgmUrlFromPath(entry))),
      sceneName: sceneName || undefined,
      character: characterCommand,
      effect: effectCommand,
      assetPaths,
      assetImageUrls: assetPaths.map((p) => buildSceneImageUrlFromPath(p)),
      rawFields,
    };
  });
}

function getAssetRoot(): string {
  return path.resolve(process.env.WF_ASSET_ROOT || path.join(process.cwd(), '..', 'WFDatamine', 'output', 'assets'));
}

async function readLocalJson(relativeAssetPath: string): Promise<unknown | null> {
  const root = getAssetRoot();
  const fullPath = path.join(root, ...normalizeAssetPath(relativeAssetPath).split('/'));
  if (!fullPath.startsWith(root)) return null;

  try {
    return JSON.parse(await fs.readFile(fullPath, 'utf8'));
  } catch {
    return null;
  }
}

async function fetchCdnJson(relativeAssetPath: string): Promise<unknown> {
  const response = await fetch(`${ASSET_CDN_ROOT}/${normalizeAssetPath(relativeAssetPath)}`, {
    cache: 'force-cache',
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${relativeAssetPath}: ${response.status}`);
  return response.json();
}

function getFrameSortValue(entry: AtlasEntry): number {
  const suffix = String(entry.n || '').split('/').pop() || '';
  if (!/^[a-z]+$/i.test(suffix)) return Number.MAX_SAFE_INTEGER;
  let value = 0;
  for (const char of suffix.toLowerCase()) {
    value = value * 26 + (char.charCodeAt(0) - 96);
  }
  return value;
}

async function getMovieMetadata(movieBase: string): Promise<MovieMetadata | null> {
  const base = normalizeAssetPath(movieBase).replace(IMAGE_EXT_RE, '').replace(/\/+$/, '');
  if (!base) return null;
  const directory = base.split('/').slice(0, -1).join('/');
  const atlasPath = `${base}.atlas.json`;
  const timelinePath = `${directory}/movie.timeline.json`;

  let source: MovieMetadata['source'] = 'local';
  let atlas = await readLocalJson(atlasPath);
  let timeline = await readLocalJson(timelinePath);

  if (!atlas || !timeline) {
    source = 'cdn';
    try {
      [atlas, timeline] = await Promise.all([fetchCdnJson(atlasPath), fetchCdnJson(timelinePath)]);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(atlas) || !timeline || typeof timeline !== 'object') return null;
  const sequences = Array.isArray((timeline as { sequences?: unknown }).sequences)
    ? (timeline as { sequences: TimelineSequence[] }).sequences
    : [];
  const orderedFrameNames = [...atlas]
    .sort((a, b) => getFrameSortValue(a as AtlasEntry) - getFrameSortValue(b as AtlasEntry))
    .map((entry) => String((entry as AtlasEntry).n || ''))
    .filter(Boolean);

  return {
    base,
    imageUrl: source === 'local' && localAssetsEnabled() ? buildLocalAssetUrl(base) : `${ASSET_CDN_ROOT}/${base}.png`,
    atlas: atlas as AtlasEntry[],
    timeline: { sequences },
    source,
    orderedFrameNames,
  };
}

async function getStoryDetail(pathValue: string, requestedLang: 'en' | 'jp') {
  const safePath = sanitizeDataPath(pathValue);
  if (!safePath || !safePath.startsWith('story/') || !safePath.endsWith('/scenario')) {
    return NextResponse.json({ error: 'Invalid story path' }, { status: 400 });
  }

  let lang = requestedLang;
  let scenarioPayload: Record<string, Record<string, unknown[]>>;

  try {
    scenarioPayload = await readScenario(safePath, lang);
  } catch {
    if (lang !== 'jp') {
      lang = 'jp';
      scenarioPayload = await readScenario(safePath, lang);
    } else {
      throw new Error('Scenario not found');
    }
  }

  const [characters, fallbackCharacters, imageTrims] = await Promise.all([
    readStoryCharacters(lang),
    lang === 'en' ? readStoryCharacters('jp') : readStoryCharacters('en').catch(() => ({})),
    readImageTrims().catch(() => ({})),
  ]);
  const mergedCharacters = { ...fallbackCharacters, ...characters };
  const rows = getScenarioRows(scenarioPayload, safePath);
  const commands = decodeScenarioRows(rows, mergedCharacters, imageTrims);
  const movieBase = safePath.replace(/\/scenario$/i, '/sprite_sheet');
  const movie = await getMovieMetadata(movieBase);

  return NextResponse.json(
    {
      path: safePath,
      lang,
      title: safePath.split('/').slice(1, -1).map(humanize).join(' / '),
      commands,
      dialogueCount: commands.filter((command) => command.kind === 'dialogue').length,
      sceneNames: Array.from(new Set(commands.map((command) => command.sceneName).filter(Boolean))),
      bgmPaths: Array.from(new Set(commands.flatMap((command) => command.bgmPaths))),
      movie,
    },
    { headers: DATA_CACHE_HEADERS }
  );
}

function parseFieldLayers(row: unknown): Array<{ label: string; path: string; imageUrl: string; role: string }> {
  if (!Array.isArray(row)) return [];
  const labels = [
    'Background',
    'Foreground',
    'Added',
    'Overlay 1',
    'Overlay 2',
    'Overlay 3',
    'Overlay 4',
    'Gate',
    'Transit Pod',
    'Fever Gauge',
  ];

  return row
    .map((value, index) => ({
      label: labels[index] || `Layer ${index + 1}`,
      path: clean(value),
      role: labels[index]?.toLowerCase().replace(/\s+/g, '-') || `layer-${index + 1}`,
    }))
    .filter((entry) => entry.path)
    .map((entry) => ({
      ...entry,
      imageUrl: buildImageUrlFromPath(entry.path),
    }));
}

function decodeZoneEntries(zoneValue: unknown) {
  if (!zoneValue || typeof zoneValue !== 'object') return [];
  return Object.entries(zoneValue as Record<string, unknown[]>)
    .map(([index, row]) => {
      const values = Array.isArray(row) ? row.map(clean) : [];
      const nonEmpty = values
        .map((value, fieldIndex) => ({ index: fieldIndex, value }))
        .filter((field) => field.value);
      const assetPaths = getAssetPaths(values);
      const ids = values.filter((value) => (
        value &&
        !value.includes('/') &&
        !/^-?\d+(\.\d+)?$/.test(value) &&
        value !== 'true' &&
        value !== 'false'
      ));

      return {
        index,
        ids: Array.from(new Set(ids)).slice(0, 8),
        assetPaths,
        rawFields: nonEmpty.slice(0, 28),
      };
    })
    .slice(0, 80);
}

async function getBattleDetail(id: string) {
  const safeId = sanitizeDataPath(id);
  if (!safeId) return NextResponse.json({ error: 'Invalid battle id' }, { status: 400 });

  const [fieldData, fields, zones, zoneActions] = await Promise.all([
    readDatalistJson<Record<string, unknown[]>>('datalist/battle/field_data.json'),
    readDatalistJson<Record<string, unknown[]>>('datalist/battle/field.json'),
    readDatalistJson<Record<string, unknown>>('datalist/battle/zone.json').catch((): Record<string, unknown> => ({})),
    readDatalistJson<Record<string, unknown>>('datalist/battle/zone_action.json').catch((): Record<string, unknown> => ({})),
  ]);

  const row = fieldData[safeId];
  if (!Array.isArray(row)) return NextResponse.json({ error: 'Battle field not found' }, { status: 404 });

  const fieldId = clean(row[0]);
  const terrain = clean(row[1]);
  const zoneId = clean(row[2]) || safeId;
  const layers = parseFieldLayers(fields[fieldId]);
  const zoneEntries = decodeZoneEntries(zones[zoneId] || zones[safeId]);
  const actionEntries = decodeZoneEntries(zoneActions[zoneId] || zoneActions[safeId]);

  return NextResponse.json(
    {
      id: safeId,
      title: humanize(safeId),
      fieldId,
      terrain,
      terrainUrl: terrain ? buildImageUrlFromPath(terrain) : '',
      zoneId,
      layers,
      zoneEntries,
      actionEntries,
    },
    { headers: DATA_CACHE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') || 'index';

  try {
    if (mode === 'index') {
      const index = await readSceneIndex();
      return NextResponse.json(index, { headers: DATA_CACHE_HEADERS });
    }

    if (mode === 'story') {
      const pathValue = request.nextUrl.searchParams.get('path') || '';
      const lang = request.nextUrl.searchParams.get('lang') === 'jp' ? 'jp' : 'en';
      return getStoryDetail(pathValue, lang);
    }

    if (mode === 'movie') {
      const base = request.nextUrl.searchParams.get('base') || '';
      const movie = await getMovieMetadata(base);
      if (!movie) return NextResponse.json({ error: 'Movie metadata not found' }, { status: 404 });
      return NextResponse.json(movie, { headers: DATA_CACHE_HEADERS });
    }

    if (mode === 'battle') {
      const id = request.nextUrl.searchParams.get('id') || '';
      return getBattleDetail(id);
    }

    return NextResponse.json({ error: 'Unknown scene mode' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load scene data',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
