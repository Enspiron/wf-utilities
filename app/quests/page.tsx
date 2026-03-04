"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import AudioPlayer from "@/components/AudioPlayer";
import { parseOrderedMapJson, ParsedItem } from "@/lib/json-parser";
import { ExternalLink, ImageOff, Loader2, Search, Sparkles } from "lucide-react";
import Image from "next/image";

const MODE_OPTIONS = [
  { value: "all", label: "All Quests" },
  { value: "main", label: "Main Story" },
  { value: "character", label: "Character" },
  { value: "event", label: "Events" },
] as const;

type QuestMode = (typeof MODE_OPTIONS)[number]["value"];
const ITEMS_PER_PAGE = 48;

const CDN_ROOT = "https://wfjukebox.b-cdn.net";
const MUSIC_CDN_ROOT = "https://wfjukebox.b-cdn.net/music";
const BGM_PATH_RE = /\/?bgm\/[A-Za-z0-9._/-]+/gi;

const hasImageExtension = (s: string) => /\.(png|jpe?g|webp|svg|gif)$/i.test(s);

const buildImageUrl = (s?: string) => {
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const path = s.startsWith("/") ? s.slice(1) : s;
  return `${CDN_ROOT}/${hasImageExtension(path) ? path : `${path}.png`}`;
};

const buildAudioUrl = (s?: string) => {
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const path = s.startsWith("/") ? s.slice(1) : s;
  return /\.mp3$/i.test(path) ? `${CDN_ROOT}/${path}` : `${CDN_ROOT}/${path}.mp3`;
};

const buildAudioFallbackUrls = (pathValue: string) => {
  const path = normalizeAssetPath(pathValue).replace(/\.mp3$/i, "");
  const result: string[] = [buildAudioUrl(path)];

  if (path.startsWith("bgm/world_")) {
    result.push(`${MUSIC_CDN_ROOT}/StoryBGM/${path.replace(/^bgm\//, "")}.mp3`);
  } else if (path.startsWith("bgm/event/")) {
    result.push(`${MUSIC_CDN_ROOT}/${path.replace(/^bgm\//, "")}.mp3`);
  } else if (path.startsWith("bgm/common/")) {
    result.push(`${MUSIC_CDN_ROOT}/${path.replace(/^bgm\//, "")}.mp3`);
  } else if (path.startsWith("bgm/")) {
    result.push(`${MUSIC_CDN_ROOT}/${path.replace(/^bgm\//, "")}.mp3`);
  }

  return Array.from(new Set(result.filter(Boolean)));
};

const extractBgmTokens = (input: string) => {
  const matches = input.match(BGM_PATH_RE) || [];
  return matches
    .map((token) => token.replace(/[),.;]+$/, "").trim())
    .filter((token) => Boolean(token));
};

const getSourceFile = (item: ParsedItem) => {
  const source = item.data._sourceFile;
  return typeof source === "string" && source ? source : "unknown";
};

const getQuestType = (sourceFile: string): Exclude<QuestMode, "all"> => {
  if (sourceFile.includes("main")) return "main";
  if (sourceFile.includes("character")) return "character";
  return "event";
};

const matchesMode = (item: ParsedItem, mode: QuestMode) => {
  if (mode === "all") return true;
  const source = getSourceFile(item);
  if (mode === "main") return source.includes("main");
  if (mode === "character") return source.includes("character");
  return (
    source.includes("event") ||
    source.includes("ex_") ||
    source.includes("advent") ||
    source.includes("story_event")
  );
};

const matchesSearch = (item: ParsedItem, query: string) => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (item.label.toLowerCase().includes(q)) return true;
  if (item.id.toLowerCase().includes(q)) return true;
  return Object.values(item.data).some((v) => String(v).toLowerCase().includes(q));
};

const getLongDescription = (item: ParsedItem) => {
  const values = Object.values(item.data).filter((v) => typeof v === "string") as string[];
  return values.find((v) => v.length > 80 && !v.includes("/"));
};

const normalizeAssetPath = (value: string) => value.trim().replace(/^\/+/, "");

const resemblesDirectoryPath = (value: string) => {
  if (!value || value.includes(" ")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  const normalized = normalizeAssetPath(value);
  const segments = normalized.split("/").filter(Boolean);
  return segments.length >= 2;
};

const isLikelyImagePath = (value: string) => {
  if (!value || value.includes(" ")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  return (
    resemblesDirectoryPath(value) &&
    !value.startsWith("bgm/") &&
    !value.startsWith("voice/") &&
    !value.startsWith("se/")
  );
};

const toAlternateAssetPath = (value: string) => {
  if (value.includes("quest/thumbnail/")) return value.replace("quest/thumbnail/", "quest/");
  if (value.startsWith("quest/") && !value.startsWith("quest/thumbnail/")) {
    return value.replace(/^quest\//, "quest/thumbnail/");
  }
  return "";
};

const collectDirectoryLikeStrings = (value: unknown, out: Set<string>) => {
  if (typeof value === "string") {
    if (resemblesDirectoryPath(value)) out.add(normalizeAssetPath(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectDirectoryLikeStrings(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectDirectoryLikeStrings(v, out);
  }
};

const collectBgmPaths = (value: unknown, out: Set<string>) => {
  if (typeof value === "string") {
    const tokens = extractBgmTokens(value);
    for (const token of tokens) {
      const normalized = normalizeAssetPath(token);
      if (normalized.startsWith("bgm/")) out.add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectBgmPaths(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectBgmPaths(v, out);
  }
};

const getImageCandidates = (item: ParsedItem) => {
  const rawCandidates: string[] = [];
  if (item.imageUrl) rawCandidates.push(item.imageUrl);

  const field2 = typeof item.data.field_2 === "string" ? item.data.field_2 : "";
  const field1 = typeof item.data.field_1 === "string" ? item.data.field_1 : "";
  if (field2) rawCandidates.push(field2);
  if (field1) rawCandidates.push(field1);

  const directoryLikeValues = new Set<string>();
  collectDirectoryLikeStrings(item.data, directoryLikeValues);
  for (const pathValue of directoryLikeValues) {
    if (isLikelyImagePath(pathValue)) rawCandidates.push(pathValue);
  }

  for (const value of Object.values(item.data)) {
    if (typeof value === "string" && isLikelyImagePath(value)) rawCandidates.push(value);
  }

  const urls = new Set<string>();
  for (const candidate of rawCandidates) {
    if (!candidate) continue;
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      urls.add(candidate);
      continue;
    }
    const normalized = normalizeAssetPath(candidate);
    urls.add(buildImageUrl(normalized));
    const alternate = toAlternateAssetPath(normalized);
    if (alternate) urls.add(buildImageUrl(alternate));
  }

  return [...urls];
};

const getBgmCandidates = (item: ParsedItem) => {
  const paths = new Set<string>();
  collectBgmPaths(item.data, paths);
  const urls = new Set<string>();
  for (const path of paths) {
    for (const url of buildAudioFallbackUrls(path)) {
      urls.add(url);
    }
  }
  return [...urls];
};

function MissingImagePlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground">
      <ImageOff className={compact ? "h-5 w-5" : "h-7 w-7"} />
      <span className={compact ? "mt-1 text-[10px]" : "mt-2 text-xs"}>No Artwork</span>
    </div>
  );
}

function QuestImage({
  item,
  alt,
  width,
  height,
  compact = false,
}: {
  item: ParsedItem;
  alt: string;
  width: number;
  height: number;
  compact?: boolean;
}) {
  const candidates = useMemo(() => getImageCandidates(item), [item]);
  const [index, setIndex] = useState(0);

  if (candidates.length === 0 || index >= candidates.length) {
    return <MissingImagePlaceholder compact={compact} />;
  }

  return (
    <Image
      src={candidates[index]}
      alt={alt}
      width={width}
      height={height}
      style={{ objectFit: "contain", imageRendering: "pixelated" }}
      unoptimized={true}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
}

function QuestImageGallery({ item }: { item: ParsedItem }) {
  const candidates = useMemo(() => getImageCandidates(item), [item]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl]);

  const visibleCandidates = candidates.filter((url) => !failedUrls.has(url));
  if (candidates.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Detected Images ({visibleCandidates.length}/{candidates.length})
      </p>

      {visibleCandidates.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visibleCandidates.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setPreviewUrl(url)}
              className="overflow-hidden rounded-md border bg-background/80 p-1 text-left transition hover:border-primary/40"
              title="Open large preview"
            >
              <div className="flex h-16 items-center justify-center rounded bg-muted/30">
                <Image
                  src={url}
                  alt="Quest asset"
                  width={88}
                  height={64}
                  unoptimized={true}
                  style={{ objectFit: "contain", imageRendering: "pixelated" }}
                  onError={() =>
                    setFailedUrls((prev) => {
                      if (prev.has(url)) return prev;
                      const next = new Set(prev);
                      next.add(url);
                      return next;
                    })
                  }
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No detected image URLs loaded successfully.
        </div>
      )}

      {failedUrls.size > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {failedUrls.size} candidate URL{failedUrls.size === 1 ? "" : "s"} failed to load.
        </p>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-3 sm:p-4">
          {previewUrl && (
            <>
              <DialogTitle className="sr-only">Quest Image Preview</DialogTitle>
              <DialogDescription className="sr-only">
                Full-size preview of the selected quest event image candidate.
              </DialogDescription>
              <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-md border bg-muted/20 p-2">
                {previewFailed ? (
                  <div className="flex h-[240px] w-full flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="mt-2 text-xs">Preview failed to load</span>
                  </div>
                ) : (
                  <Image
                    src={previewUrl}
                    alt="Quest image preview"
                    width={1400}
                    height={1000}
                    unoptimized={true}
                    className="h-auto max-h-[76vh] w-auto max-w-full object-contain"
                    onError={() => setPreviewFailed(true)}
                  />
                )}
              </div>
              <p className="mt-2 break-all text-xs text-muted-foreground">{previewUrl}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestAudio({ item }: { item: ParsedItem }) {
  const candidates = useMemo(() => getBgmCandidates(item), [item]);
  const [index, setIndex] = useState(0);

  if (candidates.length === 0 || index >= candidates.length) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        BGM Preview ({index + 1}/{candidates.length})
      </p>
      <AudioPlayer src={candidates[index]} onError={() => setIndex((prev) => prev + 1)} />
      <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{candidates[index]}</p>
    </div>
  );
}

export default function QuestViewerPage() {
  const [mode, setMode] = useState<QuestMode>("all");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [containsBgmOnly, setContainsBgmOnly] = useState(false);
  const [containsImageOnly, setContainsImageOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ParsedItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const loadQuests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const listResponse = await fetch("/api/quests/list?lang=en");
      const listData = await listResponse.json();
      const files: string[] = Array.isArray(listData.files) ? listData.files : [];
      const allItems: ParsedItem[] = [];

      await Promise.all(
        files.map(async (f) => {
          try {
            const resp = await fetch(
              `/api/orderedmap/data?category=quest&file=${encodeURIComponent(f)}&lang=en`
            );
            if (!resp.ok) return;
            const payload = await resp.json();
            const parsed = parseOrderedMapJson(payload.data, "quest");
            if (Array.isArray(parsed)) {
              parsed.forEach((p) => {
                p.data._sourceFile = f;
                allItems.push(p);
              });
            }
          } catch (e) {
            console.error("failed to load", f, e);
          }
        })
      );

      setItems(allItems);
    } catch (err) {
      console.error("failed to list quest files", err);
      setError("Could not load quest data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuests();
  }, [loadQuests]);

  useEffect(() => {
    if (!selectedItem) return;
    const stillExists = items.some(
      (item) => item.id === selectedItem.id && getSourceFile(item) === getSourceFile(selectedItem)
    );
    if (!stillExists) setSelectedItem(null);
  }, [items, selectedItem]);

  const bgmLookup = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of items) {
      const key = `${item.id}::${getSourceFile(item)}`;
      map.set(key, getBgmCandidates(item).length > 0);
    }
    return map;
  }, [items]);

  const imageLookup = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of items) {
      const key = `${item.id}::${getSourceFile(item)}`;
      map.set(key, getImageCandidates(item).length > 0);
    }
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!matchesSearch(item, search)) return false;
      if (!matchesMode(item, mode)) return false;
      const key = `${item.id}::${getSourceFile(item)}`;
      if (containsBgmOnly && bgmLookup.get(key) !== true) return false;
      if (containsImageOnly && imageLookup.get(key) !== true) return false;
      return true;
    });
    return filtered.sort((a, b) => a.label.localeCompare(b.label));
  }, [items, search, mode, containsBgmOnly, containsImageOnly, bgmLookup, imageLookup]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, safeCurrentPage]);

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(nextPage);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const stats = useMemo(() => {
    const main = items.filter((item) => getQuestType(getSourceFile(item)) === "main").length;
    const character = items.filter((item) => getQuestType(getSourceFile(item)) === "character").length;
    const event = items.filter((item) => getQuestType(getSourceFile(item)) === "event").length;
    return { total: items.length, main, character, event };
  }, [items]);

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <Dialog
          open={!!selectedItem}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
        >
          <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:max-h-[85vh] sm:w-full sm:p-6">
            {selectedItem && (
              <>
                <DialogTitle className="pr-8 text-base sm:text-xl">{selectedItem.label}</DialogTitle>
                <DialogDescription className="sr-only">
                  Quest details including source file and parsed data fields.
                </DialogDescription>
                <div className="grid gap-4 pt-1 md:grid-cols-[180px_minmax(0,1fr)] md:gap-5">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex h-32 items-center justify-center rounded-md bg-background sm:h-40">
                      <QuestImage
                        key={`${selectedItem.id}-${getSourceFile(selectedItem)}-dialog`}
                        item={selectedItem}
                        alt={selectedItem.label}
                        width={160}
                        height={160}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{getQuestType(getSourceFile(selectedItem))}</Badge>
                      <Badge variant="outline" className="max-w-full truncate">
                        {selectedItem.id}
                      </Badge>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Source File</p>
                      <p className="break-all font-mono text-xs">{getSourceFile(selectedItem)}</p>
                    </div>
                    <QuestImageGallery key={`${selectedItem.id}-${getSourceFile(selectedItem)}-gallery`} item={selectedItem} />
                    <QuestAudio key={`${selectedItem.id}-${getSourceFile(selectedItem)}-audio`} item={selectedItem} />
                    {getLongDescription(selectedItem) ? (
                      <div className="rounded-md border bg-muted/20 p-3 text-sm leading-6">
                        {getLongDescription(selectedItem)}
                      </div>
                    ) : (
                      <pre className="max-h-56 overflow-auto rounded-md border bg-muted/20 p-3 text-xs sm:max-h-64">
                        {JSON.stringify(selectedItem.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background sm:mb-5">
          <CardContent className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold sm:text-3xl">
                  <Sparkles className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                  Quest Viewer
                </h1>
                <p className="text-sm text-muted-foreground">
                  Browse, filter, and inspect quest data across story, character, and event files.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{stats.total} total</Badge>
                <Badge variant="secondary">{stats.main} main</Badge>
                <Badge variant="secondary">{stats.character} character</Badge>
                <Badge variant="secondary">{stats.event} event</Badge>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search quests by name, id, or any field..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 pl-9"
                />
              </div>
              {loading && (
                <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground md:justify-self-end">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading quest files...
                </div>
              )}
            </div>

            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                {MODE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={mode === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMode(option.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-full px-3 sm:px-4"
                  >
                    {option.label}
                    {option.value === "all" ? ` (${stats.total})` : ""}
                    {option.value === "main" ? ` (${stats.main})` : ""}
                    {option.value === "character" ? ` (${stats.character})` : ""}
                    {option.value === "event" ? ` (${stats.event})` : ""}
                  </Button>
                ))}
                <Button
                  variant={containsBgmOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setContainsBgmOnly((prev) => !prev);
                    setCurrentPage(1);
                  }}
                  className="rounded-full px-3 sm:px-4"
                >
                  Contains BGM
                </Button>
                <Button
                  variant={containsImageOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setContainsImageOnly((prev) => !prev);
                    setCurrentPage(1);
                  }}
                  className="rounded-full px-3 sm:px-4"
                >
                  Contians Image
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && !loading && (
          <Card className="mb-4 border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={loadQuests}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, idx) => (
              <Card key={idx} className="border-dashed">
                <CardContent className="p-4">
                  <div className="mb-3 h-24 animate-pulse rounded-md bg-muted/70" />
                  <div className="mb-2 h-4 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted/60" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center sm:py-16">
              <Search className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No quests matched your filters</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Try a broader search or switch to a different quest type filter.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setMode("all");
                  setContainsBgmOnly(false);
                  setContainsImageOnly(false);
                  setCurrentPage(1);
                }}
              >
                Reset Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div ref={resultsRef} className="mb-3 text-sm text-muted-foreground">
              Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}-
              {Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} quests
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {paginatedItems.map((item) => {
                const sourceFile = getSourceFile(item);
                const type = getQuestType(sourceFile);
                const hasBgm = bgmLookup.get(`${item.id}::${sourceFile}`) === true;

                return (
                  <Card
                    key={`${item.id}-${sourceFile}`}
                    className="group overflow-hidden border transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <CardContent className="p-0">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="mb-3 flex h-24 items-center justify-center rounded-md bg-gradient-to-b from-muted/60 to-muted/30">
                          <QuestImage
                            key={`${item.id}-${sourceFile}-card`}
                            item={item}
                            alt={item.label}
                            width={96}
                            height={96}
                            compact
                          />
                        </div>

                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline" className="px-2 py-0 text-[10px] uppercase">
                            {type}
                          </Badge>
                          {hasBgm && (
                            <Badge variant="secondary" className="px-2 py-0 text-[10px] uppercase">
                              Contains BGM
                            </Badge>
                          )}
                        </div>

                        <p className="mb-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5">{item.label}</p>
                        <p className="mb-3 truncate text-[11px] text-muted-foreground">{sourceFile}</p>

                        <div className="flex items-center text-xs text-primary opacity-80 transition group-hover:opacity-100">
                          View details
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </div>
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
        {totalPages > 1 && !loading && filteredItems.length > 0 && (
          <div className="border-t bg-background/95 px-3 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => goToPage(1)} disabled={safeCurrentPage === 1}>
                First
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToPage(safeCurrentPage - 1)}
                disabled={safeCurrentPage === 1}
              >
                Prev
              </Button>
              <div className="px-2 text-sm text-muted-foreground">
                Page {safeCurrentPage} of {totalPages}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToPage(safeCurrentPage + 1)}
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
