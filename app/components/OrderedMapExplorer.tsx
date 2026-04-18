'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileJson,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Search,
  Star,
  XCircle,
} from 'lucide-react';
import { parseOrderedMapJson, type ParsedItem } from '@/lib/json-parser';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AudioPlayer from '@/components/AudioPlayer';

type Lang = 'jp' | 'en';
type PreviewTab = 'parsed' | 'raw';
type CategorySort = 'name' | 'count';
type FileSort = 'name_asc' | 'name_desc';
type CategoryType = 'audio' | 'image' | 'data';

interface OrderedMapListPayload {
  categories: string[];
  filesByCategory: Record<string, string[]>;
  sourceUrl?: string;
}

interface OrderedMapFilePayload {
  category: string;
  file: string;
  data: unknown;
  sourceUrl?: string;
}

interface RecentFile {
  lang: Lang;
  category: string;
  file: string;
  openedAt: number;
}

interface VirtualizedListProps<T> {
  items: T[];
  rowHeight: number;
  overscan?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
}

const PINNED_STORAGE_KEY = 'orderedmap:v2:pinned-categories';
const RECENT_STORAGE_KEY = 'orderedmap:v2:recent-files';
const CDN_BASE = 'https://wfjukebox.b-cdn.net/';
const PARSED_ITEMS_PER_PAGE = 100;

function normalizeFileName(file: string): string {
  return file.replace(/\.json$/i, '');
}

function normalizeFilesByCategory(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const output: Record<string, string[]> = {};
  for (const [category, value] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      output[category] = value
        .filter((entry): entry is string => typeof entry === 'string')
        .map(normalizeFileName);
      continue;
    }

    if (typeof value === 'string') {
      output[category] = [normalizeFileName(value)];
      continue;
    }

    output[category] = [];
  }

  return output;
}

function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs, value]);

  return debounced;
}

function getCategoryType(category: string): CategoryType {
  if (category === 'asset') {
    return 'audio';
  }

  const imageCategories = new Set([
    'character',
    'character_ui',
    'town',
    'feature_banner',
    'encyclopedia',
    'degree',
    'item',
    'equipment_enhancement',
    'shop',
    'battle',
    'tips',
    'skill_preview',
    'gacha',
    'quest',
    'story',
    'stance_detail',
    'news',
    'help',
    'rich_text',
    'bonus',
  ]);

  if (imageCategories.has(category)) {
    return 'image';
  }

  return 'data';
}

function getCategoryTypeClasses(type: CategoryType): string {
  if (type === 'audio') {
    return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
  }
  if (type === 'image') {
    return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300';
  }
  return 'bg-slate-500/10 border-slate-500/30 text-slate-300';
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
}

function getFileCacheKey(lang: Lang, category: string, file: string): string {
  return `${lang}/${category}/${normalizeFileName(file)}`;
}

function normalizeAssetPath(raw: string): string {
  const sanitized = raw.trim().split(/[?#]/)[0];
  if (!sanitized) {
    return '';
  }
  if (sanitized.startsWith(CDN_BASE)) {
    return sanitized.slice(CDN_BASE.length).replace(/^\/+/, '');
  }
  return sanitized.replace(/^\/+/, '');
}

function looksLikeBgmPath(raw: string): boolean {
  const path = normalizeAssetPath(raw).toLowerCase();
  return path.startsWith('bgm/') || path.includes('/bgm/');
}

function collectStringValues(value: unknown, output: Set<string>, depth = 0): void {
  if (depth > 8 || value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    output.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStringValues(entry, output, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectStringValues(entry, output, depth + 1);
    }
  }
}

function extractBgmMp3Urls(item: ParsedItem | null): string[] {
  if (!item) {
    return [];
  }

  const discoveredStrings = new Set<string>();
  discoveredStrings.add(item.id);
  discoveredStrings.add(item.label);
  collectStringValues(item.data, discoveredStrings);
  if (item.imageUrl) {
    discoveredStrings.add(item.imageUrl);
  }

  const urls = new Set<string>();

  for (const candidate of discoveredStrings) {
    if (!looksLikeBgmPath(candidate)) {
      continue;
    }

    const normalized = normalizeAssetPath(candidate);
    if (!normalized) {
      continue;
    }

    if (/^https?:\/\//i.test(candidate)) {
      const base = candidate.split(/[?#]/)[0].replace(/\.[a-z0-9]{2,5}$/i, '');
      urls.add(`${base}.mp3`);
      continue;
    }

    const noExt = normalized.replace(/\.[a-z0-9]{2,5}$/i, '');
    urls.add(`${CDN_BASE}${noExt}.mp3`);
  }

  return Array.from(urls);
}

function looksLikeImageAssetPath(raw: string): boolean {
  const lower = normalizeAssetPath(raw).toLowerCase();
  if (!lower || lower.length < 3) return false;
  if (looksLikeBgmPath(lower)) return false;
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    // Keep absolute URLs if they look image-like.
  } else if (!lower.includes('/')) {
    return false;
  }

  if (/\s/.test(lower)) return false;
  if (/\.(mp3|ogg|wav|m4a|aac|flac|awb|acb|json|orderedmap)$/i.test(lower)) return false;

  const hasExt = /\.[a-z0-9]{2,5}$/i.test(lower);
  if (hasExt && !/\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(lower)) {
    return false;
  }

  return true;
}

interface ParsedImageEntry {
  id: string;
  path: string;
  sources: string[];
}

function extractParsedItemImageEntries(item: ParsedItem | null): ParsedImageEntry[] {
  if (!item) {
    return [];
  }

  const discoveredStrings = new Set<string>();
  discoveredStrings.add(item.id);
  discoveredStrings.add(item.label);
  collectStringValues(item.data, discoveredStrings);
  if (item.imageUrl) {
    discoveredStrings.add(item.imageUrl);
  }

  const entries = new Map<string, ParsedImageEntry>();

  for (const candidate of discoveredStrings) {
    if (!looksLikeImageAssetPath(candidate)) {
      continue;
    }

    const cleaned = candidate.split(/[?#]/)[0];
    let key = '';
    let pathLabel = '';
    let sources: string[] = [];

    if (/^https?:\/\//i.test(cleaned)) {
      const base = cleaned.replace(/\.[a-z0-9]{2,5}$/i, '');
      const hasImageExt = /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(cleaned);
      key = base.toLowerCase();
      pathLabel = cleaned;
      sources = hasImageExt ? [cleaned] : [`${base}.png`, `${base}.jpg`];
    } else {
      const normalized = normalizeAssetPath(cleaned);
      const base = normalized.replace(/\.[a-z0-9]{2,5}$/i, '');
      const hasImageExt = /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(normalized);
      key = base.toLowerCase();
      pathLabel = normalized;
      sources = hasImageExt ? [`${CDN_BASE}${normalized}`] : [`${CDN_BASE}${base}.png`, `${CDN_BASE}${base}.jpg`];
    }

    const uniqueSources = Array.from(new Set(sources));
    if (!uniqueSources.length || entries.has(key)) {
      continue;
    }

    entries.set(key, {
      id: key,
      path: pathLabel,
      sources: uniqueSources,
    });
  }

  return Array.from(entries.values());
}

async function isPlayableAudioUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/assets/probe?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      return false;
    }
    const data = (await response.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

function isNumericLikeLabel(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function deriveReadableTitleFromPath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const lastSegment = normalized.split('/').filter(Boolean).pop() || normalized;
  const withoutExt = lastSegment.replace(/\.[a-z0-9]{2,5}$/i, '');
  const cleaned = withoutExt.replace(/[_-]+/g, ' ').trim();
  return cleaned || withoutExt || 'Untitled';
}

function getParsedItemDisplayTitle(item: ParsedItem): string {
  const rawLabel = String(item.label ?? '').trim();
  if (!rawLabel || rawLabel === '(None)' || isNumericLikeLabel(rawLabel) || rawLabel.includes('/')) {
    return deriveReadableTitleFromPath(String(item.id ?? ''));
  }
  return rawLabel;
}

function VirtualizedList<T>({
  items,
  rowHeight,
  overscan = 8,
  className,
  getKey,
  renderItem,
  emptyState,
}: VirtualizedListProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateHeight = () => setViewportHeight(element.clientHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const totalHeight = items.length * rowHeight;
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
  const offsetY = startIndex * rowHeight;
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={viewportRef}
      className={cn('min-h-0 flex-1 overflow-auto', className)}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{emptyState ?? 'No results'}</div>
      ) : (
        <div style={{ height: totalHeight }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.map((item, index) => (
              <div key={getKey(item, startIndex + index)} style={{ height: rowHeight }}>
                {renderItem(item, startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
interface CategoryRowProps {
  name: string;
  count: number;
  type: CategoryType;
  active: boolean;
  pinned: boolean;
  onSelect: (category: string) => void;
  onTogglePin: (category: string) => void;
}

const CategoryRow = memo(function CategoryRow({
  name,
  count,
  type,
  active,
  pinned,
  onSelect,
  onTogglePin,
}: CategoryRowProps) {
  return (
    <div className="px-2 py-1">
      <button
        type="button"
        onClick={() => onSelect(name)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors',
          active
            ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
            : 'border-transparent bg-muted/25 hover:border-border hover:bg-muted/45'
        )}
      >
        <Folder className="h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
        </div>
        <Badge variant="outline" className={cn('hidden border text-[10px] sm:inline-flex', getCategoryTypeClasses(type))}>
          {type}
        </Badge>
        <Badge variant="secondary" className="h-5 text-[10px]">
          {count}
        </Badge>
      </button>
      <div className="mt-1 flex justify-end px-1">
        <button
          type="button"
          className={cn(
            'rounded p-1 transition-colors',
            pinned ? 'text-yellow-300 hover:text-yellow-200' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onTogglePin(name)}
          title={pinned ? 'Unpin category' : 'Pin category'}
        >
          <Star className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
        </button>
      </div>
    </div>
  );
});

interface FileRowProps {
  file: string;
  active: boolean;
  onSelect: (file: string) => void;
  onPrefetch: (file: string) => void;
}

const FileRow = memo(function FileRow({ file, active, onSelect, onPrefetch }: FileRowProps) {
  return (
    <div className="px-2 py-1">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors',
          active
            ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
            : 'border-transparent bg-muted/25 hover:border-border hover:bg-muted/45'
        )}
        onClick={() => onSelect(file)}
        onMouseEnter={() => onPrefetch(file)}
        onFocus={() => onPrefetch(file)}
      >
        <FileJson className="h-4 w-4 shrink-0 text-emerald-300" />
        <div className="min-w-0 flex-1 truncate text-sm">{file}</div>
      </button>
    </div>
  );
});

export default function OrderedMapExplorerV2() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialLang = useRef<Lang>(searchParams.get('lang') === 'en' ? 'en' : 'jp');
  const initialCategory = useRef<string>(searchParams.get('category') ?? '');
  const initialFile = useRef<string>(normalizeFileName(searchParams.get('file') ?? ''));
  const initialTab = useRef<PreviewTab>(searchParams.get('view') === 'raw' ? 'raw' : 'parsed');

  const [language, setLanguage] = useState<Lang>(initialLang.current);
  const [previewTab, setPreviewTab] = useState<PreviewTab>(initialTab.current);
  const [pixelPerfect, setPixelPerfect] = useState(true);

  const [categories, setCategories] = useState<string[]>([]);
  const [filesByCategory, setFilesByCategory] = useState<Record<string, string[]>>({});
  const [listSourceUrl, setListSourceUrl] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory.current);
  const [selectedFile, setSelectedFile] = useState<string>(initialFile.current);

  const [categorySearch, setCategorySearch] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [parsedSearch, setParsedSearch] = useState('');
  const [parsedPage, setParsedPage] = useState(1);
  const [categorySort, setCategorySort] = useState<CategorySort>('name');
  const [fileSort, setFileSort] = useState<FileSort>('name_asc');

  const [loadingList, setLoadingList] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [filePayload, setFilePayload] = useState<OrderedMapFilePayload | null>(null);
  const [selectedParsedId, setSelectedParsedId] = useState('');
  const [detailAssetFailed, setDetailAssetFailed] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedImageSourceIndex, setSelectedImageSourceIndex] = useState(0);
  const [validatedBgmUrls, setValidatedBgmUrls] = useState<string[]>([]);
  const [invalidBgmUrls, setInvalidBgmUrls] = useState<string[]>([]);
  const [bgmValidationLoading, setBgmValidationLoading] = useState(false);

  const [pinnedCategories, setPinnedCategories] = useState<string[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  const listCacheRef = useRef(new Map<Lang, OrderedMapListPayload>());
  const fileCacheRef = useRef(new Map<string, OrderedMapFilePayload>());
  const inflightFileRef = useRef(new Map<string, Promise<OrderedMapFilePayload | null>>());
  const parsedCacheRef = useRef(new Map<string, ParsedItem[]>());
  const bgmAvailabilityCacheRef = useRef(new Map<string, boolean>());

  const categoryQuery = useDebouncedValue(categorySearch.trim().toLowerCase(), 120);
  const fileQuery = useDebouncedValue(fileSearch.trim().toLowerCase(), 120);
  const parsedQuery = useDebouncedValue(parsedSearch.trim().toLowerCase(), 120);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) ?? '[]');
      if (Array.isArray(parsed)) {
        setPinnedCategories(parsed.filter((entry): entry is string => typeof entry === 'string'));
      }
    } catch {
      setPinnedCategories([]);
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]');
      if (Array.isArray(parsed)) {
        const sanitized = parsed
          .filter((entry): entry is RecentFile => {
            if (!entry || typeof entry !== 'object') return false;
            const candidate = entry as Partial<RecentFile>;
            return (
              (candidate.lang === 'jp' || candidate.lang === 'en') &&
              typeof candidate.category === 'string' &&
              typeof candidate.file === 'string' &&
              typeof candidate.openedAt === 'number'
            );
          })
          .slice(0, 12);
        setRecentFiles(sanitized);
      }
    } catch {
      setRecentFiles([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedCategories));
  }, [pinnedCategories]);

  useEffect(() => {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentFiles));
  }, [recentFiles]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('lang', language);
    params.set('view', previewTab);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedFile) params.set('file', selectedFile);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [language, previewTab, selectedCategory, selectedFile, router, pathname]);

  const fetchList = useCallback(
    async (lang: Lang, force = false) => {
      if (!force) {
        const cached = listCacheRef.current.get(lang);
        if (cached) {
          setCategories(cached.categories);
          setFilesByCategory(cached.filesByCategory);
          setListSourceUrl(cached.sourceUrl ?? null);
          setLoadingList(false);
          setListError(null);
          return;
        }
      }

      setLoadingList(true);
      setListError(null);

      try {
        const response = await fetch(`/api/orderedmap/list?lang=${lang}`);
        if (!response.ok) {
          throw new Error(`Unable to load list (${response.status})`);
        }

        const payload = (await response.json()) as {
          categories?: unknown;
          filesByCategory?: unknown;
          sourceUrl?: unknown;
        };

        const normalizedFiles = normalizeFilesByCategory(payload.filesByCategory);
        const normalizedCategories = Array.isArray(payload.categories)
          ? payload.categories.filter((entry): entry is string => typeof entry === 'string')
          : Object.keys(normalizedFiles);

        const normalizedPayload: OrderedMapListPayload = {
          categories: normalizedCategories,
          filesByCategory: normalizedFiles,
          sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : undefined,
        };

        listCacheRef.current.set(lang, normalizedPayload);
        setCategories(normalizedPayload.categories);
        setFilesByCategory(normalizedPayload.filesByCategory);
        setListSourceUrl(normalizedPayload.sourceUrl ?? null);
      } catch (error) {
        setCategories([]);
        setFilesByCategory({});
        setListSourceUrl(null);
        setListError(error instanceof Error ? error.message : 'Failed to load orderedmap list');
      } finally {
        setLoadingList(false);
      }
    },
    []
  );

  const loadFileData = useCallback(
    async (category: string, file: string, options?: { prefetch?: boolean; force?: boolean }) => {
      const normalizedFile = normalizeFileName(file);
      const cacheKey = getFileCacheKey(language, category, normalizedFile);

      if (!options?.force) {
        const cached = fileCacheRef.current.get(cacheKey);
        if (cached) {
          if (!options?.prefetch) {
            setFilePayload(cached);
            setFileError(null);
          }
          return cached;
        }
      }

      const inflight = inflightFileRef.current.get(cacheKey);
      if (inflight) {
        const resolved = await inflight;
        if (!options?.prefetch) {
          if (resolved) {
            setFilePayload(resolved);
            setFileError(null);
          } else {
            setFilePayload(null);
            setFileError('Failed to load file data');
          }
        }
        return resolved;
      }

      const request = (async () => {
        try {
          const response = await fetch(
            `/api/orderedmap/data?category=${encodeURIComponent(category)}&file=${encodeURIComponent(
              normalizedFile
            )}&lang=${language}`
          );

          if (!response.ok) {
            throw new Error(`Unable to load file (${response.status})`);
          }

          const payload = (await response.json()) as {
            file?: unknown;
            data?: unknown;
            sourceUrl?: unknown;
          };

          const normalizedPayload: OrderedMapFilePayload = {
            category,
            file: normalizeFileName(typeof payload.file === 'string' ? payload.file : normalizedFile),
            data: payload.data,
            sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : undefined,
          };

          fileCacheRef.current.set(cacheKey, normalizedPayload);
          return normalizedPayload;
        } catch {
          return null;
        } finally {
          inflightFileRef.current.delete(cacheKey);
        }
      })();

      inflightFileRef.current.set(cacheKey, request);

      const result = await request;
      if (!options?.prefetch) {
        if (result) {
          setFilePayload(result);
          setFileError(null);
        } else {
          setFilePayload(null);
          setFileError('Failed to load file data');
        }
      }

      return result;
    },
    [language]
  );

  useEffect(() => {
    void fetchList(language);
  }, [language, fetchList]);

  useEffect(() => {
    if (loadingList) return;

    if (categories.length === 0) {
      setSelectedCategory('');
      setSelectedFile('');
      setFilePayload(null);
      return;
    }

    if (!selectedCategory || !filesByCategory[selectedCategory]) {
      const nextCategory = categories[0];
      const fallbackFile = filesByCategory[nextCategory]?.[0] ?? '';
      setSelectedCategory(nextCategory);
      setSelectedFile(fallbackFile);
      return;
    }

    const categoryFiles = filesByCategory[selectedCategory] ?? [];
    if (categoryFiles.length === 0) {
      setSelectedFile('');
      setFilePayload(null);
      return;
    }

    if (!selectedFile || !categoryFiles.includes(selectedFile)) {
      setSelectedFile(categoryFiles[0]);
    }
  }, [loadingList, categories, filesByCategory, selectedCategory, selectedFile]);

  useEffect(() => {
    if (!selectedCategory || !selectedFile) {
      setFilePayload(null);
      setFileError(null);
      return;
    }

    let cancelled = false;
    setLoadingFile(true);
    setFileError(null);

    void loadFileData(selectedCategory, selectedFile).finally(() => {
      if (!cancelled) {
        setLoadingFile(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, selectedFile, loadFileData]);

  useEffect(() => {
    if (!filePayload) return;

    setRecentFiles((previous) => {
      const withoutCurrent = previous.filter(
        (entry) => !(entry.lang === language && entry.category === filePayload.category && entry.file === filePayload.file)
      );

      return [
        {
          lang: language,
          category: filePayload.category,
          file: filePayload.file,
          openedAt: Date.now(),
        },
        ...withoutCurrent,
      ].slice(0, 12);
    });
  }, [filePayload, language]);

  const categoryRows = useMemo(() => {
    const rows = categories.map((name) => {
      const count = filesByCategory[name]?.length ?? 0;
      return {
        name,
        count,
        type: getCategoryType(name),
        pinned: pinnedCategories.includes(name),
      };
    });

    const filtered = categoryQuery
      ? rows.filter((row) => row.name.toLowerCase().includes(categoryQuery))
      : rows;

    const sorted = filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      if (categorySort === 'count' && a.count !== b.count) {
        return b.count - a.count;
      }

      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [categories, filesByCategory, pinnedCategories, categoryQuery, categorySort]);

  const availableFiles = useMemo(() => {
    if (!selectedCategory) return [];
    return filesByCategory[selectedCategory] ?? [];
  }, [filesByCategory, selectedCategory]);

  const filteredFiles = useMemo(() => {
    const filtered = fileQuery
      ? availableFiles.filter((file) => file.toLowerCase().includes(fileQuery))
      : [...availableFiles];

    filtered.sort((a, b) => {
      if (fileSort === 'name_desc') {
        return b.localeCompare(a);
      }
      return a.localeCompare(b);
    });

    return filtered;
  }, [availableFiles, fileQuery, fileSort]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (!filteredFiles.length) return;

      event.preventDefault();
      const currentIndex = filteredFiles.findIndex((file) => file === selectedFile);
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(filteredFiles.length - 1, currentIndex < 0 ? 0 : currentIndex + 1)
          : Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1);

      const nextFile = filteredFiles[nextIndex];
      if (nextFile) {
        setSelectedFile(nextFile);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredFiles, selectedFile]);

  const parsedItems = useMemo(() => {
    if (previewTab !== 'parsed' || !filePayload || !selectedCategory) {
      return [];
    }

    const cacheKey = getFileCacheKey(language, selectedCategory, filePayload.file);
    const cached = parsedCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const parsed = parseOrderedMapJson(filePayload.data, selectedCategory);
    parsedCacheRef.current.set(cacheKey, parsed);
    return parsed;
  }, [previewTab, filePayload, selectedCategory, language]);

  const filteredParsedItems = useMemo(() => {
    if (!parsedQuery) {
      return parsedItems;
    }

    return parsedItems.filter((item) => {
      if (item.label.toLowerCase().includes(parsedQuery)) return true;
      if (item.id.toLowerCase().includes(parsedQuery)) return true;
      return Object.values(item.data).some((value) => String(value).toLowerCase().includes(parsedQuery));
    });
  }, [parsedItems, parsedQuery]);

  useEffect(() => {
    if (!filteredParsedItems.length) {
      setSelectedParsedId('');
      return;
    }

    if (!filteredParsedItems.some((item) => item.id === selectedParsedId)) {
      setSelectedParsedId(filteredParsedItems[0].id);
    }
  }, [filteredParsedItems, selectedParsedId]);

  const selectedParsedItem = useMemo(() => {
    if (!selectedParsedId) return null;
    return filteredParsedItems.find((item) => item.id === selectedParsedId) ?? null;
  }, [filteredParsedItems, selectedParsedId]);

  const parsedListRows = useMemo(
    () =>
      filteredParsedItems.map((item) => ({
        item,
        displayTitle: getParsedItemDisplayTitle(item),
        displayId: String(item.id ?? ''),
      })),
    [filteredParsedItems]
  );

  const parsedTotalPages = useMemo(
    () => Math.max(1, Math.ceil(parsedListRows.length / PARSED_ITEMS_PER_PAGE)),
    [parsedListRows.length]
  );

  const safeParsedPage = Math.min(parsedPage, parsedTotalPages);

  const pagedParsedRows = useMemo(() => {
    const start = (safeParsedPage - 1) * PARSED_ITEMS_PER_PAGE;
    return parsedListRows.slice(start, start + PARSED_ITEMS_PER_PAGE);
  }, [parsedListRows, safeParsedPage]);

  const parsedRangeStart = parsedListRows.length === 0 ? 0 : (safeParsedPage - 1) * PARSED_ITEMS_PER_PAGE + 1;
  const parsedRangeEnd = Math.min(safeParsedPage * PARSED_ITEMS_PER_PAGE, parsedListRows.length);

  useEffect(() => {
    setParsedPage(1);
  }, [parsedQuery, selectedCategory, selectedFile]);

  useEffect(() => {
    if (parsedPage > parsedTotalPages) {
      setParsedPage(parsedTotalPages);
    }
  }, [parsedPage, parsedTotalPages]);

  const selectedParsedDisplayTitle = useMemo(
    () => (selectedParsedItem ? getParsedItemDisplayTitle(selectedParsedItem) : ''),
    [selectedParsedItem]
  );

  const parsedItemImageEntries = useMemo(
    () => extractParsedItemImageEntries(selectedParsedItem),
    [selectedParsedItem]
  );

  const safeSelectedImageIndex = parsedItemImageEntries.length
    ? Math.min(selectedImageIndex, parsedItemImageEntries.length - 1)
    : 0;

  const selectedImageEntry = parsedItemImageEntries[safeSelectedImageIndex] ?? null;

  const selectedImageSrc = selectedImageEntry
    ? selectedImageEntry.sources[Math.min(selectedImageSourceIndex, selectedImageEntry.sources.length - 1)] ?? null
    : null;

  const parsedItemBgmUrls = useMemo(() => extractBgmMp3Urls(selectedParsedItem), [selectedParsedItem]);

  const hasImagePreview = Boolean(selectedImageEntry);

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedImageSourceIndex(0);
    setDetailAssetFailed(false);
  }, [selectedParsedItem?.id]);

  useEffect(() => {
    if (selectedImageIndex >= parsedItemImageEntries.length) {
      setSelectedImageIndex(0);
    }
  }, [selectedImageIndex, parsedItemImageEntries.length]);

  useEffect(() => {
    setSelectedImageSourceIndex(0);
    setDetailAssetFailed(false);
  }, [safeSelectedImageIndex, selectedParsedItem?.id]);

  useEffect(() => {
    let cancelled = false;

    if (parsedItemBgmUrls.length === 0) {
      setValidatedBgmUrls([]);
      setInvalidBgmUrls([]);
      setBgmValidationLoading(false);
      return;
    }

    setBgmValidationLoading(true);

    void (async () => {
      const checkResults = await Promise.all(
        parsedItemBgmUrls.map(async (url) => {
          const cached = bgmAvailabilityCacheRef.current.get(url);
          if (cached === true) {
            return { url, ok: true };
          }
          const ok = await isPlayableAudioUrl(url);
          bgmAvailabilityCacheRef.current.set(url, ok);
          return { url, ok };
        })
      );

      if (cancelled) {
        return;
      }

      setValidatedBgmUrls(checkResults.filter((entry) => entry.ok).map((entry) => entry.url));
      setInvalidBgmUrls(checkResults.filter((entry) => !entry.ok).map((entry) => entry.url));
      setBgmValidationLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [parsedItemBgmUrls]);

  const rawJson = useMemo(() => {
    if (previewTab !== 'raw' || !filePayload) {
      return '';
    }

    return JSON.stringify(filePayload.data, null, 2);
  }, [previewTab, filePayload]);

  const activeSourceUrl = filePayload?.sourceUrl ?? listSourceUrl;

  const shareUrl = useMemo(() => {
    if (!origin || !activeSourceUrl || !activeSourceUrl.startsWith(CDN_BASE)) {
      return null;
    }

    const relative = activeSourceUrl.slice(CDN_BASE.length);
    return `${origin}/share/${relative}`;
  }, [origin, activeSourceUrl]);

  const copyText = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(null), 1500);
    } catch {
      setCopiedValue(null);
    }
  }, []);

  const onCategorySelect = useCallback(
    (category: string) => {
      setSelectedCategory(category);
      setFileSearch('');

      const files = filesByCategory[category] ?? [];
      if (!files.length) {
        setSelectedFile('');
        setFilePayload(null);
        return;
      }

      if (!files.includes(selectedFile)) {
        setSelectedFile(files[0]);
      }
    },
    [filesByCategory, selectedFile]
  );

  const onTogglePinCategory = useCallback((category: string) => {
    setPinnedCategories((previous) => {
      if (previous.includes(category)) {
        return previous.filter((entry) => entry !== category);
      }
      return [...previous, category];
    });
  }, []);

  const onFileSelect = useCallback((file: string) => {
    setSelectedFile(file);
  }, []);

  const onFilePrefetch = useCallback(
    (file: string) => {
      if (!selectedCategory) return;
      void loadFileData(selectedCategory, file, { prefetch: true });
    },
    [selectedCategory, loadFileData]
  );

  const refreshCurrentLanguage = useCallback(async () => {
    listCacheRef.current.delete(language);

    if (selectedCategory && selectedFile) {
      const key = getFileCacheKey(language, selectedCategory, selectedFile);
      fileCacheRef.current.delete(key);
      parsedCacheRef.current.delete(key);
    }

    await fetchList(language, true);

    if (selectedCategory && selectedFile) {
      setLoadingFile(true);
      setFileError(null);
      void loadFileData(selectedCategory, selectedFile, { force: true }).finally(() => {
        setLoadingFile(false);
      });
    }
  }, [language, selectedCategory, selectedFile, fetchList, loadFileData]);

  const recentForLanguage = useMemo(
    () => recentFiles.filter((entry) => entry.lang === language),
    [recentFiles, language]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#05070c] text-slate-100">
      <div className="border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">OrderedMap Explorer V2</h1>
              <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-200">Beta</Badge>
            </div>
            <p className="text-xs text-slate-400">Three-pane explorer with cached fetches, URL state, and low-latency preview.</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-md border border-white/15 bg-white/5 p-1">
              <Button
                size="sm"
                variant={language === 'jp' ? 'default' : 'ghost'}
                className="h-7 px-2"
                onClick={() => setLanguage('jp')}
              >
                JP
              </Button>
              <Button
                size="sm"
                variant={language === 'en' ? 'default' : 'ghost'}
                className="h-7 px-2"
                onClick={() => setLanguage('en')}
              >
                EN
              </Button>
            </div>

            <Button size="sm" variant="outline" className="h-8 border-white/20 bg-white/5" onClick={refreshCurrentLanguage}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {activeSourceUrl && (
        <div className="border-b border-white/10 bg-black/20 px-4 py-1.5 text-xs text-slate-400">
          Source:{' '}
          <a href={activeSourceUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
            {activeSourceUrl}
          </a>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_360px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold">Categories</h2>
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {categoryRows.length}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setCategorySort((current) => (current === 'name' ? 'count' : 'name'))}
              >
                <ArrowDownUp className="mr-1 h-3.5 w-3.5" />
                {categorySort === 'name' ? 'Name' : 'Count'}
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                placeholder="Filter categories"
                className="h-8 border-white/15 bg-black/20 pl-8 text-xs"
              />
            </div>
          </div>

          {loadingList ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
            </div>
          ) : listError ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-red-300">{listError}</div>
          ) : (
            <VirtualizedList
              items={categoryRows}
              rowHeight={58}
              getKey={(item) => item.name}
              emptyState="No categories"
              renderItem={(item) => (
                <CategoryRow
                  name={item.name}
                  count={item.count}
                  type={item.type}
                  active={selectedCategory === item.name}
                  pinned={item.pinned}
                  onSelect={onCategorySelect}
                  onTogglePin={onTogglePinCategory}
                />
              )}
            />
          )}
        </section>

        <section className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-emerald-300" />
                <h2 className="text-sm font-semibold">Files</h2>
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {filteredFiles.length}
                </Badge>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setFileSort((current) => (current === 'name_asc' ? 'name_desc' : 'name_asc'))}
              >
                <ArrowDownUp className="mr-1 h-3.5 w-3.5" />
                {fileSort === 'name_asc' ? 'A-Z' : 'Z-A'}
              </Button>
            </div>

            <p className="truncate text-xs text-slate-400" title={selectedCategory || ''}>
              {selectedCategory || 'Select a category'}
            </p>

            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                value={fileSearch}
                onChange={(event) => setFileSearch(event.target.value)}
                placeholder="Filter files"
                className="h-8 border-white/15 bg-black/20 pl-8 text-xs"
                disabled={!selectedCategory}
              />
            </div>

            {recentForLanguage.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Recent</p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {recentForLanguage.slice(0, 6).map((recent) => (
                    <button
                      key={`${recent.category}/${recent.file}`}
                      type="button"
                      className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
                      onClick={() => {
                        setSelectedCategory(recent.category);
                        setSelectedFile(recent.file);
                      }}
                    >
                      {recent.file}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <VirtualizedList
            items={filteredFiles}
            rowHeight={48}
            getKey={(item) => item}
            emptyState={selectedCategory ? 'No files match the filter' : 'Select a category first'}
            renderItem={(file) => (
              <FileRow
                file={file}
                active={selectedFile === file}
                onSelect={onFileSelect}
                onPrefetch={onFilePrefetch}
              />
            )}
          />
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Preview</h2>
              <Badge className="border-white/20 bg-white/5 text-[10px] text-slate-300" variant="outline">
                {selectedCategory && selectedFile ? `${selectedCategory}/${selectedFile}` : 'No file selected'}
              </Badge>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant={pixelPerfect ? 'default' : 'ghost'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setPixelPerfect((current) => !current)}
                >
                  Pixel Perfect
                </Button>
                <div className="flex rounded-md border border-white/15 bg-white/5 p-1">
                  <Button
                    size="sm"
                    variant={previewTab === 'parsed' ? 'default' : 'ghost'}
                    className="h-7 px-2 text-xs"
                    onClick={() => setPreviewTab('parsed')}
                  >
                    Parsed
                  </Button>
                  <Button
                    size="sm"
                    variant={previewTab === 'raw' ? 'default' : 'ghost'}
                    className="h-7 px-2 text-xs"
                    onClick={() => setPreviewTab('raw')}
                  >
                    Raw JSON
                  </Button>
                </div>

                {filePayload?.sourceUrl && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/20 bg-white/5 px-2 text-xs"
                      onClick={() => void copyText(filePayload.sourceUrl!)}
                    >
                      {copiedValue === filePayload.sourceUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <a href={filePayload.sourceUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="h-7 border-white/20 bg-white/5 px-2 text-xs">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Open
                      </Button>
                    </a>
                  </>
                )}
              </div>
            </div>

            {shareUrl && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>Share:</span>
                <a href={shareUrl} target="_blank" rel="noreferrer" className="truncate text-cyan-300 hover:underline">
                  {shareUrl}
                </a>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => void copyText(shareUrl)}
                >
                  {copiedValue === shareUrl ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 p-3">
            {!selectedCategory || !selectedFile ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-white/15 text-sm text-slate-400">
                Select a category and file to preview.
              </div>
            ) : loadingFile ? (
              <div className="flex h-full items-center justify-center rounded-md border border-white/10 bg-black/20">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
              </div>
            ) : fileError ? (
              <div className="flex h-full items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-300">
                {fileError}
              </div>
            ) : previewTab === 'raw' ? (
              <Card className="h-full border-white/15 bg-black/20">
                <CardContent className="h-full overflow-auto p-0">
                  <pre className="min-h-full p-3 text-xs leading-5 text-slate-200">
                    <code>{rawJson}</code>
                  </pre>
                </CardContent>
              </Card>
            ) : (
              <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="h-full min-h-0 overflow-hidden border-white/15 bg-black/20 xl:flex xl:flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Parsed Items</CardTitle>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <Input
                        value={parsedSearch}
                        onChange={(event) => setParsedSearch(event.target.value)}
                        placeholder="Search parsed"
                        className="h-8 border-white/15 bg-black/20 pl-8 text-xs"
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      {filteredParsedItems.length} / {parsedItems.length} items
                    </p>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-0">
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      {parsedListRows.length === 0 ? (
                        <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-slate-400">
                          No parsed rows
                        </div>
                      ) : (
                        <div className="space-y-1 pb-1">
                          {pagedParsedRows.map(({ item, displayTitle, displayId }) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedParsedId(item.id)}
                              className={cn(
                                'flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left transition-colors',
                                selectedParsedId === item.id
                                  ? 'border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100'
                                  : 'border-transparent bg-muted/20 hover:border-border hover:bg-muted/40'
                              )}
                            >
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium leading-5">{displayTitle}</div>
                                <div className="truncate text-[11px] text-slate-400">{displayId}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-slate-400">
                      <span>
                        {parsedRangeStart}-{parsedRangeEnd} of {parsedListRows.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setParsedPage((current) => Math.max(1, current - 1))}
                          disabled={safeParsedPage <= 1}
                        >
                          Prev
                        </Button>
                        <span className="px-1">
                          Page {safeParsedPage}/{parsedTotalPages}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setParsedPage((current) => Math.min(parsedTotalPages, current + 1))}
                          disabled={safeParsedPage >= parsedTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="h-full min-h-0 overflow-hidden border-white/15 bg-black/20 xl:flex xl:flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Item Detail</CardTitle>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-auto pb-4">
                    {!selectedParsedItem ? (
                      <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-slate-400">
                        Select an item from the parsed list.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-semibold">{selectedParsedDisplayTitle}</h3>
                          <p className="text-xs text-slate-400">ID: {selectedParsedItem.id}</p>
                        </div>

                        {hasImagePreview && selectedImageEntry && selectedImageSrc && (
                          <div className="overflow-hidden rounded-md border border-white/10 bg-black/30">
                            <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 text-[11px] text-slate-300">
                              <span>
                                Image {safeSelectedImageIndex + 1}/{parsedItemImageEntries.length}
                              </span>
                              {parsedItemImageEntries.length > 1 && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs"
                                    onClick={() =>
                                      setSelectedImageIndex((current) =>
                                        current <= 0 ? parsedItemImageEntries.length - 1 : current - 1
                                      )
                                    }
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs"
                                    onClick={() =>
                                      setSelectedImageIndex((current) =>
                                        current >= parsedItemImageEntries.length - 1 ? 0 : current + 1
                                      )
                                    }
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            <div className="relative h-56 w-full">
                              {detailAssetFailed ? (
                                <div className="flex h-full items-center justify-center text-slate-500">
                                  <XCircle className="h-8 w-8" />
                                </div>
                              ) : (
                                <Image
                                  src={selectedImageSrc}
                                  alt={selectedParsedDisplayTitle}
                                  fill
                                  className="object-contain"
                                  style={pixelPerfect ? { imageRendering: 'pixelated' } : undefined}
                                  onError={() => {
                                    setSelectedImageSourceIndex((current) => {
                                      const next = current + 1;
                                      if (next < selectedImageEntry.sources.length) {
                                        return next;
                                      }
                                      setDetailAssetFailed(true);
                                      return current;
                                    });
                                  }}
                                  unoptimized
                                />
                              )}
                            </div>

                            <div className="flex items-center justify-between border-t border-white/10 px-2 py-1 text-[11px] text-slate-400">
                              <span className="truncate">{selectedImageEntry.path}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => void copyText(selectedImageSrc)}
                              >
                                {copiedValue === selectedImageSrc ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>

                            {parsedItemImageEntries.length > 1 && (
                              <div className="border-t border-white/10 px-2 py-2">
                                <div className="flex gap-1 overflow-x-auto">
                                  {parsedItemImageEntries.map((entry, index) => (
                                    <button
                                      key={entry.id}
                                      type="button"
                                      className={cn(
                                        'shrink-0 rounded border px-2 py-1 text-[10px] transition-colors',
                                        index === safeSelectedImageIndex
                                          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                                          : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                                      )}
                                      onClick={() => setSelectedImageIndex(index)}
                                    >
                                      {index + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {parsedItemBgmUrls.length > 0 && (
                          <div className="space-y-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-2">
                            <div className="flex items-center justify-between">
                              <div className="inline-flex items-center gap-2">
                                <Music className="h-4 w-4 text-emerald-300" />
                                <p className="text-sm font-semibold text-emerald-100">BGM Preview</p>
                              </div>
                              <Badge variant="secondary" className="h-5 text-[10px]">
                                {validatedBgmUrls.length}
                              </Badge>
                            </div>
                            {bgmValidationLoading ? (
                              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-2 text-xs text-slate-300">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                                Validating BGM URLs...
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {validatedBgmUrls.map((bgmUrl) => (
                                  <div key={bgmUrl} className="rounded-md border border-white/10 bg-black/25 p-2">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <span className="truncate text-[11px] text-slate-400">{bgmUrl}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => void copyText(bgmUrl)}
                                      >
                                        {copiedValue === bgmUrl ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                    <AudioPlayer src={bgmUrl} />
                                  </div>
                                ))}
                              </div>
                            )}
                            {invalidBgmUrls.length > 0 && (
                              <p className="text-[11px] text-amber-200/90">
                                {invalidBgmUrls.length} BGM URL(s) not found on CDN and skipped.
                              </p>
                            )}
                            {!bgmValidationLoading && validatedBgmUrls.length === 0 && (
                              <p className="text-[11px] text-slate-300">No playable BGM URL found for this item.</p>
                            )}
                          </div>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(selectedParsedItem.data).map(([key, value]) => (
                            <div key={key} className="rounded-md border border-white/10 bg-black/25 p-2 text-xs">
                              <p className="mb-1 font-semibold text-slate-300">{key}</p>
                              <p className="break-all font-mono text-slate-200">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-white/10 bg-black/25 px-4 py-1 text-[11px] text-slate-500">
        {filePayload ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <FileJson className="h-3.5 w-3.5" />
              {filePayload.category}/{filePayload.file}.json
            </span>
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" />
              {parsedItems.length} parsed rows
            </span>
            <span className="inline-flex items-center gap-1">
              <Music className="h-3.5 w-3.5" />
              Cached reads active
            </span>
          </div>
        ) : (
          <span>No file loaded</span>
        )}
      </div>
    </div>
  );
}
