'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Info,
  Languages,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  Monitor,
  MoveHorizontal,
  MoveVertical,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  User,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

interface FaceData {
  ui?: { files: string[] };
  story?: { files: string[] };
}
interface FaceUIData { [faceName: string]: FaceData }
interface FullShotAttribute { [characterId: string]: { [variant: string]: number[] } }
interface CharacterData { [id: string]: string[] }
interface CharacterTextData { [id: string]: string[] }
interface TrimmedImageData { [assetKey: string]: string[] | number[] }
interface TrimRect { x: number; y: number; canvasWidth: number; canvasHeight: number }

type FaceTypeFilter = 'all' | 'playable' | 'npc';
type BackgroundMode = 'checkerboard' | 'white' | 'dark' | 'transparent';
type CopyStatus = 'idle' | 'copying' | 'done' | 'error';
type IsolateTarget = { face: string; expression: string; stem: string };

const OTHER_PART_EXPRESSION_STEMS = ['shame', 'sweat', 'unknown'];
const OTHER_PART_EXPRESSION_PREFIXES = ['hibi_', 'guardian'];
const DATA_FALLBACK_BASE = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const BACKGROUND_MODES: { value: BackgroundMode; label: string }[] = [
  { value: 'checkerboard', label: 'Checker' },
  { value: 'white', label: 'White' },
  { value: 'dark', label: 'Dark' },
  { value: 'transparent', label: 'None' },
];

const BG_STYLES: Record<BackgroundMode, React.CSSProperties> = {
  checkerboard: {
    backgroundImage: `linear-gradient(45deg,#aaa 25%,transparent 25%),linear-gradient(-45deg,#aaa 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#aaa 75%),linear-gradient(-45deg,transparent 75%,#aaa 75%)`,
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0,0 8px,8px -8px,-8px 0px',
    backgroundColor: '#e0e0e0',
  },
  white: { backgroundColor: '#ffffff' },
  dark: { backgroundColor: '#111827' },
  transparent: {},
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function SidebarPortrait({ face }: { face: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/50">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <Image
      src={`${CDN_ROOT}/wfjukebox/character/character_art/${face}/ui/square_0.png`}
      alt={face}
      fill
      className="object-cover"
      style={{ imageRendering: 'pixelated' }}
      unoptimized
      onError={() => setError(true)}
    />
  );
}

function ExpressionThumbnail({ face, stem }: { face: string; stem: string }) {
  const [error, setError] = useState(false);
  return (
    <div className="relative h-12 w-12 overflow-hidden rounded">
      {!error ? (
        <Image
          src={`${CDN_ROOT}/wfjukebox/character/character_art/${face}/ui/story/${stem}.png`}
          alt={stem}
          fill
          className="object-contain"
          style={{ imageRendering: 'pixelated' }}
          unoptimized
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function FaceBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Data state ──
  const [faces, setFaces] = useState<string[]>([]);
  const [faceUIData, setFaceUIData] = useState<FaceUIData>({});
  const [characterData, setCharacterData] = useState<CharacterData>({});
  const [characterTextJP, setCharacterTextJP] = useState<CharacterTextData>({});
  const [characterTextEN, setCharacterTextEN] = useState<CharacterTextData>({});
  const [fullShotAttributes, setFullShotAttributes] = useState<FullShotAttribute>({});
  const [loading, setLoading] = useState(true);
  const [trimmedImageData, setTrimmedImageData] = useState<TrimmedImageData>({});

  // ── UI state ──
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [faceTypeFilter, setFaceTypeFilter] = useState<FaceTypeFilter>('all');
  const [selectedBase, setSelectedBase] = useState<'0' | '1'>('0');
  const [selectedExpressions, setSelectedExpressions] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'compose' | 'browse'>('compose');
  const [selectedFile, setSelectedFile] = useState<{ type: 'ui' | 'story' | 'fullshot'; file: string; variant?: string } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [language, setLanguage] = useState<'jp' | 'en' | 'both'>('both');
  const [composeError, setComposeError] = useState<string | null>(null);

  // ── Expression adjustment state ──
  const [expressionScale, setExpressionScale] = useState(1);
  const [expressionOffsetX, setExpressionOffsetX] = useState(0);
  const [expressionOffsetY, setExpressionOffsetY] = useState(0);
  const [encodingCopied, setEncodingCopied] = useState(false);

  // ── Canvas/preview state ──
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('checkerboard');
  const [previewZoom, setPreviewZoom] = useState(1);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Sidebar state ──
  const [pinnedFaces, setPinnedFaces] = useState<Set<string>>(new Set());

  // ── Dialog state ──
  const [isolateTarget, setIsolateTarget] = useState<IsolateTarget | null>(null);
  const [showLayerInfo, setShowLayerInfo] = useState(false);

  // ── Refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const composeRenderIdRef = useRef(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const didRestoreFromUrl = useRef(false);

  // ── URL restore ──
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || faces.length === 0 || didRestoreFromUrl.current) return;
    didRestoreFromUrl.current = true;
    const faceParam = searchParams.get('face');
    if (faceParam && faces.includes(faceParam)) handleFaceSelect(faceParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, faces]);

  // ── Helpers ──
  const normalizeAssetStem = useCallback((file: string) => file.replace(/\.(atf|png)$/i, '').toLowerCase(), []);
  const toPngFileName = useCallback((file: string) => `${normalizeAssetStem(file)}.png`, [normalizeAssetStem]);

  const isOtherPartExpression = useCallback((expression: string) => {
    const stem = normalizeAssetStem(expression);
    if (OTHER_PART_EXPRESSION_STEMS.includes(stem)) return true;
    if (selectedFace === 'zegura' && stem === 'cheek') return true;
    return OTHER_PART_EXPRESSION_PREFIXES.some((prefix) => stem.startsWith(prefix));
  }, [normalizeAssetStem, selectedFace]);

  const getStoryImageUrlForFace = useCallback((faceName: string, file: string) =>
    `${CDN_ROOT}/wfjukebox/character/character_art/${faceName}/ui/story/${toPngFileName(file)}`,
  [toPngFileName]);

  const toProxyImageUrl = useCallback((url: string) => `/api/assets/image?url=${encodeURIComponent(url)}`, []);

  const getTrimRect = useCallback((faceName: string, file: string): TrimRect | null => {
    const key = `character/${faceName}/ui/story/${normalizeAssetStem(file)}`;
    const raw = trimmedImageData[key];
    if (!Array.isArray(raw) || raw.length < 4) return null;
    const [x, y, canvasWidth, canvasHeight] = [Number(raw[0]), Number(raw[1]), Number(raw[2]), Number(raw[3])];
    if ([x, y, canvasWidth, canvasHeight].some(Number.isNaN)) return null;
    return { x, y, canvasWidth, canvasHeight };
  }, [normalizeAssetStem, trimmedImageData]);

  const getCharacterId = useCallback((faceName: string): string | null => {
    for (const [id, data] of Object.entries(characterData)) {
      if (data[0] === faceName) return id;
    }
    return null;
  }, [characterData]);

  const getCharacterName = useCallback((faceName: string): string => {
    const charId = getCharacterId(faceName);
    if (!charId) return faceName;
    const jpName = characterTextJP[charId]?.[0] || faceName;
    const enName = characterTextEN[charId]?.[0] || '';
    if (language === 'jp') return jpName;
    if (language === 'en') return enName || jpName;
    return enName ? `${enName} / ${jpName}` : jpName;
  }, [characterTextEN, characterTextJP, getCharacterId, language]);

  // ── Data loading ──
  const loadData = async () => {
    try {
      const fetchJson = async <T,>(urls: string[]): Promise<T> => {
        for (const url of urls) {
          try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) continue;
            return (await r.json()) as T;
          } catch { continue; }
        }
        throw new Error(`All sources failed: ${urls.join(', ')}`);
      };

      const [facesData, faceUIDataRes, characterDataRes, fullShotData, charTextJP, charTextEN, trimData] = await Promise.all([
        fetchJson<{ faces: string[] }>(['/data/faces.json', `${DATA_FALLBACK_BASE}/faces.json`]),
        fetchJson<FaceUIData>(['/data/face-ui.json', `${DATA_FALLBACK_BASE}/face-ui.json`]),
        fetchJson<CharacterData>(['/data/character.json', `${DATA_FALLBACK_BASE}/character.json`]),
        fetchJson<FullShotAttribute>(['/data/full_shot_image_attribute.json', `${DATA_FALLBACK_BASE}/full_shot_image_attribute.json`]),
        fetch('/api/character-text?lang=jp'),
        fetch('/api/character-text?lang=en'),
        fetchJson<TrimmedImageData>([
          '/data/datalist/generated/trimmed_image.json',
          '/data/datalist_en/generated/trimmed_image.json',
          `${DATA_FALLBACK_BASE}/datalist/generated/trimmed_image.json`,
          `${DATA_FALLBACK_BASE}/datalist_en/generated/trimmed_image.json`,
        ]).catch(() => ({} as TrimmedImageData)),
      ]);

      const charTextJPData = charTextJP.ok ? await charTextJP.json() : {};
      const charTextENData = charTextEN.ok ? await charTextEN.json() : {};

      setFaces(Array.isArray(facesData.faces) ? facesData.faces : []);
      setFaceUIData(typeof faceUIDataRes === 'object' ? faceUIDataRes : {});
      setCharacterData(typeof characterDataRes === 'object' ? characterDataRes : {});
      setFullShotAttributes(typeof fullShotData === 'object' ? fullShotData : {});
      setCharacterTextJP(charTextJPData?.data ?? {});
      setCharacterTextEN(charTextENData?.data ?? {});
      setTrimmedImageData(typeof trimData === 'object' ? trimData : {});
    } catch (error) {
      console.error('Error loading face data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived / memos ──
  const faceTypeByName = useMemo(() => {
    const map = new Map<string, Exclude<FaceTypeFilter, 'all'>>();
    for (const face of faces) {
      const uiFiles = faceUIData[face]?.ui?.files;
      const hasBattleIcon = Array.isArray(uiFiles) && uiFiles.some((f) => normalizeAssetStem(f) === 'battle_member_status_0');
      map.set(face, hasBattleIcon ? 'playable' : 'npc');
    }
    return map;
  }, [faceUIData, faces, normalizeAssetStem]);

  const faceTypeCounts = useMemo(() => {
    let playable = 0; let npc = 0;
    for (const face of faces) {
      if (faceTypeByName.get(face) === 'playable') playable++; else npc++;
    }
    return { all: faces.length, playable, npc };
  }, [faceTypeByName, faces]);

  const filteredFaces = useMemo(() => {
    if (!Array.isArray(faces)) return [];
    const q = searchTerm.toLowerCase();
    const filtered = faces.filter((face) => {
      if (q && !face.toLowerCase().includes(q)) return false;
      if (faceTypeFilter === 'all') return true;
      return faceTypeByName.get(face) === faceTypeFilter;
    });
    return [...filtered].sort((a, b) => {
      const pa = pinnedFaces.has(a) ? 0 : 1;
      const pb = pinnedFaces.has(b) ? 0 : 1;
      return pa - pb;
    });
  }, [faceTypeByName, faceTypeFilter, faces, searchTerm, pinnedFaces]);

  const currentFaceData = selectedFace ? faceUIData[selectedFace] : null;
  const selectedExpressionList = useMemo(() => Array.from(selectedExpressions), [selectedExpressions]);

  const availableBaseFiles = useMemo(() => {
    if (!currentFaceData?.story?.files) return [];
    return currentFaceData.story.files.filter((f) => normalizeAssetStem(f).startsWith('base'));
  }, [currentFaceData, normalizeAssetStem]);

  const resolvedBaseFile = useMemo(() => {
    if (!availableBaseFiles.length) return null;
    const map = new Map(availableBaseFiles.map((f) => [normalizeAssetStem(f), f]));
    const preferred = selectedBase === '1'
      ? ['base_1', 'base_b', 'base_1_right', 'base_b_right', 'base']
      : ['base_0', 'base', 'base_0_right'];
    for (const stem of preferred) { const m = map.get(stem); if (m) return m; }
    return availableBaseFiles.find((f) => !normalizeAssetStem(f).includes('_right')) ?? availableBaseFiles[0];
  }, [availableBaseFiles, normalizeAssetStem, selectedBase]);

  const composeCanvasSize = useMemo(() => {
    if (selectedFace && resolvedBaseFile) {
      const r = getTrimRect(selectedFace, resolvedBaseFile);
      if (r) return { width: r.canvasWidth, height: r.canvasHeight };
    }
    if (selectedFace) {
      for (const exp of selectedExpressionList) {
        const r = getTrimRect(selectedFace, exp);
        if (r) return { width: r.canvasWidth, height: r.canvasHeight };
      }
    }
    return { width: 512, height: 512 };
  }, [getTrimRect, resolvedBaseFile, selectedExpressionList, selectedFace]);

  const orderedBaseCandidates = useMemo(() =>
    resolvedBaseFile
      ? [resolvedBaseFile, ...availableBaseFiles.filter((f) => f !== resolvedBaseFile)]
      : availableBaseFiles,
  [availableBaseFiles, resolvedBaseFile]);

  const availableExpressions = useMemo(() => {
    if (!selectedFace || !currentFaceData?.story?.files) return [];
    return currentFaceData.story.files.filter((f) => !normalizeAssetStem(f).startsWith('base'));
  }, [currentFaceData, normalizeAssetStem, selectedFace]);

  const availableFullShotVariants = useMemo(() => {
    if (!selectedFace) return [];
    const charId = getCharacterId(selectedFace);
    if (!charId || !fullShotAttributes[charId]) return [];
    return Object.keys(fullShotAttributes[charId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFace, fullShotAttributes]);

  const { mainExps, otherExps } = useMemo(() => {
    const main: string[] = []; const oth: string[] = [];
    availableExpressions.forEach((exp) => (isOtherPartExpression(exp) ? oth : main).push(exp));
    return { mainExps: main, otherExps: oth };
  }, [availableExpressions, isOtherPartExpression]);

  // ── Face selection ──
  const handleFaceSelect = useCallback((face: string) => {
    setSelectedFace(face);
    setSelectedFile(null);
    setImageError(false);
    setComposeError(null);
    setSelectedExpressions(new Set());
    setSelectedBase('0');
    setViewMode('compose');
    setPreviewZoom(1);
    setFlipHorizontal(false);
    router.replace(`?face=${encodeURIComponent(face)}`, { scroll: false });
  }, [router]);

  const togglePin = useCallback((face: string) => {
    setPinnedFaces((prev) => {
      const next = new Set(prev);
      if (next.has(face)) next.delete(face); else next.add(face);
      return next;
    });
  }, []);

  // ── Expression controls ──
  const toggleExpression = useCallback((expression: string) => {
    setSelectedExpressions((prev) => {
      const next = new Set(prev);
      if (!isOtherPartExpression(expression)) {
        availableExpressions.forEach((exp) => { if (!isOtherPartExpression(exp)) next.delete(exp); });
        if (prev.has(expression)) return next;
        next.add(expression);
      } else {
        if (next.has(expression)) next.delete(expression); else next.add(expression);
      }
      return next;
    });
  }, [availableExpressions, isOtherPartExpression]);

  const clearExpressions = useCallback(() => setSelectedExpressions(new Set()), []);

  const resetAdjustments = useCallback(() => {
    setExpressionScale(1); setExpressionOffsetX(0); setExpressionOffsetY(0);
  }, []);

  const copyEncoding = useCallback(() => {
    navigator.clipboard.writeText(`scale: ${expressionScale}, offsetX: ${expressionOffsetX}, offsetY: ${expressionOffsetY}`);
    setEncodingCopied(true);
    setTimeout(() => setEncodingCopied(false), 2000);
  }, [expressionOffsetX, expressionOffsetY, expressionScale]);

  // ── Canvas rendering ──
  const loadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const cached = imageCacheRef.current.get(url);
      if (cached?.complete && cached.naturalWidth > 0) { resolve(cached); return; }
      const img = cached ?? new window.Image();
      const cleanup = () => { img.removeEventListener('load', onLoad); img.removeEventListener('error', onError); };
      const onLoad = () => { cleanup(); resolve(img); };
      const onError = () => { cleanup(); imageCacheRef.current.delete(url); reject(new Error(`Failed: ${url}`)); };
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      if (!cached) { imageCacheRef.current.set(url, img); img.src = url; }
      else if (img.complete && img.naturalWidth > 0) { cleanup(); resolve(img); }
    });
  }, []);

  const getStoryImageUrlCandidates = useCallback((faceName: string, file: string) => {
    const png = toPngFileName(file);
    const original = file.toLowerCase().endsWith('.png') ? file : png;
    const ef = encodeURIComponent(faceName);
    const ep = encodeURIComponent(png);
    const eo = encodeURIComponent(original);
    const urls = [
      `${CDN_ROOT}/wfjukebox/character/character_art/${faceName}/ui/story/${png}`,
      `${CDN_ROOT}/wfjukebox/character/character_art/${ef}/ui/story/${ep}`,
      ...(eo !== ep ? [`${CDN_ROOT}/wfjukebox/character/character_art/${ef}/ui/story/${eo}`] : []),
    ];
    return Array.from(new Set(urls.map(toProxyImageUrl)));
  }, [toPngFileName, toProxyImageUrl]);

  const loadImageWithFallback = useCallback(async (urls: string[]) => {
    for (const url of urls) {
      try { return { image: await loadImage(url), url }; } catch { continue; }
    }
    return { image: null, url: null };
  }, [loadImage]);

  const drawStoryLayer = useCallback(async (
    ctx: CanvasRenderingContext2D,
    faceName: string,
    file: string,
    options?: { offsetX?: number; offsetY?: number; scale?: number }
  ) => {
    const { image } = await loadImageWithFallback(getStoryImageUrlCandidates(faceName, file));
    if (!image) return false;
    const trimRect = getTrimRect(faceName, file);
    const ox = options?.offsetX ?? 0;
    const oy = options?.offsetY ?? 0;
    const scale = options?.scale ?? 1;
    if (trimRect) {
      ctx.drawImage(image, trimRect.x + ox, trimRect.y + oy, image.naturalWidth * scale, image.naturalHeight * scale);
    } else {
      ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale); ctx.drawImage(image, 0, 0, 512, 512); ctx.restore();
    }
    return true;
  }, [getStoryImageUrlCandidates, getTrimRect, loadImageWithFallback]);

  const renderCompositeToCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<boolean> => {
    if (!selectedFace || !orderedBaseCandidates.length) return false;
    canvas.width = composeCanvasSize.width;
    canvas.height = composeCanvasSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let baseRendered = false;
    for (const f of orderedBaseCandidates) { if (await drawStoryLayer(ctx, selectedFace, f)) { baseRendered = true; break; } }
    if (!baseRendered) return false;
    for (const exp of selectedExpressionList) {
      await drawStoryLayer(ctx, selectedFace, exp, { offsetX: expressionOffsetX, offsetY: expressionOffsetY, scale: expressionScale });
    }
    return true;
  }, [composeCanvasSize, drawStoryLayer, expressionOffsetX, expressionOffsetY, expressionScale, orderedBaseCandidates, selectedExpressionList, selectedFace]);

  useEffect(() => {
    if (viewMode !== 'compose' || !previewCanvasRef.current) return;
    if (!selectedFace || !resolvedBaseFile) { setComposeError('No base image was found for this face.'); return; }
    const id = ++composeRenderIdRef.current;
    let disposed = false;
    setComposeError(null);
    (async () => {
      const ok = await renderCompositeToCanvas(previewCanvasRef.current!);
      if (disposed || id !== composeRenderIdRef.current) return;
      if (!ok) setComposeError('Failed to render composite preview.');
    })();
    return () => { disposed = true; };
  }, [expressionOffsetX, expressionOffsetY, expressionScale, renderCompositeToCanvas, resolvedBaseFile, selectedExpressionList, selectedFace, viewMode]);

  // ── Download / copy ──
  const downloadComposite = useCallback(async () => {
    if (!selectedFace || !resolvedBaseFile || !canvasRef.current) return;
    setIsDownloading(true);
    try {
      if (!await renderCompositeToCanvas(canvasRef.current)) return;
      const link = document.createElement('a');
      link.download = `${selectedFace}_composite.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error(e);
      setComposeError('Download blocked by cross-origin policy.');
    } finally { setIsDownloading(false); }
  }, [renderCompositeToCanvas, resolvedBaseFile, selectedFace]);

  const downloadWithBackground = useCallback(async () => {
    if (!selectedFace || !resolvedBaseFile || !canvasRef.current) return;
    setIsDownloading(true);
    try {
      if (!await renderCompositeToCanvas(canvasRef.current)) return;
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const ctx = tmp.getContext('2d')!;
      if (backgroundMode === 'white') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      } else if (backgroundMode === 'dark') {
        ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, w, h);
      } else if (backgroundMode === 'checkerboard') {
        const sz = 16;
        for (let y = 0; y < h; y += sz) {
          for (let x = 0; x < w; x += sz) {
            ctx.fillStyle = (Math.floor(x / sz) + Math.floor(y / sz)) % 2 === 0 ? '#e0e0e0' : '#aaaaaa';
            ctx.fillRect(x, y, sz, sz);
          }
        }
      }
      ctx.drawImage(canvasRef.current, 0, 0);
      const link = document.createElement('a');
      link.download = `${selectedFace}_composite_flat.png`;
      link.href = tmp.toDataURL('image/png');
      link.click();
    } catch (e) { console.error(e); }
    finally { setIsDownloading(false); }
  }, [backgroundMode, renderCompositeToCanvas, resolvedBaseFile, selectedFace]);

  const copyCanvasToClipboard = useCallback(async () => {
    if (!selectedFace || !resolvedBaseFile || !canvasRef.current) return;
    setCopyStatus('copying');
    try {
      if (!await renderCompositeToCanvas(canvasRef.current)) { setCopyStatus('error'); setTimeout(() => setCopyStatus('idle'), 2000); return; }
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) { setCopyStatus('error'); setTimeout(() => setCopyStatus('idle'), 2000); return; }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopyStatus('done');
        } catch { setCopyStatus('error'); }
        setTimeout(() => setCopyStatus('idle'), 2000);
      }, 'image/png');
    } catch { setCopyStatus('error'); setTimeout(() => setCopyStatus('idle'), 2000); }
  }, [renderCompositeToCanvas, resolvedBaseFile, selectedFace]);

  const fitToView = useCallback(() => {
    if (!canvasContainerRef.current) { setPreviewZoom(1); return; }
    const { clientWidth, clientHeight } = canvasContainerRef.current;
    const zoom = Math.min((clientWidth - 48) / composeCanvasSize.width, (clientHeight - 48) / composeCanvasSize.height, 2);
    setPreviewZoom(Math.max(0.25, Math.round(zoom * 100) / 100));
  }, [composeCanvasSize]);

  // ── Browse helpers ──
  const getImageUrl = useCallback((type: 'ui' | 'story' | 'fullshot', file: string, variant?: string) => {
    if (!selectedFace) return '';
    if (type === 'fullshot' && variant) return `${CDN_ROOT}/wfjukebox/character/character_art/${selectedFace}/ui/full_shot_1440_1920_${variant}.png`;
    if (type === 'story') return getStoryImageUrlForFace(selectedFace, file);
    return `${CDN_ROOT}/wfjukebox/character/character_art/${selectedFace}/ui/${toPngFileName(file)}`;
  }, [getStoryImageUrlForFace, selectedFace, toPngFileName]);

  const getFullShotPositioning = useCallback((faceName: string, variant: string) => {
    const charId = getCharacterId(faceName);
    if (!charId || !fullShotAttributes[charId]?.[variant]) return null;
    const [baseWidth, baseHeight, , xOffset, yOffset] = fullShotAttributes[charId][variant];
    return { baseWidth, baseHeight, xOffset, yOffset };
  }, [fullShotAttributes, getCharacterId]);

  const downloadImage = useCallback(() => {
    if (!selectedFile || !selectedFace) return;
    const url = getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.variant
      ? `${selectedFace}_fullshot_${selectedFile.variant}.png`
      : `${selectedFace}_${selectedFile.type}_${selectedFile.file}`;
    link.click();
  }, [getImageUrl, selectedFace, selectedFile]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-80">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading Face Builder</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border bg-card">
        <div className="border-b border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base font-bold flex-1">Face Builder</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Language">
                  <Languages className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('jp')}><span className={language === 'jp' ? 'font-bold' : ''}>🇯🇵 Japanese</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('en')}><span className={language === 'en' ? 'font-bold' : ''}>🇬🇧 English</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('both')}><span className={language === 'both' ? 'font-bold' : ''}>🌐 Both</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="text" placeholder="Search faces..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          <div className="flex gap-1">
            {(['all', 'playable', 'npc'] as FaceTypeFilter[]).map((f) => (
              <Button key={f} type="button" size="sm" variant={faceTypeFilter === f ? 'default' : 'outline'} className="h-6 px-2 text-[10px] flex-1" onClick={() => setFaceTypeFilter(f)}>
                {f === 'all' ? `All (${faceTypeCounts.all})` : f === 'playable' ? `Play (${faceTypeCounts.playable})` : `NPC (${faceTypeCounts.npc})`}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{filteredFaces.length} face{filteredFaces.length !== 1 ? 's' : ''}{pinnedFaces.size > 0 ? ` · ${pinnedFaces.size} pinned` : ''}</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filteredFaces.map((face) => (
              <ContextMenu key={face}>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleFaceSelect(face)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      selectedFace === face
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground text-foreground'
                    )}
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted">
                      <SidebarPortrait face={face} />
                    </div>
                    <span className="flex-1 truncate leading-tight">{getCharacterName(face)}</span>
                    {pinnedFaces.has(face) && <Pin className="h-3 w-3 shrink-0 opacity-60" />}
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuLabel className="truncate">{getCharacterName(face)}</ContextMenuLabel>
                  <ContextMenuLabel className="font-mono text-[10px] text-muted-foreground/70 -mt-1">{face}</ContextMenuLabel>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleFaceSelect(face)}>
                    <User className="h-4 w-4" /> Select face
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => togglePin(face)}>
                    {pinnedFaces.has(face) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    {pinnedFaces.has(face) ? 'Unpin' : 'Pin to top'}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => navigator.clipboard.writeText(face)}>
                    <Copy className="h-4 w-4" /> Copy face code
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => {
                    const url = `${window.location.origin}/facebuilder?face=${encodeURIComponent(face)}`;
                    navigator.clipboard.writeText(url);
                  }}>
                    <Link2 className="h-4 w-4" /> Copy shareable link
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => window.open(`/characters/${encodeURIComponent(face)}`, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-4 w-4" /> Open character page
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => window.open(`/facebuilder?face=${encodeURIComponent(face)}`, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-4 w-4" /> Open in new tab
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!selectedFace ? (
          <div className="flex h-full items-center justify-center p-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Welcome to Face Builder</CardTitle>
                <CardDescription>
                  Select a character from the sidebar to compose faces or browse assets.
                  Right-click characters, expressions, and the canvas for extra options.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Mode bar */}
            <div className="border-b border-border px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
              <Button variant={viewMode === 'compose' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('compose')}>
                <Layers className="mr-1.5 h-3.5 w-3.5" /> Compose
              </Button>
              <Button variant={viewMode === 'browse' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('browse')}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Browse Files
              </Button>
              <div className="flex-1" />
              <span className="text-sm font-semibold text-muted-foreground">{getCharacterName(selectedFace)}</span>
              <Badge variant="outline" className="font-mono text-[10px]">{selectedFace}</Badge>
              <Link href={`/characters/${encodeURIComponent(selectedFace)}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Character Page
                </Button>
              </Link>
            </div>

            {/* ── Compose mode ── */}
            {viewMode === 'compose' && (
              <div className="flex flex-1 min-h-0">
                {/* Left panel */}
                <div className="w-64 shrink-0 flex flex-col border-r border-border overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-3">

                      {/* Base selection */}
                      <Card>
                        <CardHeader className="pb-2 pt-3 px-3">
                          <CardTitle className="text-xs">Base Template</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1.5">
                          {(['0', '1'] as const).map((base) => (
                            <ContextMenu key={base}>
                              <ContextMenuTrigger asChild>
                                <Button
                                  variant={selectedBase === base ? 'default' : 'outline'}
                                  size="sm" className="w-full h-7 text-xs"
                                  onClick={() => setSelectedBase(base)}
                                >
                                  Base {base} {base === '0' ? '(Blank Face)' : '(Alternate)'}
                                </Button>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuLabel>Base {base}</ContextMenuLabel>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => setSelectedBase(base)}>
                                  Select base {base}
                                </ContextMenuItem>
                                {selectedBase === base && resolvedBaseFile && selectedFace && (
                                  <>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onClick={() => window.open(getStoryImageUrlForFace(selectedFace, resolvedBaseFile), '_blank', 'noopener,noreferrer')}>
                                      <ExternalLink className="h-4 w-4" /> Open source image
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(getStoryImageUrlForFace(selectedFace, resolvedBaseFile))}>
                                      <Link2 className="h-4 w-4" /> Copy image URL
                                    </ContextMenuItem>
                                  </>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                          {resolvedBaseFile && (
                            <p className="text-[10px] text-muted-foreground font-mono truncate pt-0.5">{resolvedBaseFile}</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Expression adjustments */}
                      {selectedExpressions.size > 0 && (
                        <Card>
                          <CardHeader className="pb-2 pt-3 px-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-xs">Expression Adjustment</CardTitle>
                              <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={resetAdjustments} title="Reset">
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={copyEncoding}>
                                  <Copy className="h-3 w-3 mr-1" />{encodingCopied ? 'Copied!' : 'Copy'}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 pb-3 space-y-2.5">
                            {[
                              { label: 'Scale', icon: <Maximize2 className="h-3 w-3" />, min: 0.1, max: 3, step: 0.01, value: expressionScale, setter: setExpressionScale, display: expressionScale.toFixed(2) },
                              { label: 'Position X', icon: <MoveHorizontal className="h-3 w-3" />, min: -400, max: 400, step: 1, value: expressionOffsetX, setter: setExpressionOffsetX, display: `${expressionOffsetX}px` },
                              { label: 'Position Y', icon: <MoveVertical className="h-3 w-3" />, min: -400, max: 400, step: 1, value: expressionOffsetY, setter: setExpressionOffsetY, display: `${expressionOffsetY}px` },
                            ].map(({ label, icon, min, max, step, value, setter, display }) => (
                              <div key={label}>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-medium flex items-center gap-1 text-muted-foreground">{icon}{label}</label>
                                  <span className="text-[10px] text-muted-foreground">{display}</span>
                                </div>
                                <input type="range" min={min} max={max} step={step} value={value}
                                  onChange={(e) => setter(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
                                  className="w-full h-1.5" />
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {/* Expression picker */}
                      {availableExpressions.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2 pt-3 px-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-xs">Expressions</CardTitle>
                              <div className="flex items-center gap-1.5">
                                {selectedExpressions.size > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{selectedExpressions.size}</Badge>
                                )}
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={clearExpressions} disabled={selectedExpressions.size === 0}>
                                  Clear
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 pb-3 space-y-3">
                            {[
                              { label: 'Main', exps: mainExps },
                              { label: 'Add-ons', exps: otherExps },
                            ].map(({ label, exps }) => exps.length > 0 && (
                              <div key={label}>
                                <p className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {exps.map((expression) => {
                                    const stem = normalizeAssetStem(expression);
                                    const isSelected = selectedExpressions.has(expression);
                                    return (
                                      <ContextMenu key={expression}>
                                        <ContextMenuTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={() => toggleExpression(expression)}
                                            title={stem}
                                            className={cn(
                                              'flex flex-col items-center gap-0.5 rounded-lg border p-1 text-center transition-all',
                                              isSelected
                                                ? 'border-primary bg-primary/15 ring-1 ring-primary'
                                                : 'border-border/50 bg-muted/20 hover:bg-muted hover:border-border'
                                            )}
                                          >
                                            <ExpressionThumbnail face={selectedFace} stem={stem} />
                                            <span className="text-[9px] leading-tight truncate w-full text-center">{stem}</span>
                                            {isSelected && <Check className="h-2.5 w-2.5 text-primary shrink-0" />}
                                          </button>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="w-52">
                                          <ContextMenuLabel className="font-mono">{stem}</ContextMenuLabel>
                                          <ContextMenuSeparator />
                                          <ContextMenuItem onClick={() => setIsolateTarget({ face: selectedFace, expression, stem })}>
                                            <Eye className="h-4 w-4" /> Isolate layer
                                          </ContextMenuItem>
                                          {!isOtherPartExpression(expression) && (
                                            <ContextMenuItem onClick={() => setSelectedExpressions(new Set([expression]))}>
                                              <Check className="h-4 w-4" /> Set as only expression
                                            </ContextMenuItem>
                                          )}
                                          <ContextMenuSeparator />
                                          <ContextMenuItem onClick={() => navigator.clipboard.writeText(getStoryImageUrlForFace(selectedFace, expression))}>
                                            <Link2 className="h-4 w-4" /> Copy image URL
                                          </ContextMenuItem>
                                          <ContextMenuItem onClick={() => window.open(getStoryImageUrlForFace(selectedFace, expression), '_blank', 'noopener,noreferrer')}>
                                            <ExternalLink className="h-4 w-4" /> Open source image
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Canvas panel */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                  {/* Canvas toolbar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0 flex-wrap">
                    <div className="flex items-center gap-1">
                      {BACKGROUND_MODES.map(({ value, label }) => (
                        <Button key={value} variant={backgroundMode === value ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setBackgroundMode(value)}>{label}</Button>
                      ))}
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))} disabled={previewZoom <= 0.25}><ZoomOut className="h-3 w-3" /></Button>
                      <span className="text-[11px] text-muted-foreground w-10 text-center font-mono">{Math.round(previewZoom * 100)}%</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom((z) => Math.min(4, parseFloat((z + 0.25).toFixed(2))))} disabled={previewZoom >= 4}><ZoomIn className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setPreviewZoom(1)} disabled={previewZoom === 1}>1×</Button>
                    </div>
                    <div className="flex-1" />
                    {!composeError && <span className="text-[10px] text-muted-foreground font-mono">{composeCanvasSize.width}×{composeCanvasSize.height}</span>}
                    {flipHorizontal && <Badge variant="secondary" className="text-[10px] h-5">Flipped</Badge>}
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={copyCanvasToClipboard} disabled={copyStatus === 'copying' || !resolvedBaseFile}>
                      {copyStatus === 'copying' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : copyStatus === 'done' ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copyStatus === 'done' ? 'Copied!' : copyStatus === 'error' ? 'Failed' : 'Copy'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={downloadComposite} disabled={isDownloading || !resolvedBaseFile}>
                      {isDownloading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                      Download
                    </Button>
                  </div>

                  {/* Canvas with context menu */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div ref={canvasContainerRef} className="flex-1 overflow-auto min-h-0 p-6 flex items-center justify-center">
                        {composeError ? (
                          <div className="text-center text-muted-foreground pointer-events-none">
                            <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                            <p className="text-sm">{composeError}</p>
                          </div>
                        ) : (
                          <canvas
                            ref={previewCanvasRef}
                            width={composeCanvasSize.width}
                            height={composeCanvasSize.height}
                            className="rounded-md border border-border shadow-sm shrink-0"
                            style={{
                              imageRendering: 'pixelated',
                              width: `${composeCanvasSize.width * previewZoom}px`,
                              height: `${composeCanvasSize.height * previewZoom}px`,
                              transform: flipHorizontal ? 'scaleX(-1)' : undefined,
                              ...BG_STYLES[backgroundMode],
                            }}
                          />
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuLabel>Canvas</ContextMenuLabel>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={copyCanvasToClipboard} disabled={!resolvedBaseFile}>
                        <Copy className="h-4 w-4" /> Copy as PNG
                      </ContextMenuItem>
                      <ContextMenuItem onClick={downloadComposite} disabled={!resolvedBaseFile}>
                        <Download className="h-4 w-4" /> Download (transparent)
                      </ContextMenuItem>
                      <ContextMenuItem onClick={downloadWithBackground} disabled={!resolvedBaseFile || backgroundMode === 'transparent'}>
                        <Download className="h-4 w-4" /> Download with background
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => setFlipHorizontal((f) => !f)}>
                        <ArrowLeftRight className="h-4 w-4" /> {flipHorizontal ? 'Unflip horizontal' : 'Flip horizontal'}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={fitToView}>
                        <Maximize2 className="h-4 w-4" /> Fit to view
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setPreviewZoom(1)} disabled={previewZoom === 1}>
                        Reset zoom (1×)
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={clearExpressions} disabled={selectedExpressions.size === 0}>
                        Clear all expressions
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setShowLayerInfo(true)} disabled={!selectedFace}>
                        <Info className="h-4 w-4" /> Layer info
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            )}

            {/* ── Browse mode ── */}
            {viewMode === 'browse' && (
              <div className="flex flex-1 min-h-0 gap-4 p-4 overflow-hidden">
                <div className="w-72 shrink-0 flex flex-col gap-3 overflow-hidden">
                  {currentFaceData?.ui?.files && (
                    <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-primary" /> UI Files
                          <Badge variant="secondary" className="ml-auto text-[10px]">{currentFaceData.ui.files.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                          <div className="p-3 pt-0 space-y-0.5">
                            {currentFaceData.ui.files.map((file) => (
                              <Button key={file} variant={selectedFile?.type === 'ui' && selectedFile?.file === file ? 'default' : 'ghost'} className="w-full justify-start text-left font-normal text-xs h-7" size="sm" onClick={() => { setSelectedFile({ type: 'ui', file }); setImageError(false); setImageLoading(true); }}>
                                <span className="truncate">{file}</span>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                  {currentFaceData?.story?.files && (
                    <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" /> Story Files
                          <Badge variant="secondary" className="ml-auto text-[10px]">{currentFaceData.story.files.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                          <div className="p-3 pt-0 space-y-0.5">
                            {currentFaceData.story.files.map((file) => (
                              <Button key={file} variant={selectedFile?.type === 'story' && selectedFile?.file === file ? 'default' : 'ghost'} className="w-full justify-start text-left font-normal text-xs h-7" size="sm" onClick={() => { setSelectedFile({ type: 'story', file }); setImageError(false); setImageLoading(true); }}>
                                <span className="truncate">{file}</span>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                  {availableFullShotVariants.length > 0 && (
                    <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-primary" /> Full Shot
                          <Badge variant="secondary" className="ml-auto text-[10px]">{availableFullShotVariants.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                          <div className="p-3 pt-0 space-y-0.5">
                            {availableFullShotVariants.map((variant) => (
                              <Button key={variant} variant={selectedFile?.type === 'fullshot' && selectedFile?.variant === variant ? 'default' : 'ghost'} className="w-full justify-start text-left font-normal text-xs h-7" size="sm" onClick={() => { setSelectedFile({ type: 'fullshot', file: `full_shot_1440_1920_${variant}.png`, variant }); setImageError(false); setImageLoading(true); }}>
                                <span className="truncate">{variant === '0' ? 'Base Form' : `Awakened Form ${variant}`}</span>
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Card className="flex-1 flex flex-col min-w-0 min-h-0">
                  <CardHeader className="pb-3 pt-4 px-4 shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedFace}</CardTitle>
                        {selectedFile && (
                          <CardDescription className="mt-0.5">
                            {selectedFile.type === 'fullshot'
                              ? `FULL SHOT / ${selectedFile.variant === '0' ? 'Base Form' : `Awakened Form ${selectedFile.variant}`}`
                              : `${selectedFile.type.toUpperCase()} / ${selectedFile.file}`}
                          </CardDescription>
                        )}
                      </div>
                      {selectedFile && (
                        <Button variant="outline" size="sm" onClick={downloadImage}>
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex items-center justify-center p-6 min-h-0">
                    {!selectedFile ? (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Select a file to preview</p>
                      </div>
                    ) : !imageError ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {selectedFile.type === 'fullshot' && selectedFile.variant ? (
                          (() => {
                            const pos = getFullShotPositioning(selectedFace, selectedFile.variant);
                            const url = getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant);
                            return (
                              <div className="relative w-full h-full flex flex-col items-center justify-center gap-4">
                                <div className="relative bg-muted rounded-lg overflow-hidden" style={{ width: 720, height: 960, maxWidth: '100%', maxHeight: '80%' }}>
                                  {pos ? (
                                    <div className="relative w-full h-full overflow-hidden">
                                      <Image src={url} alt={`${selectedFace} fullshot`} width={1440} height={1920} className="absolute" style={{ imageRendering: 'crisp-edges', width: `${(pos.xOffset / pos.baseWidth) * 100}%`, height: `${(pos.yOffset / pos.baseHeight) * 100}%`, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', objectFit: 'contain' }} onLoadingComplete={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }} unoptimized />
                                    </div>
                                  ) : (
                                    <Image src={url} alt={`${selectedFace} fullshot`} fill className="object-contain" style={{ imageRendering: 'crisp-edges' }} onLoadingComplete={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }} unoptimized />
                                  )}
                                </div>
                                {pos && <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">Positioning: {pos.xOffset}×{pos.yOffset} (Base: {pos.baseWidth}×{pos.baseHeight})</div>}
                              </div>
                            );
                          })()
                        ) : (
                          <Image src={getImageUrl(selectedFile.type, selectedFile.file, selectedFile.variant)} alt={`${selectedFace} - ${selectedFile.file}`} width={800} height={800} className="object-contain max-w-full max-h-full" style={{ imageRendering: 'crisp-edges' }} onLoadingComplete={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }} unoptimized />
                        )}
                        {imageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Failed to load image</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />

      {/* ── Isolate expression dialog ── */}
      <Dialog open={!!isolateTarget} onOpenChange={(open) => { if (!open) setIsolateTarget(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{isolateTarget?.stem}</DialogTitle>
            <DialogDescription>{isolateTarget?.face}</DialogDescription>
          </DialogHeader>
          {isolateTarget && (
            <>
              <div
                className="relative mx-auto overflow-hidden rounded-lg border"
                style={{ width: 256, height: 256, ...BG_STYLES.checkerboard }}
              >
                <Image
                  src={`${CDN_ROOT}/wfjukebox/character/character_art/${isolateTarget.face}/ui/story/${isolateTarget.stem}.png`}
                  alt={isolateTarget.stem}
                  fill
                  className="object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  unoptimized
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(`${CDN_ROOT}/wfjukebox/character/character_art/${isolateTarget.face}/ui/story/${isolateTarget.stem}.png`)}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy URL
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`${CDN_ROOT}/wfjukebox/character/character_art/${isolateTarget.face}/ui/story/${isolateTarget.stem}.png`, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Layer info dialog ── */}
      <Dialog open={showLayerInfo} onOpenChange={setShowLayerInfo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Layer Info</DialogTitle>
            <DialogDescription className="font-mono text-xs">{selectedFace}</DialogDescription>
          </DialogHeader>
          {selectedFace && (
            <div className="space-y-3 text-sm max-h-96 overflow-y-auto">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Canvas</p>
                <p className="font-mono text-xs bg-muted/40 rounded px-2 py-1">{composeCanvasSize.width} × {composeCanvasSize.height} px</p>
              </div>
              {resolvedBaseFile && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Base Layer</p>
                  <div className="rounded-md border bg-muted/30 p-2 font-mono text-xs space-y-0.5">
                    <p className="text-foreground">{resolvedBaseFile}</p>
                    {(() => {
                      const r = getTrimRect(selectedFace, resolvedBaseFile);
                      return r
                        ? <p className="text-muted-foreground">x:{r.x} y:{r.y} · {r.canvasWidth}×{r.canvasHeight}</p>
                        : <p className="text-muted-foreground">no trim data</p>;
                    })()}
                  </div>
                </div>
              )}
              {selectedExpressionList.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expression Layers ({selectedExpressionList.length})</p>
                  <div className="space-y-1">
                    {selectedExpressionList.map((exp) => {
                      const stem = normalizeAssetStem(exp);
                      const r = getTrimRect(selectedFace, exp);
                      return (
                        <div key={exp} className="rounded-md border bg-muted/30 p-2 font-mono text-xs space-y-0.5">
                          <p className="text-foreground">{stem}</p>
                          {r
                            ? <p className="text-muted-foreground">x:{r.x} y:{r.y} · {r.canvasWidth}×{r.canvasHeight}</p>
                            : <p className="text-muted-foreground">no trim data</p>}
                          {(expressionOffsetX !== 0 || expressionOffsetY !== 0 || expressionScale !== 1) && (
                            <p className="text-muted-foreground">offset:({expressionOffsetX},{expressionOffsetY}) scale:{expressionScale.toFixed(2)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function FaceBuilder() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-80"><CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading Face Builder</p>
          </div>
        </CardContent></Card>
      </div>
    }>
      <FaceBuilderInner />
    </Suspense>
  );
}
