"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  BookOpenText,
  Calendar,
  Clipboard,
  ChevronDown,
  Database,
  ExternalLink,
  FileJson,
  Home,
  Keyboard,
  Menu,
  Music2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

type QuickJumpGroup = 'Navigation' | 'Data' | 'Actions';

type QuickJumpEntry = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  group: QuickJumpGroup;
  keywords: string[];
  external?: boolean;
  imageCandidates?: string[];
  imagePixelated?: boolean;
};

type QuickJumpResult = QuickJumpEntry & { score: number };

type CharacterSearchRow = {
  id?: string;
  faceCode?: string;
  nameEN?: string;
  nameJP?: string;
  subNameEN?: string;
  subNameJP?: string;
};

type ItemSearchRow = {
  id?: string;
  devname?: string;
  name?: string;
  category?: string;
  type?: 'item' | 'equipment';
  icon?: string;
  thumbnail?: string;
};

const HOME_ITEM: NavItem = { href: '/', label: 'Home', icon: Home };
const SAVE_EDITOR_ITEM: NavItem = { href: '/save-editor', label: 'Save Editor', icon: FileJson };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Game Data',
    icon: Database,
    items: [
      { href: '/characters', label: 'Characters', icon: Database },
      { href: '/items', label: 'Items', icon: Package },
      { href: '/quests', label: 'Quests', icon: FileJson },
    ],
  },
  {
    label: 'Events',
    icon: Calendar,
    items: [
      { href: '/calendar', label: 'Calendar', icon: Calendar },
      { href: '/gacha', label: 'Gacha', icon: Ticket },
    ],
  },
  {
    label: 'Tools',
    icon: Wrench,
    items: [
      { href: '/manaboard', label: 'Mana Board', icon: Sparkles },
      { href: '/orderedmap', label: 'OrderedMap', icon: FileJson },
      { href: '/orderedmap-v2', label: 'OrderedMap V2', icon: FileJson },
      { href: '/exboost', label: 'EX Boost', icon: Sparkles },
      { href: '/share', label: 'Share', icon: FileJson },
    ],
  },
  {
    label: 'Media',
    icon: User,
    items: [
      { href: '/facebuilder', label: 'Face Builder', icon: User },
      { href: '/music', label: 'Music', icon: Music2 },
      { href: '/comics', label: 'Comics', icon: BookOpenText },
    ],
  },
];

const QUICK_JUMP_GROUP_ORDER: QuickJumpGroup[] = ['Navigation', 'Data', 'Actions'];
const WF_CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const QUICK_JUMP_KEYWORDS: Record<string, string[]> = {
  '/': ['home', 'dashboard', 'overview'],
  '/save-editor': ['save', 'json', 'editor', 'account'],
  '/characters': ['characters', 'units', 'roster'],
  '/items': ['items', 'equipment', 'materials', 'weapons'],
  '/quests': ['quests', 'story', 'missions'],
  '/calendar': ['calendar', 'events', 'schedule'],
  '/gacha': ['gacha', 'banner', 'odds'],
  '/manaboard': ['mana', 'board', 'nodes'],
  '/orderedmap': ['orderedmap', 'datalist', 'json'],
  '/orderedmap-v2': ['orderedmap v2', 'parsed', 'explorer'],
  '/exboost': ['ex boost', 'boost'],
  '/share': ['share', 'embed', 'meta'],
  '/facebuilder': ['face', 'builder', 'portrait'],
  '/music': ['music', 'bgm', 'audio'],
  '/comics': ['comics', 'episodes'],
};

function getQuickJumpScore(entry: QuickJumpEntry, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  const title = entry.title.toLowerCase();
  const subtitle = entry.subtitle.toLowerCase();
  const keywords = entry.keywords.map((token) => token.toLowerCase());
  const searchBlob = `${title} ${subtitle} ${keywords.join(' ')}`;

  if (title === query) return 160;
  if (keywords.includes(query)) return 140;
  if (title.startsWith(query)) return 120;
  if (keywords.some((keyword) => keyword.startsWith(query))) return 100;
  if (title.includes(query)) return 90;
  if (subtitle.includes(query)) return 70;
  if (searchBlob.includes(query)) return 50;
  return -1;
}

function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(value);
}

function toCdnAssetUrl(value?: string): string {
  const token = (value || '').trim();
  if (!token) return '';
  if (token.startsWith('http://') || token.startsWith('https://')) return token;
  const normalized = token.replace(/^\/+/, '');
  if (!normalized) return '';
  return `${WF_CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
}

function getItemImageCandidates(row: ItemSearchRow): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const raw of [row.thumbnail, row.icon]) {
    const url = toCdnAssetUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push(url);
  }

  return candidates;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href;
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isActivePath(pathname, item.href));
}

function QuickJumpEntryVisual({ entry }: { entry: QuickJumpEntry }) {
  const [imageIndex, setImageIndex] = useState(0);
  const candidates = entry.imageCandidates || [];
  const candidateKey = candidates.join('|');
  const EntryIcon = entry.icon;

  useEffect(() => {
    setImageIndex(0);
  }, [entry.id, candidateKey]);

  const activeImage = imageIndex < candidates.length ? candidates[imageIndex] : '';

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background/70">
      {activeImage ? (
        <Image
          src={activeImage}
          alt={entry.title}
          width={32}
          height={32}
          className={cn(
            'h-full w-full object-contain',
            entry.imagePixelated ? '[image-rendering:pixelated]' : '[image-rendering:auto]'
          )}
          unoptimized={true}
          onError={() => setImageIndex((current) => current + 1)}
        />
      ) : (
        <EntryIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState('');
  const [quickJumpSelectedIndex, setQuickJumpSelectedIndex] = useState(0);
  const quickJumpInputRef = useRef<HTMLInputElement | null>(null);
  const [searchDataStatus, setSearchDataStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [searchDataError, setSearchDataError] = useState<string | null>(null);
  const [characterRows, setCharacterRows] = useState<CharacterSearchRow[]>([]);
  const [itemRows, setItemRows] = useState<ItemSearchRow[]>([]);

  const navigationEntries = useMemo<QuickJumpEntry[]>(() => {
    const base: Array<NavItem & { subtitle: string }> = [
      { ...HOME_ITEM, subtitle: 'Landing dashboard and command center' },
      { ...SAVE_EDITOR_ITEM, subtitle: 'Edit EN save JSON data' },
      ...NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, subtitle: group.label }))),
    ];

    return base.map((item) => ({
      id: `nav:${item.href}`,
      title: item.label,
      subtitle: item.subtitle,
      href: item.href,
      icon: item.icon,
      group: 'Navigation',
      keywords: [...(QUICK_JUMP_KEYWORDS[item.href] || []), item.label.toLowerCase(), item.href.replace('/', '')],
    }));
  }, []);

  const actionEntries = useMemo<QuickJumpEntry[]>(
    () => [
      {
        id: 'action:reload',
        title: 'Reload Current Page',
        subtitle: pathname,
        icon: RefreshCw,
        group: 'Actions',
        keywords: ['reload', 'refresh', 'page'],
        action: () => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        },
      },
      {
        id: 'action:copy-url',
        title: 'Copy Current URL',
        subtitle: pathname,
        icon: Clipboard,
        group: 'Actions',
        keywords: ['copy', 'url', 'link', 'share'],
        action: () => {
          if (typeof window === 'undefined' || !navigator?.clipboard) return;
          navigator.clipboard.writeText(window.location.href).catch(() => undefined);
        },
      },
      {
        id: 'action:new-tab',
        title: 'Open Current Page In New Tab',
        subtitle: pathname,
        icon: ExternalLink,
        group: 'Actions',
        keywords: ['open', 'new tab', 'external'],
        action: () => {
          if (typeof window !== 'undefined') {
            window.open(window.location.href, '_blank', 'noopener,noreferrer');
          }
        },
      },
    ],
    [pathname]
  );

  const dataEntries = useMemo<QuickJumpEntry[]>(() => {
    const entries: QuickJumpEntry[] = [];

    for (const character of characterRows) {
      const faceCode = (character.faceCode || '').trim();
      if (!faceCode) continue;
      const nameEN = (character.nameEN || '').trim();
      const nameJP = (character.nameJP || '').trim();
      const subNameEN = (character.subNameEN || '').trim();
      const subNameJP = (character.subNameJP || '').trim();
      const title = nameEN || nameJP || faceCode;
      const subtitleName = nameEN && nameJP && nameEN !== nameJP ? ` | ${nameJP}` : '';

      entries.push({
        id: `char:${faceCode}`,
        title,
        subtitle: `Character | ${faceCode}${subtitleName}`,
        href: `/characters/${encodeURIComponent(faceCode)}`,
        icon: User,
        group: 'Data',
        keywords: [faceCode, nameEN, nameJP, subNameEN, subNameJP, 'character', 'unit']
          .map((token) => token.toLowerCase())
          .filter(Boolean),
        imagePixelated: false,
        imageCandidates: [
          `${WF_CDN_ROOT}/wfjukebox/character/character_art/${encodeURIComponent(faceCode)}/ui/square_0.png`,
          `${WF_CDN_ROOT}/wfjukebox/character/character_art/${encodeURIComponent(faceCode)}/ui/square_1.png`,
        ],
      });
    }

    for (const item of itemRows) {
      const itemId = (item.id || '').trim();
      const itemName = (item.name || '').trim();
      if (!itemId || !itemName) continue;
      const devname = (item.devname || '').trim();
      const category = (item.category || '').trim();
      const itemType = item.type === 'equipment' ? 'equipment' : 'item';
      const typeLabel = itemType === 'equipment' ? 'Equipment' : 'Item';

      entries.push({
        id: `${itemType}:${itemId}`,
        title: itemName,
        subtitle: `${typeLabel} | ID ${itemId}${category ? ` | ${category}` : ''}`,
        href: itemType === 'equipment' ? `/equip/${encodeURIComponent(itemId)}` : `/item/${encodeURIComponent(itemId)}`,
        icon: itemType === 'equipment' ? Wrench : Package,
        group: 'Data',
        keywords: [itemId, itemName, devname, category, typeLabel, itemType]
          .map((token) => token.toLowerCase())
          .filter(Boolean),
        imageCandidates: getItemImageCandidates(item),
        imagePixelated: true,
      });
    }

    return entries;
  }, [characterRows, itemRows]);

  const queryToken = quickJumpQuery.trim().toLowerCase();
  const showDataSearchResults = queryToken.length >= 2;

  const quickJumpEntries = useMemo<QuickJumpEntry[]>(
    () => [...navigationEntries, ...(showDataSearchResults ? dataEntries : []), ...actionEntries],
    [actionEntries, dataEntries, navigationEntries, showDataSearchResults]
  );

  const quickJumpResults = useMemo<QuickJumpResult[]>(() => {
    const query = quickJumpQuery.trim().toLowerCase();

    const scored = quickJumpEntries
      .map((entry) => ({ ...entry, score: getQuickJumpScore(entry, query) }))
      .filter((entry) => (query ? entry.score >= 0 : true));

    return scored.sort((a, b) => {
      const groupDiff =
        QUICK_JUMP_GROUP_ORDER.indexOf(a.group) - QUICK_JUMP_GROUP_ORDER.indexOf(b.group);
      if (groupDiff !== 0) return groupDiff;
      if (query && b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });
  }, [quickJumpEntries, quickJumpQuery]);

  const groupedQuickJumpResults = useMemo(() => {
    let runningIndex = 0;
    return QUICK_JUMP_GROUP_ORDER.map((group) => {
      const items = quickJumpResults
        .filter((result) => result.group === group)
        .map((result) => ({ ...result, resultIndex: runningIndex++ }));
      return { group, items };
    }).filter((group) => group.items.length > 0);
  }, [quickJumpResults]);

  const loadSearchData = useCallback(async () => {
    setSearchDataStatus('loading');
    setSearchDataError(null);

    try {
      const [charactersResponse, itemsResponse] = await Promise.all([
        fetch('/api/characters?lang=both', { cache: 'force-cache' }),
        fetch('/api/items', { cache: 'force-cache' }),
      ]);

      if (!charactersResponse.ok || !itemsResponse.ok) {
        throw new Error(`Search endpoints failed (${charactersResponse.status}/${itemsResponse.status})`);
      }

      const [charactersPayload, itemsPayload] = await Promise.all([charactersResponse.json(), itemsResponse.json()]);

      const nextCharacters = Array.isArray(charactersPayload?.characters) ? charactersPayload.characters : [];
      const nextItems = Array.isArray(itemsPayload?.items) ? itemsPayload.items : [];

      setCharacterRows(nextCharacters as CharacterSearchRow[]);
      setItemRows(nextItems as ItemSearchRow[]);
      setSearchDataStatus('ready');
    } catch (error) {
      console.error('Failed to preload global search data:', error);
      setSearchDataStatus('error');
      setSearchDataError('Failed to load character/item index.');
    }
  }, []);

  const runQuickJumpEntry = useCallback(
    (entry: QuickJumpEntry) => {
      setQuickJumpOpen(false);
      setQuickJumpQuery('');
      setQuickJumpSelectedIndex(0);
      setMobileMenuOpen(false);

      if (entry.action) {
        entry.action();
        return;
      }

      if (entry.href) {
        router.push(entry.href);
      }
    },
    [router]
  );

  const handleQuickJumpInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (quickJumpResults.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickJumpSelectedIndex((current) => (current + 1) % quickJumpResults.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickJumpSelectedIndex((current) =>
          current - 1 < 0 ? quickJumpResults.length - 1 : current - 1
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = quickJumpResults[quickJumpSelectedIndex];
        if (selected) {
          runQuickJumpEntry(selected);
        }
      }
    },
    [quickJumpResults, quickJumpSelectedIndex, runQuickJumpEntry]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuickJumpOpen((current) => !current);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!quickJumpOpen) return;
    if (searchDataStatus === 'idle') {
      void loadSearchData();
    }
  }, [loadSearchData, quickJumpOpen, searchDataStatus]);

  useEffect(() => {
    if (!quickJumpOpen) return;
    const timer = window.setTimeout(() => {
      quickJumpInputRef.current?.focus();
      quickJumpInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [quickJumpOpen]);

  useEffect(() => {
    if (!quickJumpOpen) return;
    setQuickJumpSelectedIndex(0);
  }, [quickJumpOpen, quickJumpQuery]);

  useEffect(() => {
    if (quickJumpSelectedIndex < quickJumpResults.length) return;
    setQuickJumpSelectedIndex(0);
  }, [quickJumpResults.length, quickJumpSelectedIndex]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-xl font-bold">WF</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold">World Flipper Tools</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href={HOME_ITEM.href}
              onClick={() => setQuickJumpOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActivePath(pathname, HOME_ITEM.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <HOME_ITEM.icon className="h-4 w-4" />
              {HOME_ITEM.label}
            </Link>
            <Link
              href={SAVE_EDITOR_ITEM.href}
              onClick={() => setQuickJumpOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActivePath(pathname, SAVE_EDITOR_ITEM.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <SAVE_EDITOR_ITEM.icon className="h-4 w-4" />
              {SAVE_EDITOR_ITEM.label}
            </Link>

            {NAV_GROUPS.map((group) => {
              const groupActive = isGroupActive(pathname, group);
              const GroupIcon = group.icon;

              return (
                <DropdownMenu key={group.label} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 gap-1.5 px-3 text-sm",
                        groupActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <GroupIcon className="h-4 w-4" />
                      {group.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemActive = isActivePath(pathname, item.href);
                      return (
                        <DropdownMenuItem key={item.href} asChild className={itemActive ? 'bg-accent font-medium' : ''}>
                          <Link href={item.href} onClick={() => setQuickJumpOpen(false)}>
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 lg:inline-flex"
              onClick={() => setQuickJumpOpen(true)}
            >
              <Search className="h-4 w-4" />
              Quick Jump
              <span className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl+K</span>
            </Button>

            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t py-4 md:hidden">
            <div className="space-y-4">
              <Link
                href={HOME_ITEM.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActivePath(pathname, HOME_ITEM.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <HOME_ITEM.icon className="h-4 w-4" />
                {HOME_ITEM.label}
              </Link>
              <Link
                href={SAVE_EDITOR_ITEM.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActivePath(pathname, SAVE_EDITOR_ITEM.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <SAVE_EDITOR_ITEM.icon className="h-4 w-4" />
                {SAVE_EDITOR_ITEM.label}
              </Link>

              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          itemActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <ItemIcon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={quickJumpOpen}
        onOpenChange={(open) => {
          setQuickJumpOpen(open);
          if (!open) {
            setQuickJumpQuery('');
            setQuickJumpSelectedIndex(0);
          }
        }}
      >
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Global Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search navigation targets and quick actions.
          </DialogDescription>

          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={quickJumpInputRef}
                value={quickJumpQuery}
                onChange={(event) => setQuickJumpQuery(event.target.value)}
                onKeyDown={handleQuickJumpInputKeyDown}
                placeholder="Search pages, tools, and actions..."
                className="h-10 pl-9 pr-10"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <Keyboard className="mr-1 h-3 w-3" />
                Enter
              </div>
            </div>
            {queryToken.length > 0 && queryToken.length < 2 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Type at least 2 characters to search characters/items.
              </p>
            )}
            {showDataSearchResults && searchDataStatus === 'loading' && (
              <p className="mt-2 text-xs text-muted-foreground">Loading global data index...</p>
            )}
            {searchDataStatus === 'error' && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-destructive">{searchDataError || 'Failed to load search data.'}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    void loadSearchData();
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          {quickJumpResults.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for "{quickJumpQuery}".
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 p-2">
                {groupedQuickJumpResults.map((group) => (
                  <div key={group.group} className="space-y-1.5">
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.group}
                    </p>
                    {group.items.map((entry) => {
                      const selected = entry.resultIndex === quickJumpSelectedIndex;
                      const activePath = entry.href ? isActivePath(pathname, entry.href) : false;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => runQuickJumpEntry(entry)}
                          onMouseEnter={() => setQuickJumpSelectedIndex(entry.resultIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-transparent hover:border-border hover:bg-accent/40"
                          )}
                        >
                          <QuickJumpEntryVisual entry={entry} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{entry.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{entry.subtitle}</p>
                          </div>
                          {activePath && (
                            <span className="rounded border border-primary/50 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Current
                            </span>
                          )}
                          {entry.action && (
                            <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              Action
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </nav>
  );
}

