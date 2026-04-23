/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Database,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Volume2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { AtlasEntry, TimelineSequence } from '@/lib/sprite-animation';

type SceneMode = 'story' | 'battle';
type Lang = 'en' | 'jp';

type ImageTrim = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  langs: Lang[];
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

type StoryDetail = {
  path: string;
  lang: Lang;
  title: string;
  commands: DecodedScenarioCommand[];
  dialogueCount: number;
  sceneNames: string[];
  bgmPaths: string[];
  movie: MovieMetadata | null;
};

type BattleLayer = {
  label: string;
  path: string;
  imageUrl: string;
  role: string;
};

type BattleZoneEntry = {
  index: string;
  ids: string[];
  assetPaths: string[];
  rawFields: Array<{ index: number; value: string }>;
};

type BattleDetail = {
  id: string;
  title: string;
  fieldId: string;
  terrain: string;
  terrainUrl: string;
  zoneId: string;
  layers: BattleLayer[];
  zoneEntries: BattleZoneEntry[];
  actionEntries: BattleZoneEntry[];
};

type StoryCharacterState = NonNullable<DecodedScenarioCommand['character']> & {
  active: boolean;
  updatedAt: number;
};

type StoryCommandTiming = {
  index: number;
  startMs: number;
  durationMs: number;
  endMs: number;
};

type SceneLayer = {
  id: string;
  label: string;
  role: string;
  order: number;
  visible: boolean;
  opacity: number;
  imageUrl?: string;
  meta?: string;
};

type StoryRuntimeState = {
  sceneName: string;
  dialogue: DecodedScenarioCommand | null;
  bgmUrls: string[];
  characters: StoryCharacterState[];
  visualEffect: string;
  activeCharacterId: string;
  sceneStartedAtMs: number;
  sceneFrame: number;
  backgroundImageUrl: string;
};

const LIST_LIMIT = 220;
const STORY_FRAME_MS = 1000 / 60;
const STORY_STAGE_WIDTH = 1024;
const STORY_STAGE_HEIGHT = 768;
const EMPTY_ATLAS_ENTRIES: AtlasEntry[] = [];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: number | string | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRawFieldValue(command: DecodedScenarioCommand, fieldIndex: number): string {
  return command.rawFields.find((field) => field.index === fieldIndex)?.value || '';
}

function getCommandDurationMs(command: DecodedScenarioCommand): number {
  if (command.op === '4') {
    const frames = toNumber(getRawFieldValue(command, 42), 30);
    return clamp(frames * STORY_FRAME_MS, 120, 5000);
  }

  if (command.text) {
    const visibleLength = command.text.replace(/\s+/g, '').length;
    return clamp(1300 + visibleLength * 45, 1700, 7200);
  }

  if (command.op === '5') return 160;
  if (command.character) return command.character.action === 'hide' ? 260 : 180;
  if (command.effect) return 220;
  if (command.bgmUrls.length) return 160;
  return 120;
}

function buildStoryTimings(commands: DecodedScenarioCommand[]): StoryCommandTiming[] {
  let cursor = 0;
  return commands.map((command, index) => {
    const durationMs = getCommandDurationMs(command);
    const timing = {
      index,
      startMs: cursor,
      durationMs,
      endMs: cursor + durationMs,
    };
    cursor += durationMs;
    return timing;
  });
}

function getCommandIndexAtTime(timings: StoryCommandTiming[], playheadMs: number): number {
  if (!timings.length) return 0;
  const safeTime = clamp(playheadMs, 0, timings[timings.length - 1].endMs);
  const index = timings.findIndex((timing) => safeTime >= timing.startMs && safeTime < timing.endMs);
  return index >= 0 ? index : timings.length - 1;
}

function getTimingStart(timings: StoryCommandTiming[], index: number): number {
  return timings[clamp(index, 0, Math.max(0, timings.length - 1))]?.startMs || 0;
}

function searchTokens(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function getSequenceBounds(sequence: TimelineSequence | null): { begin: number; end: number } {
  if (!sequence) return { begin: 1, end: 1 };
  const begin = Math.max(1, Math.floor(toNumber(sequence.begin, 1)));
  return { begin, end: Math.max(begin, Math.floor(toNumber(sequence.end, begin))) };
}

function getMovieMaxFrame(movie: MovieMetadata): number {
  return Math.max(1, ...movie.timeline.sequences.map((sequence) => getSequenceBounds(sequence).end));
}

function getFrameSortValue(entry: AtlasEntry): number {
  const suffix = String(entry.n || '').split('/').pop() || '';
  if (!/^[a-z]+$/i.test(suffix)) return Number.MAX_SAFE_INTEGER;
  let value = 0;
  for (const char of suffix.toLowerCase()) value = value * 26 + (char.charCodeAt(0) - 96);
  return value;
}

function getOrderedAtlas(movie: MovieMetadata): AtlasEntry[] {
  const order = new Map(movie.orderedFrameNames.map((name, index) => [name, index]));
  return [...movie.atlas].sort((a, b) => {
    const aOrder = order.get(a.n);
    const bOrder = order.get(b.n);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    return getFrameSortValue(a) - getFrameSortValue(b);
  });
}

function getMovieSequenceFrameSet(movie: MovieMetadata, sequenceName: string, tick: number): {
  frames: AtlasEntry[];
  frameIndex: number;
  sequence: TimelineSequence | null;
  ordered: AtlasEntry[];
  beginIndex: number;
  endIndex: number;
} {
  const ordered = getOrderedAtlas(movie);
  if (!ordered.length) return { frames: [], frameIndex: 0, sequence: null, ordered: [], beginIndex: 0, endIndex: 0 };

  const sequence =
    movie.timeline.sequences.find((entry) => entry.name === sequenceName) ||
    movie.timeline.sequences.find((entry) => entry.name?.startsWith('scene')) ||
    movie.timeline.sequences[0] ||
    null;
  if (!sequence) return { frames: ordered, frameIndex: 0, sequence: null, ordered, beginIndex: 0, endIndex: ordered.length };

  const { begin, end } = getSequenceBounds(sequence);
  const maxFrame = getMovieMaxFrame(movie);
  const beginIndex = clamp(Math.ceil((begin / maxFrame) * ordered.length), 0, Math.max(0, ordered.length - 1));
  const endIndex = clamp(Math.ceil((end / maxFrame) * ordered.length), beginIndex + 1, ordered.length);
  const sequenceFrames = ordered.slice(beginIndex, endIndex);
  const frames = sequenceFrames.length ? sequenceFrames : ordered;
  const elapsed = Math.max(0, Math.floor(tick));
  const frameIndex = sequence.kind === 'loop'
    ? elapsed % frames.length
    : clamp(elapsed, 0, frames.length - 1);

  return { frames, frameIndex, sequence, ordered, beginIndex, endIndex };
}

function getMovieFrame(movie: MovieMetadata, sequenceName: string, tick: number): AtlasEntry | null {
  const { frames, frameIndex } = getMovieSequenceFrameSet(movie, sequenceName, tick);
  return frames[frameIndex] || frames[0] || null;
}

function getFrameSize(entry: AtlasEntry): { width: number; height: number } {
  return {
    width: entry.fw || (entry.r ? entry.h : entry.w),
    height: entry.fh || (entry.r ? entry.w : entry.h),
  };
}

function getFrameDrawSize(entry: AtlasEntry): { width: number; height: number } {
  return {
    width: entry.r ? entry.h : entry.w,
    height: entry.r ? entry.w : entry.h,
  };
}

function getMovieFrameBounds(frames: AtlasEntry[]): { minX: number; minY: number; width: number; height: number } {
  if (!frames.length) return { minX: 0, minY: 0, width: 1, height: 1 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const frame of frames) {
    const size = getFrameDrawSize(frame);
    const left = -(frame.fx || 0);
    const top = -(frame.fy || 0);

    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + size.width);
    maxY = Math.max(maxY, top + size.height);
  }

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { minX: 0, minY: 0, width: 1, height: 1 };
  }

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function getMovieStagePlacement(bounds: { width: number; height: number }) {
  const availableWidth = STORY_STAGE_WIDTH * 0.74;
  const availableHeight = STORY_STAGE_HEIGHT * 0.86;
  const scale = Math.min(2, availableWidth / bounds.width, availableHeight / bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;

  return {
    scale,
    x: (STORY_STAGE_WIDTH - width) / 2,
    y: (STORY_STAGE_HEIGHT - height) / 2,
  };
}

function drawAtlasFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: AtlasEntry,
  targetX: number,
  targetY: number
) {
  const sourceX = Math.max(0, frame.x);
  const sourceY = Math.max(0, frame.y);
  const sourceW = Math.max(1, frame.w);
  const sourceH = Math.max(1, frame.h);

  context.save();
  context.imageSmoothingEnabled = false;

  if (frame.r) {
    context.translate(targetX, targetY + sourceW);
    context.rotate(-Math.PI / 2);
    context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
  } else {
    context.drawImage(image, sourceX, sourceY, sourceW, sourceH, targetX, targetY, sourceW, sourceH);
  }

  context.restore();
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

function MovieFrameCanvas({
  movie,
  sequenceName,
  tick,
  presentation = 'crop',
}: {
  movie: MovieMetadata | null;
  sequenceName: string;
  tick: number;
  presentation?: 'crop' | 'movie';
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameSet = useMemo(() => (
    movie ? getMovieSequenceFrameSet(movie, sequenceName, tick) : null
  ), [movie, sequenceName, tick]);
  const sequenceFrames = frameSet?.frames || EMPTY_ATLAS_ENTRIES;
  const frame = presentation === 'movie'
    ? sequenceFrames[frameSet?.frameIndex || 0] || sequenceFrames[0] || null
    : movie
      ? getMovieFrame(movie, sequenceName, tick)
      : null;
  const frameSize = frame ? getFrameSize(frame) : { width: 256, height: 256 };
  const movieBounds = useMemo(() => getMovieFrameBounds(sequenceFrames), [sequenceFrames]);
  const size = presentation === 'movie'
    ? { width: STORY_STAGE_WIDTH, height: STORY_STAGE_HEIGHT }
    : frameSize;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !movie || !frame) return;

    canvas.width = size.width;
    canvas.height = size.height;
    context.clearRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = false;

    loadImage(movie.imageUrl)
      .then((image) => {
        if (cancelled) return;

        context.clearRect(0, 0, size.width, size.height);
        context.imageSmoothingEnabled = false;

        if (presentation === 'movie') {
          const placement = getMovieStagePlacement(movieBounds);

          context.save();
          context.translate(placement.x, placement.y);
          context.scale(placement.scale, placement.scale);
          drawAtlasFrame(context, image, frame, -(frame.fx || 0) - movieBounds.minX, -(frame.fy || 0) - movieBounds.minY);
          context.restore();
          return;
        }

        drawAtlasFrame(context, image, frame, -(frame.fx || 0), -(frame.fy || 0));
      })
      .catch(() => {
        if (cancelled) return;
        context.clearRect(0, 0, size.width, size.height);
      });

    return () => {
      cancelled = true;
    };
  }, [frame, movie, movieBounds, presentation, size.height, size.width]);

  if (presentation === 'movie' && (!movie || !frame)) return null;

  if (!movie) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
        <ImageIcon className="mr-2 h-5 w-5" />
        No movie sheet metadata found.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[280px] items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className={cn('max-h-full max-w-full [image-rendering:pixelated]', presentation === 'movie' && 'pointer-events-none h-full w-full object-contain opacity-95')}
        style={presentation === 'movie' ? undefined : { width: size.width, height: size.height }}
      />
    </div>
  );
}

function getStorySlotLeft(slot: number, characterCount: number): number {
  if (!Number.isFinite(slot) || slot <= 0) return 50;
  if (characterCount <= 1) return 50;
  if (characterCount === 2) {
    if (slot <= 1) return 32;
    if (slot >= 3) return 68;
    return 50;
  }

  if (slot <= 1) return 24;
  if (slot >= 3) return 76;
  return 50;
}

function getStorySpriteHeightPercent(logicalAspect: number, characterCount: number): number {
  const baseHeight = logicalAspect > 1.05
    ? 50
    : logicalAspect > 0.9
      ? 55
      : logicalAspect < 0.62
        ? 59
        : 57;
  const crowdScale = characterCount >= 3 ? 0.86 : characterCount === 2 ? 0.92 : 0.98;

  return clamp(baseHeight * crowdScale, 44, 58);
}

function getExpressionTrimPlacement(
  trim: ImageTrim | null | undefined,
  baseTrim: ImageTrim | null | undefined,
  naturalSize: { width: number; height: number } | null | undefined,
  baseSize: { width: number; height: number }
) {
  const left = (trim?.x ?? 0) - (baseTrim?.x ?? 0);
  const top = (trim?.y ?? 0) - (baseTrim?.y ?? 0);
  const width = naturalSize?.width ?? trim?.width ?? Math.max(1, baseSize.width - left);
  const height = naturalSize?.height ?? trim?.height ?? Math.max(1, baseSize.height - top);

  return {
    left: `${(left / baseSize.width) * 100}%`,
    top: `${(top / baseSize.height) * 100}%`,
    width: `${(width / baseSize.width) * 100}%`,
    height: `${(height / baseSize.height) * 100}%`,
  };
}

function CharacterSprite({
  character,
  characterCount,
}: {
  character: StoryCharacterState;
  characterCount: number;
}) {
  const slot = Number.parseInt(character.slot, 10);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [expressionSizes, setExpressionSizes] = useState<Record<string, { width: number; height: number }>>({});
  const fallbackBaseSize = {
    width: character.baseImageTrim?.width || character.imageTrim?.width || 570,
    height: character.baseImageTrim?.height || character.imageTrim?.height || 600,
  };
  const visualBaseSize = baseSize || fallbackBaseSize;
  const baseAspect = visualBaseSize.width / Math.max(1, visualBaseSize.height);
  const slotLeft = getStorySlotLeft(slot, characterCount);
  const heightPercent = getStorySpriteHeightPercent(baseAspect, characterCount);
  const bottomPx = characterCount >= 2 ? 108 : 96;
  const opacity = character.active || !character.visible ? 1 : 0.74;
  const baseUrl = character.baseImageUrl || character.imageUrl;
  const expressionLayers = character.expressionLayers.length > 0
    ? character.expressionLayers
    : character.expressionImageUrl
      ? [{ name: character.expression || 'expression', imagePath: character.expressionImagePath, imageUrl: character.expressionImageUrl, trim: character.expressionImageTrim }]
      : [];
  const activeScale = character.active ? 1.006 : 1;

  return (
    <div
      className="absolute z-20 origin-bottom transition-[filter,opacity,transform,left,height,bottom] duration-200 drop-shadow-[0_14px_20px_rgba(0,0,0,0.38)]"
      style={{
        bottom: `${bottomPx}px`,
        height: `${heightPercent}%`,
        aspectRatio: `${visualBaseSize.width} / ${visualBaseSize.height}`,
        left: `${slotLeft}%`,
        transform: `translateX(-50%) scale(${activeScale})`,
        opacity,
        filter: character.active ? 'none' : 'saturate(0.86) brightness(0.9)',
      }}
      title={`${character.name} ${character.expression}`}
    >
      {baseUrl && (
        <img
          src={baseUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full max-w-none select-none object-contain"
          onLoad={(event) => {
            const image = event.currentTarget;
            setBaseSize({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
          }}
        />
      )}
      {baseSize && expressionLayers.map((layer) => {
        const size = expressionSizes[layer.imageUrl];
        const placement = layer.trim
          ? getExpressionTrimPlacement(layer.trim, character.baseImageTrim, size, baseSize)
          : {
              left: '51%',
              top: baseAspect < 0.62 ? '36%' : baseAspect < 0.82 ? '30%' : '24%',
              width: `${size ? clamp((size.width / Math.max(1, baseSize.width)) * 100, 4, 64) : 34}%`,
              height: 'auto',
              transform: 'translateX(-50%)',
            };
        return (
          <img
            key={`${layer.name}:${layer.imageUrl}`}
            src={layer.imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute z-10 max-w-none select-none"
            style={placement}
            onLoad={(event) => {
              const image = event.currentTarget;
              setExpressionSizes((current) => ({
                ...current,
                [layer.imageUrl]: {
                  width: image.naturalWidth || 1,
                  height: image.naturalHeight || 1,
                },
              }));
            }}
          />
        );
      })}
    </div>
  );
}

function getStoryLayerStack(detail: StoryDetail | null, state: StoryRuntimeState): SceneLayer[] {
  const layers: SceneLayer[] = [
    {
      id: 'stage-grid',
      label: 'Game viewport',
      role: 'stage',
      order: 0,
      visible: true,
      opacity: 0.3,
      meta: '1024x768 story canvas',
    },
  ];

  if (detail?.movie) {
    layers.push({
      id: 'movie',
      label: state.sceneName || 'Movie atlas',
      role: 'background movie',
      order: 10,
      visible: true,
      opacity: 0.4,
      imageUrl: detail.movie.imageUrl,
      meta: `${detail.movie.atlas.length} atlas crops`,
    });
  }

  for (const character of state.characters) {
    layers.push({
      id: `character-base:${character.id}`,
      label: `${character.name} body`,
      role: `slot ${character.slot || '?'}`,
      order: 40 + toNumber(character.slot, 1) * 2,
      visible: character.visible && Boolean(character.baseImageUrl || character.imageUrl),
      opacity: character.active ? 1 : 0.72,
      imageUrl: character.baseImageUrl || character.imageUrl,
      meta: character.baseImagePath || character.imagePath,
    });

    const expressionLayers = character.expressionLayers.length > 0
      ? character.expressionLayers
      : character.expressionImageUrl
        ? [{ name: character.expression || 'expression', imagePath: character.expressionImagePath, imageUrl: character.expressionImageUrl, trim: character.expressionImageTrim }]
        : [];

    for (const expressionLayer of expressionLayers) {
      layers.push({
        id: `character-expression:${character.id}:${expressionLayer.name}`,
        label: `${character.name} ${expressionLayer.name}`,
        role: 'expression',
        order: 41 + toNumber(character.slot, 1) * 2,
        visible: character.visible,
        opacity: character.active ? 1 : 0.72,
        imageUrl: expressionLayer.imageUrl,
        meta: expressionLayer.imagePath,
      });
    }
  }

  if (state.visualEffect) {
    layers.push({
      id: 'visual-effect',
      label: state.visualEffect,
      role: 'post effect',
      order: 80,
      visible: true,
      opacity: 0.65,
      meta: 'applied to scene imagery',
    });
  }

  layers.push({
    id: 'dialogue-ui',
    label: state.dialogue?.speakerName || state.dialogue?.speakerId || 'Dialogue box',
    role: 'ui',
    order: 100,
    visible: Boolean(state.dialogue),
    opacity: 1,
    meta: state.dialogue?.text ? 'current line' : 'empty',
  });

  return layers.sort((a, b) => a.order - b.order);
}

function getBattleLayerStack(detail: BattleDetail | null): SceneLayer[] {
  if (!detail) return [];

  return detail.layers.map((layer, index) => ({
    id: `${layer.role}:${layer.path}`,
    label: layer.label,
    role: layer.role,
    order: index + 1,
    visible: true,
    opacity: 1,
    imageUrl: layer.imageUrl,
    meta: layer.path,
  }));
}

function LayerStackPanel({ title, layers }: { title: string; layers: SceneLayer[] }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <Badge variant="outline" className="rounded-md">{layers.filter((layer) => layer.visible).length}/{layers.length}</Badge>
      </div>
      <ScrollArea className="h-64 pr-2">
        <div className="grid gap-2">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={cn(
                'grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-md border bg-background/70 p-2',
                !layer.visible && 'opacity-45'
              )}
            >
              <div
                className="h-12 rounded border bg-muted/40 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: layer.imageUrl ? `url("${layer.imageUrl}")` : undefined }}
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold">{layer.label}</p>
                  <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">z{layer.order}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {layer.role} | {Math.round(layer.opacity * 100)}%
                </p>
                {layer.meta && <p className="mt-1 line-clamp-2 break-all text-[10px] text-muted-foreground">{layer.meta}</p>}
              </div>
            </div>
          ))}
          {layers.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              No layers decoded yet.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function StoryStage({
  detail,
  state,
  tick,
}: {
  detail: StoryDetail | null;
  state: StoryRuntimeState;
  tick: number;
}) {
  const dialogue = state.dialogue;
  const audioUrl = dialogue?.voiceUrl || state.bgmUrls[0] || '';
  const visibleCharacters = state.characters.filter((character) => (
    character.visible && (character.baseImageUrl || character.expressionImageUrl || character.imageUrl)
  ));

  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[1024px] overflow-hidden rounded-md border bg-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-0 z-10 transition-[filter] duration-200"
        style={{
          filter: state.visualEffect.toLowerCase().includes('sepia') ? 'sepia(0.72) contrast(0.94) saturate(0.8)' : undefined,
        }}
      >
        {state.backgroundImageUrl && (
          <img
            src={state.backgroundImageUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
        )}
        <div className={cn(
          'absolute inset-0 transition-opacity duration-500',
          state.backgroundImageUrl
            ? 'bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.18)_70%,rgba(0,0,0,0.55))]'
            : 'bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.18),transparent_38%),linear-gradient(180deg,#26384f,#11131c_55%,#08080c)]'
        )} />

        <div className="pointer-events-none absolute inset-0 z-10">
          <MovieFrameCanvas movie={detail?.movie || null} sequenceName={state.sceneName} tick={tick} presentation="movie" />
        </div>

        {visibleCharacters.map((character) => (
          <CharacterSprite key={`${character.slot}:${character.id}`} character={character} characterCount={visibleCharacters.length} />
        ))}
      </div>

      {state.visualEffect && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-amber-900/10 mix-blend-color" />
      )}

      <div className="absolute inset-x-[6%] bottom-[22px] z-30 rounded-md border border-white/20 bg-[rgba(12,14,22,0.72)] p-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.38)] backdrop-blur-[2px]">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-cyan-100">
              {dialogue?.speakerName || dialogue?.speakerId || 'Scene'}
            </p>
            <p className="text-xs text-white/55">
              {state.sceneName || 'no scene sequence'} | frame {Math.floor(state.sceneFrame)} {dialogue?.voicePath ? `| ${dialogue.voicePath}` : ''}
            </p>
          </div>
          {audioUrl && (
            <audio key={audioUrl} controls src={audioUrl} className="h-7 max-w-[220px]" />
          )}
        </div>
        <p className="min-h-10 whitespace-pre-wrap text-[15px] leading-6">
          {dialogue?.text || 'Step through the script to reconstruct the scene state.'}
        </p>
      </div>
    </div>
  );
}

function getStoryState(
  commands: DecodedScenarioCommand[],
  currentIndex: number,
  timings: StoryCommandTiming[],
  playheadMs: number
): StoryRuntimeState {
  const characters = new Map<string, StoryCharacterState>();
  let sceneName = '';
  let sceneStartedAtMs = 0;
  let dialogue: DecodedScenarioCommand | null = null;
  let bgmUrls: string[] = [];
  let visualEffect = '';
  let activeCharacterId = '';
  let backgroundImageUrl = '';

  for (let index = 0; index <= currentIndex && index < commands.length; index += 1) {
    const command = commands[index];
    if (command.sceneName) {
      sceneName = command.sceneName;
      sceneStartedAtMs = timings[index]?.startMs || playheadMs;
    }
    if (command.text) {
      dialogue = command;
      if (command.speakerId) activeCharacterId = command.speakerId;
      if (command.speakerId && command.speakerSlot) {
        const existing = characters.get(command.speakerId);
        if (existing && !existing.slot) {
          characters.set(command.speakerId, {
            ...existing,
            slot: command.speakerSlot,
          });
        }
      }
    }
    if (command.bgmUrls.length) bgmUrls = command.bgmUrls;
    // Track background: use the first asset image that isn't a character body/expression
    if (command.assetImageUrls?.length) {
      const characterUrls = new Set(
        Array.from(characters.values()).flatMap((c) => [c.baseImageUrl, c.expressionImageUrl, c.imageUrl].filter(Boolean))
      );
      const bgCandidate = command.assetImageUrls.find((url) => url && !characterUrls.has(url) && !url.includes('/voice/'));
      if (bgCandidate) backgroundImageUrl = bgCandidate;
    }
    if (command.effect) {
      visualEffect = command.effect.action === 'clear' ? '' : command.effect.name;
    }
    if (command.character) {
      const existing = characters.get(command.character.id);
      const slot = command.character.slot || existing?.slot || '2';
      const expression = command.character.expression || existing?.expression || '';
      const next: StoryCharacterState = {
        ...(existing || command.character),
        ...command.character,
        slot,
        expression,
        visible: command.character.action === 'hide'
          ? false
          : command.character.action === 'show'
            ? command.character.visible
            : command.character.action === 'expression'
              ? existing?.visible ?? true
              : existing?.visible ?? command.character.visible,
        motion: command.character.motion || existing?.motion || '',
        baseImagePath: command.character.baseImagePath || existing?.baseImagePath || '',
        baseImageUrl: command.character.baseImageUrl || existing?.baseImageUrl || '',
        baseImageTrim: command.character.baseImageTrim || existing?.baseImageTrim || null,
        expressionImagePath: command.character.expressionImagePath || existing?.expressionImagePath || '',
        expressionImageUrl: command.character.expressionImageUrl || existing?.expressionImageUrl || '',
        expressionImageTrim: command.character.expressionImageTrim || existing?.expressionImageTrim || null,
        expressionLayers: command.character.expressionLayers.length ? command.character.expressionLayers : existing?.expressionLayers || [],
        imagePath: command.character.imagePath || existing?.imagePath || '',
        imageUrl: command.character.imageUrl || existing?.imageUrl || '',
        imageTrim: command.character.imageTrim || existing?.imageTrim || command.character.baseImageTrim || existing?.baseImageTrim || null,
        active: false,
        updatedAt: command.index,
      };

      characters.set(command.character.id, next);
      if (command.character.action === 'focus' || command.character.action === 'control') activeCharacterId = command.character.id;
    }
  }

  const orderedCharacters = Array.from(characters.values())
    .map((character) => ({
      ...character,
      active: activeCharacterId ? character.id === activeCharacterId : true,
    }))
    .sort((a, b) => {
      const slotDelta = toNumber(a.slot, 2) - toNumber(b.slot, 2);
      return slotDelta || a.updatedAt - b.updatedAt;
    });

  return {
    sceneName,
    dialogue,
    bgmUrls,
    characters: orderedCharacters,
    visualEffect,
    activeCharacterId,
    sceneStartedAtMs,
    sceneFrame: Math.max(0, Math.floor((playheadMs - sceneStartedAtMs) / STORY_FRAME_MS)),
    backgroundImageUrl,
  };
}

function BattleLayerPreview({ layer }: { layer: BattleLayer }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-md border bg-background/70 p-2">
      <div
        className="h-16 rounded border bg-muted/40 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${layer.imageUrl}")` }}
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{layer.label}</p>
        <p className="mt-1 line-clamp-2 break-all text-[11px] text-muted-foreground">{layer.path}</p>
      </div>
    </div>
  );
}

function BattleStage({ detail }: { detail: BattleDetail | null }) {
  if (!detail) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Choose a battle field to assemble its layers.
      </div>
    );
  }

  const visibleLayers = detail.layers.filter((layer) => layer.imageUrl);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-[1120px] overflow-hidden rounded-md border bg-black">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#111827,#030712)]" />
      <div className="absolute inset-0">
        {visibleLayers.map((layer, index) => (
          <img
            key={`${layer.role}:${layer.path}`}
            src={layer.imageUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none"
            style={{ zIndex: index + 1, objectFit: 'fill' }}
          />
        ))}
      </div>
      <div className="absolute left-4 top-4 z-20 max-w-md rounded-md border bg-background/90 p-3 shadow-sm">
        <p className="text-sm font-semibold">{detail.title}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">
          Field {detail.fieldId} | Zone {detail.zoneId}
        </p>
      </div>
      <div className="absolute bottom-4 right-4 z-20 rounded-md border bg-background/90 p-3 text-xs shadow-sm">
        <p>{detail.layers.length} visual layers</p>
        <p>{detail.zoneEntries.length} zone rows</p>
      </div>
    </div>
  );
}

function ZoneEntryList({ title, entries }: { title: string; entries: BattleZoneEntry[] }) {
  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="outline" className="rounded-md">{entries.length}</Badge>
      </div>
      <ScrollArea className="h-60 pr-2">
        <div className="grid gap-2">
          {entries.map((entry) => (
            <div key={entry.index} className="rounded-md border p-2 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">Row {entry.index}</span>
                {entry.ids.length > 0 && <span className="truncate text-muted-foreground">{entry.ids.join(', ')}</span>}
              </div>
              {entry.assetPaths.length > 0 && (
                <p className="line-clamp-2 break-all text-[11px] text-muted-foreground">{entry.assetPaths.join(', ')}</p>
              )}
              {entry.rawFields.length > 0 && (
                <p className="mt-1 line-clamp-2 break-all text-[10px] text-muted-foreground">
                  {entry.rawFields.map((field) => `${field.index}:${field.value}`).join(' | ')}
                </p>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              No decoded rows for this section.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function SceneReconstructorClient() {
  const [index, setIndex] = useState<SceneIndex | null>(null);
  const [mode, setMode] = useState<SceneMode>('story');
  const [lang, setLang] = useState<Lang>('en');
  const [search, setSearch] = useState('');
  const [selectedStoryPath, setSelectedStoryPath] = useState('');
  const [selectedBattleId, setSelectedBattleId] = useState('');
  const [storyDetail, setStoryDetail] = useState<StoryDetail | null>(null);
  const [battleDetail, setBattleDetail] = useState<BattleDetail | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const activeCommandRef = useRef<HTMLButtonElement | null>(null);

  const loadIndex = useCallback(async () => {
    setLoadingIndex(true);
    setError(null);
    try {
      const response = await fetch('/api/scenes', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Scene index failed (${response.status})`);
      const payload = (await response.json()) as SceneIndex;
      setIndex(payload);
      setSelectedStoryPath((current) => current || payload.storyScenes.find((scene) => scene.movie)?.path || payload.storyScenes[0]?.path || '');
      setSelectedBattleId((current) => current || payload.battleFields[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load scene index');
    } finally {
      setLoadingIndex(false);
    }
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (!selectedStoryPath) return;
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    fetch(`/api/scenes?mode=story&lang=${lang}&path=${encodeURIComponent(selectedStoryPath)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Story load failed (${response.status})`);
        return (await response.json()) as StoryDetail;
      })
      .then((payload) => {
        if (cancelled) return;
        setStoryDetail(payload);
        setCurrentCommandIndex(0);
        setPlayheadMs(0);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load story scene');
        setStoryDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang, selectedStoryPath]);

  useEffect(() => {
    if (!selectedBattleId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    fetch(`/api/scenes?mode=battle&id=${encodeURIComponent(selectedBattleId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Battle field load failed (${response.status})`);
        return (await response.json()) as BattleDetail;
      })
      .then((payload) => {
        if (!cancelled) setBattleDetail(payload);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load battle field');
        setBattleDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBattleId]);

  useEffect(() => {
    if (!playing || mode !== 'story') return;
    const interval = window.setInterval(() => {
      setPlayheadMs((time) => time + STORY_FRAME_MS * playbackSpeed);
    }, STORY_FRAME_MS);
    return () => window.clearInterval(interval);
  }, [mode, playing, playbackSpeed]);

  const tokens = useMemo(() => searchTokens(search), [search]);
  const filteredStories = useMemo(() => {
    const scenes = index?.storyScenes || [];
    return scenes.filter((scene) => {
      if (!tokens.length) return true;
      const blob = `${scene.title} ${scene.path} ${scene.category} ${scene.langs.join(' ')}`.toLowerCase();
      return tokens.every((token) => blob.includes(token));
    });
  }, [index, tokens]);

  const filteredBattles = useMemo(() => {
    const fields = index?.battleFields || [];
    return fields.filter((field) => {
      if (!tokens.length) return true;
      const blob = `${field.title} ${field.id} ${field.fieldId} ${field.zoneId} ${field.category}`.toLowerCase();
      return tokens.every((token) => blob.includes(token));
    });
  }, [index, tokens]);

  const currentCommands = useMemo(() => storyDetail?.commands || [], [storyDetail]);
  const storyTimings = useMemo(() => buildStoryTimings(currentCommands), [currentCommands]);
  const totalStoryMs = storyTimings[storyTimings.length - 1]?.endMs || 0;
  const maxCommandIndex = Math.max(0, currentCommands.length - 1);
  const safeCommandIndex = clamp(currentCommandIndex, 0, maxCommandIndex);
  const currentCommand = currentCommands[safeCommandIndex] || null;
  const safePlayheadMs = clamp(playheadMs, 0, totalStoryMs || 0);
  const storyState = useMemo(
    () => getStoryState(currentCommands, safeCommandIndex, storyTimings, safePlayheadMs),
    [currentCommands, safeCommandIndex, safePlayheadMs, storyTimings]
  );
  const movieSequences = storyDetail?.movie?.timeline.sequences || [];
  const storyLayers = useMemo(() => getStoryLayerStack(storyDetail, storyState), [storyDetail, storyState]);
  const battleLayers = useMemo(() => getBattleLayerStack(battleDetail), [battleDetail]);

  useEffect(() => {
    if (!storyTimings.length) return;
    if (playheadMs >= totalStoryMs && totalStoryMs > 0) {
      setPlaying(false);
      setPlayheadMs(totalStoryMs);
      setCurrentCommandIndex(maxCommandIndex);
      return;
    }
    setCurrentCommandIndex(getCommandIndexAtTime(storyTimings, playheadMs));
  }, [maxCommandIndex, playheadMs, storyTimings, totalStoryMs]);

  useEffect(() => {
    activeCommandRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [safeCommandIndex]);

  const seekCommand = useCallback((indexValue: number) => {
    const nextIndex = clamp(indexValue, 0, maxCommandIndex);
    setCurrentCommandIndex(nextIndex);
    setPlayheadMs(getTimingStart(storyTimings, nextIndex));
  }, [maxCommandIndex, storyTimings]);

  const selectStory = (pathValue: string) => {
    setSelectedStoryPath(pathValue);
    setMode('story');
  };

  const selectBattle = (id: string) => {
    setSelectedBattleId(id);
    setMode('battle');
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-6 lg:px-6">
        <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-emerald-500/10 text-emerald-700">
                <Clapperboard className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Scene Reconstructor</h1>
                <p className="text-sm text-muted-foreground">
                  Rebuild story scripts, timeline movies, character poses, and battle field layers from the datamine.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md">{index?.storyScenes.length || 0} stories</Badge>
            <Badge variant="outline" className="rounded-md">{index?.battleFields.length || 0} battle fields</Badge>
            <Button variant="outline" size="sm" onClick={loadIndex} disabled={loadingIndex} className="gap-2">
              {loadingIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
          <aside className="rounded-md border bg-card p-4">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-background p-1">
                <Button
                  type="button"
                  variant={mode === 'story' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('story')}
                  className="gap-2"
                >
                  <BookOpenText className="h-4 w-4" />
                  Story
                </Button>
                <Button
                  type="button"
                  variant={mode === 'battle' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('battle')}
                  className="gap-2"
                >
                  <Layers className="h-4 w-4" />
                  Battle
                </Button>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="scene-search">
                  Search scenes
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="scene-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={mode === 'story' ? 'alice, advent, main chapter...' : 'world 10, boss, grass...'}
                    className="pl-9"
                  />
                </div>
              </div>

              {mode === 'story' && (
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Language</label>
                  <Select value={lang} onValueChange={(value) => setLang(value as Lang)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English when available</SelectItem>
                      <SelectItem value="jp">Japanese source</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{mode === 'story' ? filteredStories.length : filteredBattles.length} matches</span>
                <span>showing {Math.min(LIST_LIMIT, mode === 'story' ? filteredStories.length : filteredBattles.length)}</span>
              </div>

              <ScrollArea className="h-[680px] pr-2">
                <div className="grid gap-2">
                  {loadingIndex && (
                    <div className="flex h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading scenes
                    </div>
                  )}

                  {!loadingIndex && mode === 'story' && filteredStories.slice(0, LIST_LIMIT).map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => selectStory(scene.path)}
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition-colors',
                        selectedStoryPath === scene.path ? 'border-primary bg-primary/5' : 'bg-background/70 hover:bg-accent'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{scene.title}</p>
                          <p className="mt-1 line-clamp-2 break-all text-[11px] text-muted-foreground">{scene.path}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          {scene.movie && <Badge variant="outline" className="rounded-md">movie</Badge>}
                          <Badge variant="outline" className="rounded-md">{scene.langs.join('/')}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}

                  {!loadingIndex && mode === 'battle' && filteredBattles.slice(0, LIST_LIMIT).map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => selectBattle(field.id)}
                      className={cn(
                        'grid w-full grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-md border p-2 text-left transition-colors',
                        selectedBattleId === field.id ? 'border-primary bg-primary/5' : 'bg-background/70 hover:bg-accent'
                      )}
                    >
                      <div
                        className="h-16 rounded border bg-muted/40 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: field.thumbnail ? `url("https://wfjukebox.b-cdn.net/${field.thumbnail}.png")` : undefined }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{field.title}</p>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{field.fieldId}</p>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{field.layerCount} layers | {field.zoneId}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </aside>

          <div className="grid gap-4">
            {mode === 'story' ? (
              <>
                <section className="rounded-md border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Film className="h-4 w-4 text-muted-foreground" />
                        <h2 className="truncate text-lg font-semibold">{storyDetail?.title || 'No story selected'}</h2>
                        {storyDetail?.movie && <Badge variant="outline" className="rounded-md">{storyDetail.movie.source} movie</Badge>}
                        <Badge variant="outline" className="rounded-md">{storyLayers.filter((layer) => layer.visible).length} visible layers</Badge>
                        {loadingDetail && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{storyDetail?.path || selectedStoryPath}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => seekCommand(safeCommandIndex - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!playing && totalStoryMs > 0 && safePlayheadMs >= totalStoryMs) {
                            seekCommand(0);
                          }
                          setPlaying((value) => !value);
                        }}
                      >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {playing ? 'Pause' : 'Play'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => seekCommand(safeCommandIndex + 1)}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
                        {([0.5, 1, 2, 4] as const).map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => setPlaybackSpeed(speed)}
                            className={cn(
                              'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                              playbackSpeed === speed ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {speed}×
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <StoryStage detail={storyDetail} state={storyState} tick={storyState.sceneFrame} />

                  <div className="mt-3 grid gap-2 rounded-md border bg-background/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>Command {safeCommandIndex + 1} / {currentCommands.length || 1}</span>
                      <span>
                        {(safePlayheadMs / 1000).toFixed(1)}s / {(totalStoryMs / 1000).toFixed(1)}s | {currentCommand?.label || 'No command'} {currentCommand?.op ? `| op ${currentCommand.op}` : ''}
                      </span>
                    </div>
                    <Slider
                      value={[safeCommandIndex]}
                      min={0}
                      max={maxCommandIndex}
                      step={1}
                      disabled={currentCommands.length <= 1}
                      onValueChange={(value) => seekCommand(value[0] || 0)}
                    />
                    {movieSequences.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {movieSequences.slice(0, 36).map((sequence) => (
                          <Button
                            key={sequence.name}
                            type="button"
                            variant={storyState.sceneName === sequence.name ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const indexForSequence = currentCommands.findIndex((command) => command.sceneName === sequence.name);
                              if (indexForSequence >= 0) seekCommand(indexForSequence);
                            }}
                          >
                            {sequence.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="rounded-md border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Script Commands</h3>
                      <Badge variant="outline" className="rounded-md">{storyDetail?.dialogueCount || 0} lines</Badge>
                    </div>
                    <ScrollArea className="h-[420px] pr-2">
                      <div className="grid gap-2">
                        {currentCommands.map((command, index) => (
                          <button
                            key={command.index}
                            ref={index === safeCommandIndex ? activeCommandRef : undefined}
                            type="button"
                            onClick={() => seekCommand(index)}
                            className={cn(
                              'rounded-md border p-3 text-left transition-colors',
                              index === safeCommandIndex ? 'border-primary bg-primary/5' : 'bg-background/70 hover:bg-accent'
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold">#{command.index} {command.label}</span>
                              <Badge variant="outline" className="rounded-md">op {command.op || '?'}</Badge>
                            </div>
                            {command.text && (
                              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs">{command.text}</p>
                            )}
                            {command.sceneName && <p className="mt-2 text-xs text-muted-foreground">Movie sequence: {command.sceneName}</p>}
                            {command.character && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {command.character.action} {command.character.name} | slot {command.character.slot || 'held'} | {command.character.expression || 'current'} {command.character.motion ? `| motion ${command.character.motion}` : ''}
                              </p>
                            )}
                            {command.effect && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {command.effect.action === 'clear' ? 'clear effect' : `effect ${command.effect.name}`}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="grid gap-4">
                    <LayerStackPanel title="Scene Layers" layers={storyLayers} />

                    <div className="rounded-md border bg-card p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Audio</h3>
                      </div>
                      <div className="grid gap-2 text-xs">
                        {(storyDetail?.bgmPaths || []).slice(0, 8).map((bgm) => (
                          <p key={bgm} className="break-all rounded-md border bg-background/70 p-2">{bgm}</p>
                        ))}
                        {currentCommand?.voicePath && (
                          <p className="break-all rounded-md border bg-background/70 p-2">Voice: {currentCommand.voicePath}</p>
                        )}
                        {!storyDetail?.bgmPaths.length && !currentCommand?.voicePath && (
                          <p className="rounded-md border border-dashed p-3 text-muted-foreground">No decoded audio at this step.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border bg-card p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Raw Fields</h3>
                      </div>
                      <ScrollArea className="h-64 pr-2">
                        <div className="grid gap-1.5 text-xs">
                          {(currentCommand?.rawFields || []).map((field) => (
                            <p key={field.index} className="break-all rounded border bg-background/70 px-2 py-1">
                              <span className="text-muted-foreground">{field.index}:</span> {field.value}
                            </p>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-md border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <h2 className="truncate text-lg font-semibold">{battleDetail?.title || 'No battle field selected'}</h2>
                        {loadingDetail && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {battleDetail ? `${battleDetail.fieldId} | terrain ${battleDetail.terrain || 'none'}` : selectedBattleId}
                      </p>
                    </div>
                  </div>
                  <BattleStage detail={battleDetail} />
                  <div className="mt-4">
                    <LayerStackPanel title="Battle Render Stack" layers={battleLayers} />
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="rounded-md border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Field Layers</h3>
                      <Badge variant="outline" className="rounded-md">{battleDetail?.layers.length || 0}</Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(battleDetail?.layers || []).map((layer) => (
                        <BattleLayerPreview key={`${layer.role}:${layer.path}`} layer={layer} />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <ZoneEntryList title="Zone Objects" entries={battleDetail?.zoneEntries || []} />
                    <ZoneEntryList title="Zone Actions" entries={battleDetail?.actionEntries || []} />
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
