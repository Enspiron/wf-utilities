'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from 'lucide-react';
import { GIFEncoder, applyPalette, quantize, type GifPalette } from 'gifenc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  buildMetadataFrames,
  chooseDefaultSequence,
  getMetadataFrameCount,
  type AtlasEntry,
  type MetadataFrame,
  type SpriteMetadata,
  type TimelineSequence,
} from '@/lib/sprite-animation';
import { ASSET_CDN_ROOT, normalizeAssetPath } from '@/lib/asset-url';
import { cn } from '@/lib/utils';

type ScopeFilter = 'all' | 'battle-boss' | 'battle-funnel' | 'sprite-sheet' | 'character';
type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';
type MetadataStatus = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';
type BackgroundMode = 'checker' | 'transparent' | 'black' | 'white';
type ViewMode = 'metadata' | 'grid';
type CandidateViewMode = 'grid' | 'list';
type GifExportAction = 'download' | 'open';

type SpriteAsset = {
  id: string;
  path: string;
  label: string;
  category: string;
  file: string;
  lang: 'jp' | 'en';
  sourceKey: string;
  tags: string[];
  sources: string[];
  context: string[];
  preview?: SpriteSheetPreview;
};

type SpriteSheetPreview = {
  source: string;
  sequence: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: boolean;
  fx?: number;
  fy?: number;
  fw?: number;
  fh?: number;
};

type SpriteSheetPayload = {
  assets: SpriteAsset[];
  count: number;
  scannedFiles?: number;
  error?: string;
};

type ImageInfo = {
  status: ImageStatus;
  url: string;
  width: number;
  height: number;
  attempted: string[];
  error?: string;
};

type SheetSettings = {
  frameWidth: number;
  frameHeight: number;
  gap: number;
  offsetX: number;
  offsetY: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  zoom: number;
  pingPong: boolean;
  background: BackgroundMode;
};

type GridMetrics = {
  columns: number;
  rows: number;
  totalFrames: number;
  startFrame: number;
  endFrame: number;
};

type LoadedImage = {
  url: string;
  width: number;
  height: number;
};

type MetadataInfo = {
  status: MetadataStatus;
  base: string;
  attempted: string[];
  metadata?: SpriteMetadata;
  error?: string;
};

const CDN_ROOT = ASSET_CDN_ROOT;
const LIST_LIMIT = 260;
const DEFAULT_METADATA_FRAME_MS = 16;
const MAX_GIF_FRAMES = 360;
const GRID_PREVIEW_WIDTH = 168;
const GRID_PREVIEW_HEIGHT = 96;
const DEFAULT_SETTINGS: SheetSettings = {
  frameWidth: 128,
  frameHeight: 128,
  gap: 0,
  offsetX: 0,
  offsetY: 0,
  startFrame: 0,
  endFrame: 0,
  fps: 12,
  zoom: 2,
  pingPong: false,
  background: 'checker',
};

const SCOPE_OPTIONS: Array<{ value: ScopeFilter; label: string }> = [
  { value: 'all', label: 'All candidates' },
  { value: 'battle-boss', label: 'Battle boss' },
  { value: 'battle-funnel', label: 'Battle funnel' },
  { value: 'sprite-sheet', label: 'sprite_sheet paths' },
  { value: 'character', label: 'Character pixelart' },
];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(value);
}

function getLocalCharacterPixelartSource(raw: string): string | null {
  const assetPath = normalizeAssetPath(raw);
  if (!assetPath) return null;

  const withoutExt = assetPath.replace(/\.[a-z0-9]{2,5}$/i, '');
  if (!/^character\/[^/]+\/pixelart\/(?:sprite_sheet|special_sprite_sheet)$/i.test(withoutExt)) {
    return null;
  }

  return `/assets/${hasImageExtension(assetPath) ? assetPath : `${withoutExt}.png`}`;
}

function buildImageSources(raw: string): string[] {
  const assetPath = normalizeAssetPath(raw);
  if (!assetPath) return [];

  if (/^https?:\/\//i.test(raw) && !raw.trim().startsWith(CDN_ROOT)) {
    const noQuery = raw.trim().split(/[?#]/)[0];
    if (hasImageExtension(noQuery)) return [noQuery];
    const base = noQuery.replace(/\.[a-z0-9]{2,5}$/i, '');
    return [`${base}.png`, `${base}.jpg`, `${base}.webp`];
  }

  const withoutExt = assetPath.replace(/\.[a-z0-9]{2,5}$/i, '');
  const paths = hasImageExtension(assetPath)
    ? [assetPath]
    : [`${withoutExt}.png`, `${withoutExt}.jpg`, `${withoutExt}.webp`];
  const sources = new Set<string>();
  const localSource = getLocalCharacterPixelartSource(assetPath);
  if (localSource) sources.add(localSource);

  for (const pathValue of paths) {
    sources.add(`${CDN_ROOT}/${pathValue}`);
    if (!pathValue.startsWith('wfjukebox/')) {
      sources.add(`${CDN_ROOT}/wfjukebox/${pathValue}`);
    }
  }

  return Array.from(sources);
}

function getPreferredImageSources(asset: Pick<SpriteAsset, 'path' | 'sources'>): string[] {
  return Array.from(new Set([...buildImageSources(asset.path), ...(asset.sources || [])]));
}

function getPreferredPreview(asset: SpriteAsset): SpriteSheetPreview | undefined {
  if (!asset.preview) return undefined;
  const localSource = getLocalCharacterPixelartSource(asset.path);
  return localSource ? { ...asset.preview, source: localSource } : asset.preview;
}

function humanizePath(value: string): string {
  const last = normalizeAssetPath(value).split('/').filter(Boolean).pop() || value;
  return last
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || value;
}

function formatDimensions(width: number, height: number): string {
  if (!width || !height) return 'unknown';
  return `${width} x ${height}`;
}

function loadImageFromSources(sources: string[]): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    let index = 0;

    const tryNext = () => {
      const url = sources[index];
      if (!url) {
        reject(new Error('No image candidate loaded'));
        return;
      }

      const image = new window.Image();
      image.onload = () => {
        resolve({
          url,
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        });
      };
      image.onerror = () => {
        index += 1;
        tryNext();
      };
      image.src = url;
    };

    tryNext();
  });
}

function buildMetadataBases(imageUrl: string, assetPath: string, sources: string[]): string[] {
  const bases = new Set<string>();
  const addBase = (value: string) => {
    if (!value) return;
    const withoutQuery = value.trim().split(/[?#]/)[0];
    const withoutExt = withoutQuery.replace(/\.(png|jpe?g|webp|gif|bmp)$/i, '');
    if (withoutExt) bases.add(withoutExt);
  };

  addBase(imageUrl);
  addBase(assetPath);
  sources.forEach(addBase);

  return Array.from(bases);
}

function isUsableMetadata(value: unknown): value is SpriteMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as SpriteMetadata;
  return (
    Array.isArray(metadata.atlas) &&
    Array.isArray(metadata.timeline?.sequences) &&
    Boolean(metadata.parts) &&
    Array.isArray(metadata.parts.i) &&
    Array.isArray(metadata.parts.g)
  );
}

function metadataFrameSize(entry: AtlasEntry, zoom: number): { width: number; height: number } {
  const width = entry.fw || (entry.r ? entry.h : entry.w);
  const height = entry.fh || (entry.r ? entry.w : entry.h);
  return {
    width: Math.max(1, Math.ceil(width * zoom)),
    height: Math.max(1, Math.ceil(height * zoom)),
  };
}

function guessSettings(width: number, height: number): Pick<SheetSettings, 'frameWidth' | 'frameHeight' | 'startFrame' | 'endFrame'> {
  const squareSizes = [512, 384, 320, 256, 192, 160, 128, 96, 80, 64, 48, 32];
  for (const size of squareSizes) {
    if (width % size !== 0 || height % size !== 0) continue;
    const totalFrames = (width / size) * (height / size);
    if (totalFrames >= 2 && totalFrames <= 240) {
      return { frameWidth: size, frameHeight: size, startFrame: 0, endFrame: totalFrames - 1 };
    }
  }

  if (width >= 1024 && height >= 512) {
    const frameWidth = width % 256 === 0 ? 256 : 128;
    const frameHeight = height % frameWidth === 0 ? frameWidth : 128;
    const totalFrames = Math.max(1, Math.floor(width / frameWidth) * Math.floor(height / frameHeight));
    return { frameWidth, frameHeight, startFrame: 0, endFrame: totalFrames - 1 };
  }

  return { frameWidth: Math.max(1, width), frameHeight: Math.max(1, height), startFrame: 0, endFrame: 0 };
}

function getGridMetrics(imageInfo: ImageInfo, settings: SheetSettings): GridMetrics {
  if (imageInfo.status !== 'loaded' || imageInfo.width <= 0 || imageInfo.height <= 0) {
    return { columns: 1, rows: 1, totalFrames: 1, startFrame: 0, endFrame: 0 };
  }

  const stepX = Math.max(1, settings.frameWidth + settings.gap);
  const stepY = Math.max(1, settings.frameHeight + settings.gap);
  const columns = Math.max(1, Math.floor((imageInfo.width - settings.offsetX + settings.gap) / stepX));
  const rows = Math.max(1, Math.floor((imageInfo.height - settings.offsetY + settings.gap) / stepY));
  const totalFrames = Math.max(1, columns * rows);
  const startFrame = clamp(Math.round(settings.startFrame), 0, totalFrames - 1);
  const endFrame = clamp(Math.round(settings.endFrame), startFrame, totalFrames - 1);

  return { columns, rows, totalFrames, startFrame, endFrame };
}

function getFrameStyle(params: {
  url: string;
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  frameHeight: number;
  frameIndex: number;
  columns: number;
  gap: number;
  offsetX: number;
  offsetY: number;
  zoom: number;
  background: BackgroundMode;
}): CSSProperties {
  const col = params.frameIndex % params.columns;
  const row = Math.floor(params.frameIndex / params.columns);
  const x = params.offsetX + col * (params.frameWidth + params.gap);
  const y = params.offsetY + row * (params.frameHeight + params.gap);
  const zoom = clamp(params.zoom, 0.25, 8);

  return {
    width: params.frameWidth * zoom,
    height: params.frameHeight * zoom,
    backgroundColor: params.background === 'black' ? '#050505' : params.background === 'white' ? '#ffffff' : 'transparent',
    backgroundImage: `url("${params.url}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${params.imageWidth * zoom}px ${params.imageHeight * zoom}px`,
    backgroundPosition: `-${x * zoom}px -${y * zoom}px`,
    imageRendering: 'pixelated',
  };
}

function getPreviewBackground(mode: BackgroundMode): string {
  if (mode === 'checker') {
    return 'bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(-45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,transparent_75%,hsl(var(--muted))_75%),linear-gradient(-45deg,transparent_75%,hsl(var(--muted))_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0]';
  }
  if (mode === 'black') return 'bg-black';
  if (mode === 'white') return 'bg-white';
  return 'bg-transparent';
}

function paintExportBackground(context: CanvasRenderingContext2D, mode: BackgroundMode, width: number, height: number) {
  context.clearRect(0, 0, width, height);
  if (mode === 'transparent') return;

  if (mode === 'black' || mode === 'white') {
    context.fillStyle = mode === 'black' ? '#050505' : '#ffffff';
    context.fillRect(0, 0, width, height);
    return;
  }

  const tile = 12;
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#d4dbe5';
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      if ((x / tile + y / tile) % 2 === 0) {
        context.fillRect(x, y, tile, tile);
      }
    }
  }
}

function drawAtlasFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  entry: AtlasEntry,
  scale: number,
  width: number,
  height: number,
  background: BackgroundMode
) {
  paintExportBackground(context, background, width, height);
  context.imageSmoothingEnabled = false;

  const frameSize = metadataFrameSize(entry, scale);
  const originX = Math.floor((width - frameSize.width) / 2);
  const originY = Math.floor((height - frameSize.height) / 2);
  const sourceX = Math.max(0, entry.x);
  const sourceY = Math.max(0, entry.y);
  const sourceW = Math.max(1, entry.w);
  const sourceH = Math.max(1, entry.h);
  const left = originX - (entry.fx || 0) * scale;
  const top = originY - (entry.fy || 0) * scale;

  if (entry.r) {
    context.save();
    context.translate(left, top + sourceW * scale);
    context.rotate(-Math.PI / 2);
    context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW * scale, sourceH * scale);
    context.restore();
    return;
  }

  context.drawImage(image, sourceX, sourceY, sourceW, sourceH, left, top, sourceW * scale, sourceH * scale);
}

function drawGridFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  settings: SheetSettings,
  grid: GridMetrics,
  frameIndex: number,
  scale: number,
  background: BackgroundMode
) {
  const width = Math.max(1, Math.ceil(settings.frameWidth * scale));
  const height = Math.max(1, Math.ceil(settings.frameHeight * scale));
  const col = frameIndex % grid.columns;
  const row = Math.floor(frameIndex / grid.columns);
  const sourceX = settings.offsetX + col * (settings.frameWidth + settings.gap);
  const sourceY = settings.offsetY + row * (settings.frameHeight + settings.gap);

  paintExportBackground(context, background, width, height);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    settings.frameWidth,
    settings.frameHeight,
    0,
    0,
    width,
    height
  );
}

function getFrameIndexes(startFrame: number, endFrame: number, pingPong: boolean): number[] {
  const frames: number[] = [];
  for (let frame = startFrame; frame <= endFrame; frame += 1) frames.push(frame);

  if (pingPong && endFrame > startFrame + 1) {
    for (let frame = endFrame - 1; frame > startFrame; frame -= 1) frames.push(frame);
  }

  return frames;
}

function hasTransparentPixels(data: Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 128) return true;
  }
  return false;
}

function getTransparentIndex(palette: GifPalette): number {
  return palette.findIndex((color) => (color[3] ?? 255) < 128);
}

function encodeGifFrames(frames: Array<{ imageData: ImageData; delayMs: number }>, width: number, height: number): Blob {
  const gif = GIFEncoder({ initialCapacity: Math.max(4096, width * height) });

  frames.forEach((frame) => {
    const transparent = hasTransparentPixels(frame.imageData.data);
    const format = transparent ? 'rgba4444' : 'rgb565';
    let palette = quantize(frame.imageData.data, transparent ? 255 : 256, {
      format,
      oneBitAlpha: transparent,
      clearAlpha: true,
      clearAlphaThreshold: 127,
      clearAlphaColor: 0,
    });
    let transparentIndex = transparent ? getTransparentIndex(palette) : -1;

    if (transparent && transparentIndex < 0) {
      palette = [[0, 0, 0, 0], ...palette.slice(0, 255)];
      transparentIndex = 0;
    }

    const index = applyPalette(frame.imageData.data, palette, format);
    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.max(10, Math.round(frame.delayMs)),
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex,
      dispose: transparentIndex >= 0 ? 2 : -1,
    });
  });

  gif.finish();
  const bytes = gif.bytes();
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  return new Blob([output.buffer], { type: 'image/gif' });
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sprite';
}

function matchesScope(asset: SpriteAsset, scope: ScopeFilter): boolean {
  if (scope === 'all') return true;
  if (scope === 'battle-boss') return asset.tags.includes('boss');
  if (scope === 'battle-funnel') return asset.tags.includes('funnel');
  if (scope === 'sprite-sheet') return asset.tags.includes('sprite_sheet');
  if (scope === 'character') return asset.tags.includes('character');
  return true;
}

function getSearchGroups(value: string): string[][] {
  return value
    .split(',')
    .map((group) =>
      group
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
    .filter((group) => group.length > 0);
}

function getPreviewDisplaySize(preview: SpriteSheetPreview): { width: number; height: number } {
  return {
    width: preview.fw || (preview.r ? preview.h : preview.w),
    height: preview.fh || (preview.r ? preview.w : preview.h),
  };
}

function getPreviewCropStyle(preview: SpriteSheetPreview): CSSProperties {
  const displaySize = getPreviewDisplaySize(preview);
  const scale = clamp(
    Math.min(
      (GRID_PREVIEW_WIDTH - 12) / Math.max(1, displaySize.width),
      (GRID_PREVIEW_HEIGHT - 12) / Math.max(1, displaySize.height)
    ),
    0.15,
    1.75
  );

  return {
    width: preview.w,
    height: preview.h,
    backgroundImage: `url("${preview.source}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${preview.x}px -${preview.y}px`,
    imageRendering: 'pixelated',
    transform: `scale(${scale})${preview.r ? ' rotate(-90deg)' : ''}`,
    transformOrigin: 'center',
  };
}

function getFallbackPreviewStyle(asset: SpriteAsset): CSSProperties | undefined {
  const source = getPreferredImageSources(asset)[0];
  if (!source) return undefined;

  return {
    width: '100%',
    height: '100%',
    backgroundImage: `url("${source}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    imageRendering: 'pixelated',
  };
}

function AssetRow({
  asset,
  active,
  onSelect,
}: {
  asset: SpriteAsset;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-md border p-3 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'bg-background/70 hover:bg-accent'
      )}
      onClick={() => onSelect(asset.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{asset.label}</p>
          <p className="mt-1 break-all text-[11px] text-muted-foreground">{asset.path}</p>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-md">
          {asset.lang}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {asset.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) return;
          onChange(max === undefined ? Math.max(min, parsed) : clamp(parsed, min, max));
        }}
        className="h-9"
      />
    </label>
  );
}

function FrameThumb({
  imageInfo,
  settings,
  grid,
  frameIndex,
  active,
  onSelect,
}: {
  imageInfo: ImageInfo;
  settings: SheetSettings;
  grid: GridMetrics;
  frameIndex: number;
  active: boolean;
  onSelect: (frame: number) => void;
}) {
  if (imageInfo.status !== 'loaded') return null;
  const thumbZoom = Math.min(1, 48 / Math.max(settings.frameWidth, settings.frameHeight));
  const style = getFrameStyle({
    url: imageInfo.url,
    imageWidth: imageInfo.width,
    imageHeight: imageInfo.height,
    frameWidth: settings.frameWidth,
    frameHeight: settings.frameHeight,
    frameIndex,
    columns: grid.columns,
    gap: settings.gap,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
    zoom: thumbZoom,
    background: settings.background,
  });

  return (
    <button
      type="button"
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-md border bg-background/80',
        active ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
      )}
      onClick={() => onSelect(frameIndex)}
      title={`Frame ${frameIndex}`}
    >
      <span style={style} />
    </button>
  );
}

const canvasImageCache = new Map<string, Promise<HTMLImageElement>>();

function getCanvasImageSource(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return `/api/assets/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function loadCanvasImage(url: string): Promise<HTMLImageElement> {
  const source = getCanvasImageSource(url);
  const cached = canvasImageCache.get(source);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load sprite sheet for canvas'));
    image.src = source;
  });

  canvasImageCache.set(source, promise);
  return promise;
}

function AtlasFrameCanvas({
  imageUrl,
  frame,
  zoom,
  className,
}: {
  imageUrl: string;
  frame: MetadataFrame;
  zoom: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const entry = frame.atlas;
  const scale = clamp(zoom, 0.25, 8);
  const size = metadataFrameSize(entry, scale);

  useEffect(() => {
    let cancelled = false;

    loadCanvasImage(imageUrl)
      .then((image) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        canvas.width = size.width;
        canvas.height = size.height;
        context.clearRect(0, 0, size.width, size.height);
        context.imageSmoothingEnabled = false;

        const sourceX = Math.max(0, entry.x);
        const sourceY = Math.max(0, entry.y);
        const sourceW = Math.max(1, entry.w);
        const sourceH = Math.max(1, entry.h);
        const left = -(entry.fx || 0) * scale;
        const top = -(entry.fy || 0) * scale;

        if (entry.r) {
          context.save();
          context.translate(left, top + sourceW * scale);
          context.rotate(-Math.PI / 2);
          context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW * scale, sourceH * scale);
          context.restore();
        } else {
          context.drawImage(
            image,
            sourceX,
            sourceY,
            sourceW,
            sourceH,
            left,
            top,
            sourceW * scale,
            sourceH * scale
          );
        }
      })
      .catch(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        canvas.width = size.width;
        canvas.height = size.height;
        context.clearRect(0, 0, size.width, size.height);
      });

    return () => {
      cancelled = true;
    };
  }, [entry, imageUrl, scale, size.height, size.width]);

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      className={cn('block [image-rendering:pixelated]', className)}
      style={{ width: size.width, height: size.height }}
    />
  );
}

function AtlasFrameThumb({
  imageUrl,
  frame,
  index,
  active,
  onSelect,
}: {
  imageUrl: string;
  frame: MetadataFrame;
  index: number;
  active: boolean;
  onSelect: (frame: number) => void;
}) {
  const baseWidth = frame.atlas.fw || (frame.atlas.r ? frame.atlas.h : frame.atlas.w);
  const baseHeight = frame.atlas.fh || (frame.atlas.r ? frame.atlas.w : frame.atlas.h);
  const zoom = Math.min(1, 48 / Math.max(baseWidth, baseHeight));

  return (
    <button
      type="button"
      className={cn(
        'flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border bg-background/80',
        active ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
      )}
      onClick={() => onSelect(index)}
      title={`Frame ${index + 1}`}
    >
      <AtlasFrameCanvas imageUrl={imageUrl} frame={frame} zoom={zoom} />
    </button>
  );
}

function AssetPreviewCard({
  asset,
  active,
  onSelect,
}: {
  asset: SpriteAsset;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = buttonRef.current;
    if (!element) return;

    if (!('IntersectionObserver' in window)) {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: '280px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const preview = getPreferredPreview(asset);
  const previewStyle = visible && preview ? getPreviewCropStyle(preview) : undefined;
  const fallbackStyle = visible && !preview ? getFallbackPreviewStyle(asset) : undefined;
  const previewLabel = preview?.sequence || (fallbackStyle ? 'sheet' : '');

  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(
        'grid h-[188px] w-full grid-rows-[96px_minmax(0,1fr)] overflow-hidden rounded-md border bg-background/70 text-left transition-colors [contain-intrinsic-size:188px_168px] [content-visibility:auto]',
        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
      )}
      onClick={() => onSelect(asset.id)}
      title={`${asset.label} - ${asset.path}`}
    >
      <div className="relative flex h-24 items-center justify-center overflow-hidden border-b bg-muted/30">
        {previewStyle ? (
          <span className="block shrink-0" style={previewStyle} />
        ) : fallbackStyle ? (
          <span className="block h-full w-full" style={fallbackStyle} />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
        )}
        {previewLabel && (
          <span className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded border bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {previewLabel}
          </span>
        )}
      </div>
      <div className="grid min-h-0 content-between gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{asset.label}</p>
          <p className="mt-1 line-clamp-2 break-all text-[10px] leading-3 text-muted-foreground">{asset.path}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-muted-foreground">{asset.tags[0] || asset.category}</span>
          <Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 text-[10px]">
            {asset.lang}
          </Badge>
        </div>
      </div>
    </button>
  );
}

export default function SpriteSheetsClient() {
  const [assets, setAssets] = useState<SpriteAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('battle-boss');
  const [customPath, setCustomPath] = useState('');
  const [activeCustomPath, setActiveCustomPath] = useState('');
  const [candidateViewMode, setCandidateViewMode] = useState<CandidateViewMode>('grid');
  const [settings, setSettings] = useState<SheetSettings>(DEFAULT_SETTINGS);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gifAction, setGifAction] = useState<GifExportAction | null>(null);
  const [gifError, setGifError] = useState<string | null>(null);
  const [selectedSequenceName, setSelectedSequenceName] = useState('');
  const [metadataFrameMs, setMetadataFrameMs] = useState(DEFAULT_METADATA_FRAME_MS);
  const [metadataInfo, setMetadataInfo] = useState<MetadataInfo>({
    status: 'idle',
    base: '',
    attempted: [],
  });
  const [imageInfo, setImageInfo] = useState<ImageInfo>({
    status: 'idle',
    url: '',
    width: 0,
    height: 0,
    attempted: [],
  });

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const directionRef = useRef(1);
  const loadedUrlRef = useRef('');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sprite-sheets', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load candidates (${response.status})`);
      const payload = (await response.json()) as SpriteSheetPayload;
      if (payload.error) throw new Error(payload.error);
      setAssets(Array.isArray(payload.assets) ? payload.assets : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load candidates');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const filteredAssets = useMemo(() => {
    const searchGroups = getSearchGroups(search);
    return assets.filter((asset) => {
      if (!matchesScope(asset, scope)) return false;
      if (!searchGroups.length) return true;
      const blob = `${asset.label} ${asset.path} ${asset.file} ${asset.tags.join(' ')}`.toLowerCase();
      return searchGroups.some((group) => group.every((token) => blob.includes(token)));
    });
  }, [assets, scope, search]);

  useEffect(() => {
    if (selectedId || activeCustomPath || filteredAssets.length === 0) return;
    setSelectedId(filteredAssets[0].id);
  }, [activeCustomPath, filteredAssets, selectedId]);

  const selectedAsset = useMemo(() => {
    return assets.find((asset) => asset.id === selectedId) || null;
  }, [assets, selectedId]);

  const activeDescriptor = useMemo(() => {
    if (activeCustomPath.trim()) {
      const pathValue = normalizeAssetPath(activeCustomPath);
      return {
        id: `custom:${pathValue}`,
        label: humanizePath(pathValue),
        path: pathValue,
        sources: buildImageSources(pathValue),
        tags: ['custom'],
        file: 'manual',
        sourceKey: '',
        category: 'manual',
        lang: 'en' as const,
        context: [],
      };
    }
    if (!selectedAsset) return null;

    const sources = getPreferredImageSources(selectedAsset);
    return {
      ...selectedAsset,
      sources: sources.length ? sources : selectedAsset.sources,
      preview: getPreferredPreview(selectedAsset),
    };
  }, [activeCustomPath, selectedAsset]);

  const sourceKey = activeDescriptor ? activeDescriptor.sources.join('|') : '';

  useEffect(() => {
    if (!activeDescriptor || activeDescriptor.sources.length === 0) {
      setImageInfo({ status: 'idle', url: '', width: 0, height: 0, attempted: [] });
      return;
    }

    let cancelled = false;
    const sources = activeDescriptor.sources;
    setImageInfo({ status: 'loading', url: '', width: 0, height: 0, attempted: sources });

    loadImageFromSources(sources)
      .then((result) => {
        if (cancelled) return;
        setImageInfo({
          status: 'loaded',
          url: result.url,
          width: result.width,
          height: result.height,
          attempted: sources,
        });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setImageInfo({
          status: 'error',
          url: '',
          width: 0,
          height: 0,
          attempted: sources,
          error: loadError instanceof Error ? loadError.message : 'No image candidate loaded',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeDescriptor, sourceKey]);

  useEffect(() => {
    if (imageInfo.status !== 'loaded' || !imageInfo.url || loadedUrlRef.current === imageInfo.url) return;
    loadedUrlRef.current = imageInfo.url;
    const guessed = guessSettings(imageInfo.width, imageInfo.height);
    setSettings((current) => ({
      ...current,
      ...guessed,
      gap: 0,
      offsetX: 0,
      offsetY: 0,
    }));
    setCurrentFrame(0);
    directionRef.current = 1;
  }, [imageInfo]);

  useEffect(() => {
    if (imageInfo.status !== 'loaded' || !activeDescriptor?.path) {
      setMetadataInfo({ status: 'idle', base: '', attempted: [] });
      setSelectedSequenceName('');
      return;
    }

    let cancelled = false;
    const bases = buildMetadataBases(imageInfo.url, activeDescriptor.path, activeDescriptor.sources);
    setMetadataInfo({ status: 'loading', base: '', attempted: bases });
    setSelectedSequenceName('');

    const loadMetadata = async () => {
      const errors: string[] = [];

      for (const base of bases) {
        try {
          const response = await fetch(`/api/sprite-sheets/metadata?base=${encodeURIComponent(base)}`);
          if (!response.ok) {
            errors.push(`${response.status} ${base}`);
            continue;
          }

          const payload = await response.json() as {
            base?: string;
            atlas?: unknown;
            timeline?: unknown;
            parts?: unknown;
          };
          const metadata = {
            atlas: payload.atlas,
            timeline: payload.timeline,
            parts: payload.parts,
          };

          if (!isUsableMetadata(metadata)) {
            errors.push(`Invalid metadata shape for ${base}`);
            continue;
          }

          if (cancelled) return;
          setMetadataInfo({
            status: 'loaded',
            base: payload.base || base,
            attempted: bases,
            metadata,
          });
          setSelectedSequenceName(chooseDefaultSequence(metadata, DEFAULT_METADATA_FRAME_MS)?.name || '');
          setViewMode('metadata');
          setCurrentFrame(0);
          directionRef.current = 1;
          return;
        } catch (loadError) {
          errors.push(loadError instanceof Error ? loadError.message : `Failed to load ${base}`);
        }
      }

      if (cancelled) return;
      setMetadataInfo({
        status: bases.length > 0 ? 'missing' : 'idle',
        base: '',
        attempted: bases,
        error: errors.slice(0, 3).join(' | '),
      });
      setViewMode('grid');
    };

    void loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [activeDescriptor, imageInfo.status, imageInfo.url]);

  const grid = useMemo(() => getGridMetrics(imageInfo, settings), [imageInfo, settings]);
  const metadataSequences = useMemo(() => {
    return metadataInfo.status === 'loaded' ? metadataInfo.metadata?.timeline.sequences || [] : [];
  }, [metadataInfo]);
  const selectedSequence = useMemo<TimelineSequence | null>(() => {
    if (!metadataSequences.length) return null;
    return metadataSequences.find((sequence) => sequence.name === selectedSequenceName) || metadataSequences[0];
  }, [metadataSequences, selectedSequenceName]);
  const metadataFrames = useMemo(() => {
    if (metadataInfo.status !== 'loaded' || !metadataInfo.metadata || !selectedSequence) return [];
    return buildMetadataFrames(metadataInfo.metadata, selectedSequence, metadataFrameMs);
  }, [metadataFrameMs, metadataInfo, selectedSequence]);
  const metadataSequenceFrameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (metadataInfo.status !== 'loaded' || !metadataInfo.metadata) return counts;

    for (const sequence of metadataInfo.metadata.timeline.sequences) {
      counts.set(sequence.name, getMetadataFrameCount(metadataInfo.metadata, sequence, metadataFrameMs));
    }

    return counts;
  }, [metadataFrameMs, metadataInfo]);
  const metadataUsable = metadataInfo.status === 'loaded' && metadataFrames.length > 0;
  const metadataAnimated = metadataFrames.length > 1;
  const activeMode: ViewMode = metadataUsable && viewMode === 'metadata' ? 'metadata' : 'grid';
  const displayStartFrame = activeMode === 'metadata' ? 0 : grid.startFrame;
  const displayEndFrame = activeMode === 'metadata' ? Math.max(0, metadataFrames.length - 1) : grid.endFrame;
  const visibleFrame = clamp(currentFrame, displayStartFrame, displayEndFrame);
  const metadataFrame = activeMode === 'metadata' ? metadataFrames[visibleFrame] : undefined;
  const frameCol = visibleFrame % grid.columns;
  const frameRow = Math.floor(visibleFrame / grid.columns);
  const unusedWidth = imageInfo.status === 'loaded'
    ? imageInfo.width - settings.offsetX - grid.columns * settings.frameWidth - Math.max(0, grid.columns - 1) * settings.gap
    : 0;
  const unusedHeight = imageInfo.status === 'loaded'
    ? imageInfo.height - settings.offsetY - grid.rows * settings.frameHeight - Math.max(0, grid.rows - 1) * settings.gap
    : 0;

  useEffect(() => {
    setCurrentFrame((frame) => clamp(frame, displayStartFrame, displayEndFrame));
  }, [displayEndFrame, displayStartFrame]);

  useEffect(() => {
    if (!playing || imageInfo.status !== 'loaded') return;

    const frameMs = activeMode === 'metadata'
      ? Math.max(1, metadataFrames[visibleFrame]?.delayMs || metadataFrameMs)
      : 1000 / clamp(settings.fps, 1, 60);
    const tick = (time: number) => {
      if (!lastTickRef.current) lastTickRef.current = time;
      if (time - lastTickRef.current >= frameMs) {
        setCurrentFrame((frame) => {
          if (settings.pingPong && displayEndFrame > displayStartFrame) {
            const next = frame + directionRef.current;
            if (next >= displayEndFrame) {
              directionRef.current = -1;
              return displayEndFrame;
            }
            if (next <= displayStartFrame) {
              directionRef.current = 1;
              return displayStartFrame;
            }
            return next;
          }
          return frame >= displayEndFrame ? displayStartFrame : frame + 1;
        });
        lastTickRef.current = time;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = 0;
    };
  }, [
    activeMode,
    displayEndFrame,
    displayStartFrame,
    imageInfo.status,
    metadataFrameMs,
    metadataFrames,
    playing,
    settings.fps,
    settings.pingPong,
    visibleFrame,
  ]);

  const updateSetting = useCallback(<K extends keyof SheetSettings>(key: K, value: SheetSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const setPresetCellSize = useCallback((size: number) => {
    setSettings((current) => {
      const columns = imageInfo.status === 'loaded' ? Math.max(1, Math.floor(imageInfo.width / size)) : 1;
      const rows = imageInfo.status === 'loaded' ? Math.max(1, Math.floor(imageInfo.height / size)) : 1;
      return {
        ...current,
        frameWidth: size,
        frameHeight: size,
        startFrame: 0,
        endFrame: Math.max(0, columns * rows - 1),
      };
    });
    setCurrentFrame(0);
  }, [imageInfo]);

  const fitGrid = useCallback((columns: number, rows: number) => {
    if (imageInfo.status !== 'loaded') return;
    const frameWidth = Math.max(1, Math.floor((imageInfo.width - settings.offsetX - Math.max(0, columns - 1) * settings.gap) / columns));
    const frameHeight = Math.max(1, Math.floor((imageInfo.height - settings.offsetY - Math.max(0, rows - 1) * settings.gap) / rows));
    setSettings((current) => ({
      ...current,
      frameWidth,
      frameHeight,
      startFrame: 0,
      endFrame: Math.max(0, columns * rows - 1),
    }));
    setCurrentFrame(0);
  }, [imageInfo, settings.gap, settings.offsetX, settings.offsetY]);

  const applyAutoGuess = useCallback(() => {
    if (imageInfo.status !== 'loaded') return;
    const guessed = guessSettings(imageInfo.width, imageInfo.height);
    setSettings((current) => ({
      ...current,
      ...guessed,
      gap: 0,
      offsetX: 0,
      offsetY: 0,
    }));
    setCurrentFrame(0);
  }, [imageInfo]);

  const activateAsset = useCallback((id: string) => {
    setActiveCustomPath('');
    setSelectedId(id);
    setPlaying(true);
  }, []);

  const loadCustomPath = useCallback(() => {
    const normalized = normalizeAssetPath(customPath);
    if (!normalized) return;
    setSelectedId('');
    setActiveCustomPath(normalized);
    setPlaying(true);
  }, [customPath]);

  const copyText = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  }, []);

  const exportGif = useCallback(async (action: GifExportAction) => {
    if (imageInfo.status !== 'loaded') return;

    setGifAction(action);
    setGifError(null);

    try {
      const image = await loadCanvasImage(imageInfo.url);
      const scale = clamp(settings.zoom, 0.25, 8);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Could not create GIF canvas');

      let width = 1;
      let height = 1;
      const frames: Array<{ imageData: ImageData; delayMs: number }> = [];

      if (activeMode === 'metadata' && metadataFrames.length > 0) {
        const indexes = getFrameIndexes(0, metadataFrames.length - 1, settings.pingPong);
        if (indexes.length > MAX_GIF_FRAMES) {
          throw new Error(`GIF export is limited to ${MAX_GIF_FRAMES} frames. Choose a shorter sequence or range.`);
        }

        width = Math.max(...indexes.map((index) => metadataFrameSize(metadataFrames[index].atlas, scale).width));
        height = Math.max(...indexes.map((index) => metadataFrameSize(metadataFrames[index].atlas, scale).height));
        canvas.width = width;
        canvas.height = height;

        for (const index of indexes) {
          const frame = metadataFrames[index];
          drawAtlasFrame(context, image, frame.atlas, scale, width, height, settings.background);
          frames.push({
            imageData: context.getImageData(0, 0, width, height),
            delayMs: frame.delayMs,
          });
        }
      } else {
        const indexes = getFrameIndexes(grid.startFrame, grid.endFrame, settings.pingPong);
        if (indexes.length > MAX_GIF_FRAMES) {
          throw new Error(`GIF export is limited to ${MAX_GIF_FRAMES} frames. Narrow the manual grid range.`);
        }

        width = Math.max(1, Math.ceil(settings.frameWidth * scale));
        height = Math.max(1, Math.ceil(settings.frameHeight * scale));
        canvas.width = width;
        canvas.height = height;

        for (const index of indexes) {
          drawGridFrame(context, image, settings, grid, index, scale, settings.background);
          frames.push({
            imageData: context.getImageData(0, 0, width, height),
            delayMs: 1000 / clamp(settings.fps, 1, 60),
          });
        }
      }

      if (frames.length === 0) throw new Error('No frames available to export');

      const blob = encodeGifFrames(frames, width, height);
      const blobUrl = URL.createObjectURL(blob);
      const baseName = activeDescriptor?.label || humanizePath(activeDescriptor?.path || activeCustomPath || imageInfo.url);
      const suffix = activeMode === 'metadata' && selectedSequence?.name
        ? selectedSequence.name
        : `${grid.startFrame}-${grid.endFrame}`;
      const filename = `${sanitizeFilename(`${baseName}-${suffix}`)}.gif`;

      if (action === 'download') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } else {
        const opened = window.open(blobUrl, '_blank');
        if (!opened) {
          URL.revokeObjectURL(blobUrl);
          throw new Error('The browser blocked the new tab. Use Download GIF instead.');
        }
        opened.opener = null;
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 300000);
      }
    } catch (exportError) {
      setGifError(exportError instanceof Error ? exportError.message : 'GIF export failed');
    } finally {
      setGifAction(null);
    }
  }, [
    activeCustomPath,
    activeDescriptor,
    activeMode,
    grid,
    imageInfo,
    metadataFrames,
    selectedSequence,
    settings,
  ]);

  const previewStyle = imageInfo.status === 'loaded' && activeMode === 'grid'
    ? getFrameStyle({
        url: imageInfo.url,
        imageWidth: imageInfo.width,
        imageHeight: imageInfo.height,
        frameWidth: settings.frameWidth,
        frameHeight: settings.frameHeight,
        frameIndex: visibleFrame,
        columns: grid.columns,
        gap: settings.gap,
        offsetX: settings.offsetX,
        offsetY: settings.offsetY,
        zoom: settings.zoom,
        background: settings.background,
      })
    : undefined;

  const frameWindow = useMemo(() => {
    const start = Math.max(displayStartFrame, Math.min(displayEndFrame, visibleFrame - 24));
    const end = Math.min(displayEndFrame, start + 71);
    const frames: number[] = [];
    for (let frame = start; frame <= end; frame += 1) frames.push(frame);
    return frames;
  }, [displayEndFrame, displayStartFrame, visibleFrame]);
  const gifExportFrameCount = useMemo(() => {
    if (activeMode === 'metadata') {
      if (metadataFrames.length === 0) return 0;
      return getFrameIndexes(0, metadataFrames.length - 1, settings.pingPong).length;
    }

    return getFrameIndexes(grid.startFrame, grid.endFrame, settings.pingPong).length;
  }, [activeMode, grid.endFrame, grid.startFrame, metadataFrames.length, settings.pingPong]);
  const gifExportDisabled = imageInfo.status !== 'loaded' || gifAction !== null || gifExportFrameCount === 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-6 lg:px-6">
        <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-cyan-500/10 text-cyan-700">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Animated Sprite Sheets</h1>
                <p className="text-sm text-muted-foreground">Load a sheet, use atlas metadata when it exists, or tune the grid by hand.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md">
              {assets.length} candidates
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {imageInfo.status === 'loaded' ? formatDimensions(imageInfo.width, imageInfo.height) : 'no image loaded'}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {metadataAnimated ? 'metadata animation' : metadataUsable ? 'metadata frame' : 'grid animation'}
            </Badge>
            <Button variant="outline" size="sm" onClick={loadAssets} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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

        <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="rounded-md border bg-card p-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="sprite-search">
                  Search datalist paths
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sprite-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="zegura, funnel, sprite_sheet..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Scope</label>
                <Select value={scope} onValueChange={(value) => setScope(value as ScopeFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 border-t pt-3">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="custom-sprite-path">
                  Direct asset path
                </label>
                <div className="flex gap-2">
                  <Input
                    id="custom-sprite-path"
                    value={customPath}
                    onChange={(event) => setCustomPath(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') loadCustomPath();
                    }}
                    placeholder="battle/boss/.../name"
                  />
                  <Button type="button" onClick={loadCustomPath} disabled={!customPath.trim()}>
                    Load
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="min-w-0">
                  <span>{filteredAssets.length} matches</span>
                  {filteredAssets.length > LIST_LIMIT && <span> - showing {LIST_LIMIT}</span>}
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-1 rounded-md border bg-background p-1">
                  <Button
                    type="button"
                    variant={candidateViewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setCandidateViewMode('grid')}
                  >
                    Grid
                  </Button>
                  <Button
                    type="button"
                    variant={candidateViewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setCandidateViewMode('list')}
                  >
                    List
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[650px] pr-2">
                <div className={cn('grid gap-2', candidateViewMode === 'grid' && !loading ? 'grid-cols-2' : '')}>
                  {loading && (
                    <div className="col-span-full flex h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading candidates
                    </div>
                  )}
                  {!loading && candidateViewMode === 'list' && filteredAssets.slice(0, LIST_LIMIT).map((asset) => (
                    <AssetRow key={asset.id} asset={asset} active={asset.id === selectedId} onSelect={activateAsset} />
                  ))}
                  {!loading && candidateViewMode === 'grid' && filteredAssets.slice(0, LIST_LIMIT).map((asset) => (
                    <AssetPreviewCard key={asset.id} asset={asset} active={asset.id === selectedId} onSelect={activateAsset} />
                  ))}
                  {!loading && filteredAssets.length === 0 && (
                    <div className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No matching paths found.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </aside>

          <div className="grid min-w-0 gap-4">
            <section className="grid gap-4 rounded-md border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0">
                <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{activeDescriptor?.label || 'No asset selected'}</h2>
                      {activeDescriptor?.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="rounded-md">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{activeDescriptor?.path || 'Select a candidate or paste an asset path.'}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!activeDescriptor?.path}
                      onClick={() => activeDescriptor && copyText(activeDescriptor.path, 'path')}
                    >
                      {copied === 'path' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Path
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!imageInfo.url}
                      onClick={() => imageInfo.url && copyText(imageInfo.url, 'url')}
                    >
                      {copied === 'url' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      URL
                    </Button>
                    {imageInfo.url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={imageInfo.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    'mt-4 flex min-h-[420px] items-center justify-center overflow-auto rounded-md border p-6',
                    getPreviewBackground(settings.background)
                  )}
                >
                  {imageInfo.status === 'loading' && (
                    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      Loading image candidates
                    </div>
                  )}
                  {imageInfo.status === 'error' && (
                    <div className="max-w-lg rounded-md border border-red-500/30 bg-background/90 p-4 text-sm">
                      <div className="flex items-center gap-2 font-medium text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        No image loaded
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        The datalist path may point to a prefab, Spine asset, or a packed Unity bundle instead of a plain PNG sheet.
                      </p>
                      <div className="mt-3 max-h-28 overflow-auto rounded-md bg-muted p-2 text-[11px]">
                        {imageInfo.attempted.map((url) => <p key={url} className="break-all">{url}</p>)}
                      </div>
                    </div>
                  )}
                  {imageInfo.status === 'idle' && (
                    <div className="text-center text-sm text-muted-foreground">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                      Choose a path to begin.
                    </div>
                  )}
                  {imageInfo.status === 'loaded' && activeMode === 'metadata' && metadataFrame && (
                    <div className="rounded-md border bg-background/60 p-3 shadow-sm">
                      <AtlasFrameCanvas imageUrl={imageInfo.url} frame={metadataFrame} zoom={settings.zoom} />
                    </div>
                  )}
                  {imageInfo.status === 'loaded' && activeMode === 'grid' && previewStyle && (
                    <div className="rounded-md border bg-background/60 p-3 shadow-sm">
                      <div style={previewStyle} />
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-3 rounded-md border bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setCurrentFrame(displayStartFrame)} disabled={imageInfo.status !== 'loaded'}>
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setCurrentFrame((frame) => clamp(frame - 1, displayStartFrame, displayEndFrame))} disabled={imageInfo.status !== 'loaded'}>
                        <StepBack className="h-4 w-4" />
                      </Button>
                      <Button onClick={() => setPlaying((value) => !value)} disabled={imageInfo.status !== 'loaded'}>
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {playing ? 'Pause' : 'Play'}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setCurrentFrame((frame) => clamp(frame + 1, displayStartFrame, displayEndFrame))} disabled={imageInfo.status !== 'loaded'}>
                        <StepForward className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setCurrentFrame(displayEndFrame)} disabled={imageInfo.status !== 'loaded'}>
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="hidden text-xs text-muted-foreground">
                      Frame {visibleFrame} · row {frameRow + 1}, col {frameCol + 1} · {grid.totalFrames} total
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activeMode === 'metadata' && metadataFrame
                        ? `Frame ${visibleFrame + 1} / ${metadataFrames.length} - source ${metadataFrame.sourceFrame} - ${metadataFrame.delayMs}ms`
                        : `Frame ${visibleFrame} - row ${frameRow + 1}, col ${frameCol + 1} - ${grid.totalFrames} total`}
                    </div>
                  </div>

                  <Slider
                    value={[visibleFrame]}
                    min={displayStartFrame}
                    max={displayEndFrame}
                    step={1}
                    disabled={imageInfo.status !== 'loaded' || displayEndFrame <= displayStartFrame}
                    onValueChange={(value) => setCurrentFrame(value[0] ?? displayStartFrame)}
                  />
                </div>
              </div>

              <div className="grid content-start gap-4">
                <div className="rounded-md border bg-background/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Atlas Metadata</h3>
                    </div>
                    <Badge variant="outline" className="rounded-md">
                      {metadataInfo.status}
                    </Badge>
                  </div>

                  {metadataInfo.status === 'loading' && (
                    <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking for atlas, timeline, and parts JSON
                    </div>
                  )}

                  {metadataInfo.status === 'loaded' && (
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-muted-foreground">Sequence</label>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {selectedSequence?.name || 'none'}
                          </span>
                        </div>
                        <div className="max-h-44 overflow-y-auto rounded-md border bg-background/60 p-2">
                          <div className="grid grid-cols-3 gap-1.5">
                            {metadataSequences.map((sequence) => {
                              const frameCount = metadataSequenceFrameCounts.get(sequence.name);
                              const selected = selectedSequence?.name === sequence.name;
                              return (
                                <Button
                                  key={sequence.name}
                                  type="button"
                                  variant={selected ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-8 min-w-0 justify-between gap-1 px-2 text-xs"
                                  title={`${sequence.name}${typeof frameCount === 'number' ? ` (${frameCount} frames)` : ''}`}
                                  onClick={() => {
                                    setSelectedSequenceName(sequence.name);
                                    setCurrentFrame(0);
                                    directionRef.current = 1;
                                  }}
                                >
                                  <span className="min-w-0 flex-1 truncate text-left">{sequence.name}</span>
                                  {typeof frameCount === 'number' && (
                                    <span
                                      className={cn(
                                        'shrink-0 rounded border px-1 text-[10px] leading-4',
                                        selected ? 'border-primary-foreground/40' : 'border-muted-foreground/30 text-muted-foreground'
                                      )}
                                    >
                                      {frameCount}
                                    </span>
                                  )}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <NumberField
                          label="Frame ms"
                          value={metadataFrameMs}
                          min={1}
                          max={1000}
                          onChange={(value) => setMetadataFrameMs(Math.round(value))}
                        />
                        <label className="grid gap-1 text-xs font-medium">
                          <span className="text-muted-foreground">Mode</span>
                          <div className="grid grid-cols-2 gap-1">
                            <Button
                              type="button"
                              variant={activeMode === 'metadata' ? 'default' : 'outline'}
                              size="sm"
                              disabled={!metadataUsable}
                              onClick={() => {
                                setViewMode('metadata');
                                setCurrentFrame(0);
                              }}
                            >
                              Meta
                            </Button>
                            <Button
                              type="button"
                              variant={activeMode === 'grid' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setViewMode('grid');
                                setCurrentFrame(grid.startFrame);
                              }}
                            >
                              Grid
                            </Button>
                          </div>
                        </label>
                      </div>

                      <dl className="grid grid-cols-[95px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">Sequences</dt>
                        <dd>{metadataSequences.length}</dd>
                        <dt className="text-muted-foreground">Frames</dt>
                        <dd>{metadataFrames.length}</dd>
                        <dt className="text-muted-foreground">Base</dt>
                        <dd className="break-all">{metadataInfo.base.replace(`${CDN_ROOT}/`, '')}</dd>
                      </dl>

                      {metadataUsable && !metadataAnimated && (
                        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
                          This sequence resolves to one visual frame. Pick another loop for motion.
                        </p>
                      )}
                    </div>
                  )}

                  {(metadataInfo.status === 'missing' || metadataInfo.status === 'error') && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      No atlas metadata found for this path. Manual grid controls are still available.
                    </div>
                  )}
                </div>

                <div className="rounded-md border bg-background/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Grid</h3>
                    <Button variant="outline" size="sm" onClick={applyAutoGuess} disabled={imageInfo.status !== 'loaded'}>
                      Auto
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Frame W" value={settings.frameWidth} min={1} max={imageInfo.width || 4096} onChange={(value) => updateSetting('frameWidth', Math.round(value))} />
                    <NumberField label="Frame H" value={settings.frameHeight} min={1} max={imageInfo.height || 4096} onChange={(value) => updateSetting('frameHeight', Math.round(value))} />
                    <NumberField label="Gap" value={settings.gap} min={0} max={512} onChange={(value) => updateSetting('gap', Math.round(value))} />
                    <NumberField label="Offset X" value={settings.offsetX} min={0} max={imageInfo.width || 4096} onChange={(value) => updateSetting('offsetX', Math.round(value))} />
                    <NumberField label="Offset Y" value={settings.offsetY} min={0} max={imageInfo.height || 4096} onChange={(value) => updateSetting('offsetY', Math.round(value))} />
                    <NumberField label="FPS" value={settings.fps} min={1} max={60} step={1} onChange={(value) => updateSetting('fps', Math.round(value))} />
                    <NumberField label="Start" value={settings.startFrame} min={0} max={Math.max(0, grid.totalFrames - 1)} onChange={(value) => updateSetting('startFrame', Math.round(value))} />
                    <NumberField label="End" value={settings.endFrame} min={0} max={Math.max(0, grid.totalFrames - 1)} onChange={(value) => updateSetting('endFrame', Math.round(value))} />
                  </div>

                  <div className="mt-4 grid gap-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Zoom</span>
                      <span>{settings.zoom.toFixed(1)}x</span>
                    </div>
                    <Slider
                      value={[settings.zoom]}
                      min={0.5}
                      max={6}
                      step={0.25}
                      onValueChange={(value) => updateSetting('zoom', value[0] ?? settings.zoom)}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[32, 48, 64, 96, 128, 256].map((size) => (
                      <Button key={size} variant="outline" size="sm" onClick={() => setPresetCellSize(size)}>
                        {size}px
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => fitGrid(4, 4)} disabled={imageInfo.status !== 'loaded'}>
                      Fit 4x4
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fitGrid(8, 8)} disabled={imageInfo.status !== 'loaded'}>
                      Fit 8x8
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border bg-background/70 p-3">
                  <h3 className="mb-3 text-sm font-semibold">Playback</h3>
                  <div className="grid gap-3">
                    <label className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                      <span>Ping-pong</span>
                      <input
                        type="checkbox"
                        checked={settings.pingPong}
                        onChange={(event) => updateSetting('pingPong', event.target.checked)}
                        className="h-4 w-4"
                      />
                    </label>
                    <div className="grid gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Background</label>
                      <Select value={settings.background} onValueChange={(value) => updateSetting('background', value as BackgroundMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checker">Checker</SelectItem>
                          <SelectItem value="transparent">Transparent</SelectItem>
                          <SelectItem value="black">Black</SelectItem>
                          <SelectItem value="white">White</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2 border-t pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground">GIF</h4>
                          <p className="text-[11px] text-muted-foreground">
                            Current {activeMode === 'metadata' ? 'sequence' : 'range'} - {gifExportFrameCount} frames
                          </p>
                        </div>
                        {gifAction && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={gifExportDisabled}
                          onClick={() => void exportGif('download')}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={gifExportDisabled}
                          onClick={() => void exportGif('open')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </Button>
                      </div>
                      {gifError && (
                        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700">
                          {gifError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-background/70 p-3 text-sm">
                  <h3 className="mb-2 font-semibold">Sheet</h3>
                  <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Image</dt>
                    <dd>{formatDimensions(imageInfo.width, imageInfo.height)}</dd>
                    <dt className="text-muted-foreground">Grid</dt>
                    <dd>{grid.columns} x {grid.rows}</dd>
                    <dt className="text-muted-foreground">Mode</dt>
                    <dd>{activeMode === 'metadata' ? 'metadata' : 'manual grid'}</dd>
                    <dt className="text-muted-foreground">Unused</dt>
                    <dd>{Math.max(0, unusedWidth)}px x {Math.max(0, unusedHeight)}px</dd>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="break-all">{activeDescriptor?.file || 'manual'}</dd>
                  </dl>
                  {imageInfo.status === 'loaded' && grid.totalFrames <= 1 && (
                    <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
                      Set a smaller frame size if this image contains multiple cells.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-md border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <ListVideo className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-semibold">Frame Strip</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeMode === 'metadata' ? 'Showing resolved atlas frames from the selected sequence.' : 'Showing frames near the current range.'}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-md">
                  {frameWindow.length} frames
                </Badge>
              </div>
              {imageInfo.status !== 'loaded' ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Frames appear after an image loads.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeMode === 'metadata'
                    ? frameWindow.map((frameIndex) => {
                        const frame = metadataFrames[frameIndex];
                        if (!frame) return null;
                        return (
                          <AtlasFrameThumb
                            key={`${frame.sourceFrame}-${frameIndex}`}
                            imageUrl={imageInfo.url}
                            frame={frame}
                            index={frameIndex}
                            active={visibleFrame === frameIndex}
                            onSelect={setCurrentFrame}
                          />
                        );
                      })
                    : frameWindow.map((frameIndex) => (
                        <FrameThumb
                          key={frameIndex}
                          imageInfo={imageInfo}
                          settings={settings}
                          grid={grid}
                          frameIndex={frameIndex}
                          active={visibleFrame === frameIndex}
                          onSelect={setCurrentFrame}
                        />
                      ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
