"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  BookOpenText,
  Calendar,
  Clipboard,
  ChevronDown,
  Clapperboard,
  Database,
  ExternalLink,
  FileJson,
  Film,
  Home,
  Keyboard,
  Menu,
  Music2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { PageTranslateButton } from '@/components/page-translate-button';
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
import navbarConfig from '@/config/navbar.json';
import type { SearchApiResult, SearchHighlightPart } from '@/lib/search/core';
import { SITE_LOGO_ALT, SITE_LOGO_SRC, SITE_NAME } from '@/lib/site-brand';
import { cn } from '@/lib/utils';

type NavbarItemId =
  | 'home'
  | 'save-editor'
  | 'profile'
  | 'community'
  | 'community-new'
  | 'saves'
  | 'community-moderation'
  | 'login'
  | 'register'
  | 'characters'
  | 'items'
  | 'quests'
  | 'abilities'
  | 'achievements'
  | 'calendar'
  | 'calendar-v2'
  | 'feature-timeline'
  | 'gacha'
  | 'manaboard'
  | 'orderedmap'
  | 'exboost'
  | 'fixed-party'
  | 'share'
  | 'facebuilder'
  | 'scenes'
  | 'sprite-sheets'
  | 'music'
  | 'voicedb'
  | 'comics';

type NavbarGroupId = 'community' | 'game-data' | 'events' | 'tools' | 'media';

type NavItem = {
  id: NavbarItemId;
  href: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  id: NavbarGroupId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

type QuickJumpGroup = 'Navigation' | 'Characters' | 'Items' | 'Quests' | 'Systems' | 'Actions';

type QuickJumpActionEntry = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  group: 'Actions';
  action: () => void;
};

type QuickJumpRenderableEntry =
  | (SearchApiResult & {
      icon: React.ComponentType<{ className?: string }>;
      resultIndex?: number;
      mode: 'result';
    })
  | (QuickJumpActionEntry & {
      resultIndex?: number;
      mode: 'action';
    });

type NavbarVisibilityConfig = {
  topLevel: Record<'home' | 'save-editor', boolean>;
  groups: Record<NavbarGroupId, {
    visible: boolean;
    items: Record<string, boolean>;
  }>;
};

const NAVBAR_CONFIG = navbarConfig as NavbarVisibilityConfig;

const NAV_ITEM_DEFINITIONS: Record<NavbarItemId, NavItem> = {
  'home': { id: 'home', href: '/', label: 'Home', subtitle: 'Landing dashboard and command center', icon: Home },
  'save-editor': { id: 'save-editor', href: '/save-editor', label: 'Save Editor', subtitle: 'Edit EN save JSON data', icon: FileJson },
  'profile': { id: 'profile', href: '/profile', label: 'Profile', subtitle: 'Community', icon: User },
  'community': { id: 'community', href: '/community', label: 'Community Feed', subtitle: 'Community', icon: Clipboard },
  'community-new': { id: 'community-new', href: '/community/new', label: 'Submit Team', subtitle: 'Community', icon: Sparkles },
  'saves': { id: 'saves', href: '/saves', label: 'Save Shares', subtitle: 'Community', icon: FileJson },
  'community-moderation': { id: 'community-moderation', href: '/community/moderation', label: 'Moderation', subtitle: 'Community', icon: Wrench },
  'login': { id: 'login', href: '/login', label: 'Login', subtitle: 'Community', icon: User },
  'register': { id: 'register', href: '/register', label: 'Register', subtitle: 'Community', icon: User },
  'characters': { id: 'characters', href: '/characters', label: 'Characters', subtitle: 'Game Data', icon: Database },
  'items': { id: 'items', href: '/items', label: 'Items', subtitle: 'Game Data', icon: Package },
  'quests': { id: 'quests', href: '/quests', label: 'Quests', subtitle: 'Game Data', icon: FileJson },
  'abilities': { id: 'abilities', href: '/abilities', label: 'Abilities', subtitle: 'Game Data', icon: Zap },
  'achievements': { id: 'achievements', href: '/achievements', label: 'Achievements', subtitle: 'Game Data', icon: Trophy },
  'calendar': { id: 'calendar', href: '/calendar', label: 'Calendar', subtitle: 'Events', icon: Calendar },
  'calendar-v2': { id: 'calendar-v2', href: '/calendar-v2', label: 'Calendar V2', subtitle: 'Events', icon: Calendar },
  'feature-timeline': { id: 'feature-timeline', href: '/feature-timeline', label: 'Feature Timeline', subtitle: 'Events', icon: Sparkles },
  'gacha': { id: 'gacha', href: '/gacha', label: 'Gacha', subtitle: 'Events', icon: Ticket },
  'manaboard': { id: 'manaboard', href: '/manaboard', label: 'Mana Board', subtitle: 'Tools', icon: Sparkles },
  'orderedmap': { id: 'orderedmap', href: '/orderedmap', label: 'OrderedMap', subtitle: 'Tools', icon: FileJson },
  'exboost': { id: 'exboost', href: '/exboost', label: 'EX Boost', subtitle: 'Tools', icon: Sparkles },
  'fixed-party': { id: 'fixed-party', href: '/fixed-party', label: 'Fixed Party', subtitle: 'Tools', icon: Users },
  'share': { id: 'share', href: '/share', label: 'Share', subtitle: 'Tools', icon: FileJson },
  'facebuilder': { id: 'facebuilder', href: '/facebuilder', label: 'Face Builder', subtitle: 'Media', icon: User },
  'scenes': { id: 'scenes', href: '/scenes', label: 'Scenes', subtitle: 'Media', icon: Clapperboard },
  'sprite-sheets': { id: 'sprite-sheets', href: '/sprite-sheets', label: 'Sprite Sheets', subtitle: 'Media', icon: Film },
  'music': { id: 'music', href: '/music', label: 'Music', subtitle: 'Media', icon: Music2 },
  'voicedb': { id: 'voicedb', href: '/voicedb', label: 'VoiceDB', subtitle: 'Media', icon: User },
  'comics': { id: 'comics', href: '/comics', label: 'Comics', subtitle: 'Media', icon: BookOpenText },
};

const NAV_GROUP_DEFINITIONS: Record<NavbarGroupId, Omit<NavGroup, 'id' | 'items'>> = {
  'community': { label: 'Community', icon: Clipboard },
  'game-data': { label: 'Game Data', icon: Database },
  'events': { label: 'Events', icon: Calendar },
  'tools': { label: 'Tools', icon: Wrench },
  'media': { label: 'Media', icon: User },
};

function dedupeNavItems(items: NavItem[]): NavItem[] {
  const seen = new Set<NavbarItemId>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const TOP_LEVEL_ORDER: Array<'home' | 'save-editor'> = ['home', 'save-editor'];
const GROUP_ITEM_ORDER: Record<NavbarGroupId, NavbarItemId[]> = {
  'community': ['profile', 'community', 'community-new', 'saves', 'community-moderation', 'login', 'register'],
  'game-data': ['characters', 'items', 'quests', 'abilities', 'achievements'],
  'events': ['calendar', 'calendar-v2', 'feature-timeline', 'gacha'],
  'tools': ['manaboard', 'orderedmap', 'exboost', 'fixed-party', 'share'],
  'media': ['facebuilder', 'scenes', 'sprite-sheets', 'music', 'voicedb', 'comics'],
};

const GROUP_ORDER: NavbarGroupId[] = ['community', 'game-data', 'events', 'tools', 'media'];

const TOP_LEVEL_ITEMS = dedupeNavItems(
  TOP_LEVEL_ORDER
    .filter((itemId) => NAVBAR_CONFIG.topLevel[itemId])
    .map((itemId) => NAV_ITEM_DEFINITIONS[itemId])
);

const NAV_GROUPS: NavGroup[] = GROUP_ORDER
  .map((groupId) => {
    const groupConfig = NAVBAR_CONFIG.groups[groupId];
    const definition = NAV_GROUP_DEFINITIONS[groupId];
    if (!groupConfig?.visible) return null;

    return {
      id: groupId,
      label: definition.label,
      icon: definition.icon,
      items: dedupeNavItems(
        GROUP_ITEM_ORDER[groupId]
          .filter((itemId) => Boolean(groupConfig.items?.[itemId]))
          .map((itemId) => NAV_ITEM_DEFINITIONS[itemId])
      ),
    };
  })
  .filter((group): group is NavGroup => Boolean(group && group.items.length > 0));

const QUICK_JUMP_GROUP_ORDER: QuickJumpGroup[] = [
  'Navigation',
  'Characters',
  'Items',
  'Quests',
  'Systems',
  'Actions',
];

const NAV_ICON_BY_HREF: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  Object.values(NAV_ITEM_DEFINITIONS).map((item) => [item.href, item.icon])
);

function filterActionEntries(entries: QuickJumpActionEntry[], rawQuery: string): QuickJumpActionEntry[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return entries;

  return entries.filter((entry) => {
    const searchBlob = `${entry.title} ${entry.subtitle} ${entry.keywords.join(' ')}`.toLowerCase();
    return searchBlob.includes(query);
  });
}

function getQuickJumpResultIcon(result: SearchApiResult): React.ComponentType<{ className?: string }> {
  if (result.kind === 'page') {
    return NAV_ICON_BY_HREF[result.href] || Search;
  }
  if (result.kind === 'character') return User;
  if (result.kind === 'equipment') return Wrench;
  if (result.kind === 'item') return Package;
  if (result.kind === 'quest') return FileJson;
  if (result.kind === 'ability') return Zap;
  if (result.kind === 'achievement') return Trophy;
  return Search;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href;
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)));
}

function QuickJumpEntryVisual({
  imageUrl,
  imagePixelated,
  title,
  icon: EntryIcon,
}: {
  imageUrl?: string;
  imagePixelated?: boolean;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [failedImage, setFailedImage] = useState(false);

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background/70">
      {imageUrl && !failedImage ? (
        <Image
          src={imageUrl}
          alt={title}
          width={32}
          height={32}
          className={cn(
            'h-full w-full object-contain',
            imagePixelated ? '[image-rendering:pixelated]' : '[image-rendering:auto]'
          )}
          unoptimized={true}
          onError={() => setFailedImage(true)}
        />
      ) : (
        <EntryIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function HighlightedText({ parts, className }: { parts: SearchHighlightPart[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.match ? 'rounded-sm bg-primary/15 text-foreground' : undefined}
        >
          {part.text}
        </span>
      ))}
    </span>
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
  const deferredQuickJumpQuery = useDeferredValue(quickJumpQuery);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [globalResults, setGlobalResults] = useState<SearchApiResult[]>([]);
  const [operatorHints, setOperatorHints] = useState<string[]>([]);

  const actionEntries = useMemo<QuickJumpActionEntry[]>(
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

  const filteredActionEntries = useMemo(
    () => filterActionEntries(actionEntries, deferredQuickJumpQuery),
    [actionEntries, deferredQuickJumpQuery]
  );

  const quickJumpResults = useMemo<QuickJumpRenderableEntry[]>(() => {
    const resultEntries = globalResults.map((result) => ({
      ...result,
      group: QUICK_JUMP_GROUP_ORDER.includes(result.group as QuickJumpGroup)
        ? (result.group as Exclude<QuickJumpGroup, 'Actions'>)
        : ('Navigation' as const),
      icon: getQuickJumpResultIcon(result),
      mode: 'result' as const,
    }));

    const actionResultEntries = filteredActionEntries.map((entry) => ({
      ...entry,
      mode: 'action' as const,
    }));

    return [...resultEntries, ...actionResultEntries].sort((a, b) => {
      const groupDiff = QUICK_JUMP_GROUP_ORDER.indexOf(a.group) - QUICK_JUMP_GROUP_ORDER.indexOf(b.group);
      if (groupDiff !== 0) return groupDiff;
      if (a.mode === 'result' && b.mode === 'result' && b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });
  }, [filteredActionEntries, globalResults]);

  const groupedQuickJumpResults = useMemo(() => {
    let runningIndex = 0;
    return QUICK_JUMP_GROUP_ORDER.map((group) => {
      const items = quickJumpResults
        .filter((result) => result.group === group)
        .map((result) => ({ ...result, resultIndex: runningIndex++ }));
      return { group, items };
    }).filter((group) => group.items.length > 0);
  }, [quickJumpResults]);

  const loadSearchResults = useCallback(
    async (query: string, signal?: AbortSignal) => {
      setSearchStatus('loading');
      setSearchError(null);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=40`, { signal });
        if (!response.ok) {
          throw new Error(`Search request failed (${response.status})`);
        }

        const payload = (await response.json()) as {
          results?: SearchApiResult[];
          operators?: string[];
        };

        setGlobalResults(Array.isArray(payload.results) ? payload.results : []);
        setOperatorHints(Array.isArray(payload.operators) ? payload.operators : []);
        setSearchStatus('ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to load global search results:', error);
        setSearchStatus('error');
        setSearchError('Failed to load global search results.');
      }
    },
    []
  );

  const runQuickJumpEntry = useCallback(
    (entry: QuickJumpRenderableEntry) => {
      setQuickJumpOpen(false);
      setQuickJumpQuery('');
      setQuickJumpSelectedIndex(0);
      setMobileMenuOpen(false);

      if (entry.mode === 'action') {
        entry.action();
        return;
      }

      router.push(entry.href);
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
    const controller = new AbortController();
    void loadSearchResults(deferredQuickJumpQuery, controller.signal);
    return () => controller.abort();
  }, [deferredQuickJumpQuery, loadSearchResults, quickJumpOpen]);

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
  }, [deferredQuickJumpQuery, quickJumpOpen]);

  useEffect(() => {
    if (quickJumpSelectedIndex < quickJumpResults.length) return;
    setQuickJumpSelectedIndex(0);
  }, [quickJumpResults.length, quickJumpSelectedIndex]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted/40 shadow-sm">
              <img
                src={SITE_LOGO_SRC}
                alt={SITE_LOGO_ALT}
                width={40}
                height={40}
                className="block h-10 w-10 [image-rendering:pixelated]"
                draggable={false}
              />
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold">{SITE_NAME}</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {TOP_LEVEL_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setQuickJumpOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActivePath(pathname, item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <ItemIcon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

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

            <PageTranslateButton />
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
              {TOP_LEVEL_ITEMS.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActivePath(pathname, item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <ItemIcon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}

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
                placeholder="Search everything: pages, characters, items, quests..."
                className="h-10 pl-9 pr-10"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <Keyboard className="mr-1 h-3 w-3" />
                Enter
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Search operators:{' '}
              {operatorHints.length > 0 ? (
                operatorHints.map((hint, index) => (
                  <span key={hint}>
                    <code>{hint}</code>
                    {index < operatorHints.length - 1 ? ', ' : ''}
                  </span>
                ))
              ) : (
                <span>loading…</span>
              )}
            </p>
            {searchStatus === 'loading' && (
              <p className="mt-2 text-xs text-muted-foreground">Searching the full index…</p>
            )}
            {searchStatus === 'error' && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-destructive">{searchError || 'Failed to load search results.'}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    void loadSearchResults(deferredQuickJumpQuery);
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          {searchStatus !== 'loading' && quickJumpResults.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for &quot;{quickJumpQuery}&quot;.
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
                      const activePath = entry.mode === 'result' ? isActivePath(pathname, entry.href) : false;
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
                          <QuickJumpEntryVisual
                            imageUrl={entry.mode === 'result' ? entry.imageUrl : undefined}
                            imagePixelated={entry.mode === 'result' ? entry.imagePixelated : undefined}
                            title={entry.title}
                            icon={entry.icon}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {entry.mode === 'result' ? (
                                <HighlightedText parts={entry.titleHighlights} />
                              ) : (
                                entry.title
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.mode === 'result' ? (
                                <HighlightedText parts={entry.subtitleHighlights} />
                              ) : (
                                entry.subtitle
                              )}
                            </p>
                            {entry.mode === 'result' && entry.snippetHighlights && entry.snippetHighlights.length > 0 && (
                              <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/90">
                                <HighlightedText parts={entry.snippetHighlights} />
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {entry.mode === 'result' &&
                                entry.badges?.slice(0, 3).map((badge) => (
                                  <span
                                    key={`${entry.id}-${badge}`}
                                    className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              {entry.mode === 'result' && (
                                <span className="rounded border px-1.5 py-0.5 text-[10px] text-primary">
                                  {entry.reason}
                                </span>
                              )}
                              {entry.mode === 'action' && (
                                <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  Action
                                </span>
                              )}
                              {activePath && (
                                <span className="rounded border border-primary/50 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  Current
                                </span>
                              )}
                            </div>
                          </div>
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
