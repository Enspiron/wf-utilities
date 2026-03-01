"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenText,
  Calendar,
  ChevronDown,
  Database,
  FileJson,
  Home,
  Menu,
  Music2,
  Package,
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

const HOME_ITEM: NavItem = { href: '/', label: 'Home', icon: Home };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Game Data',
    icon: Database,
    items: [
      { href: '/characters', label: 'Characters', icon: Database },
      { href: '/characters-v2', label: 'Characters V2', icon: Sparkles },
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

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href;
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isActivePath(pathname, item.href));
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);

  const allItems = useMemo(() => [HOME_ITEM, ...NAV_GROUPS.flatMap((group) => group.items)], []);

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
            <DropdownMenu open={quickJumpOpen} onOpenChange={setQuickJumpOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden lg:inline-flex h-9 gap-2">
                  <Search className="h-4 w-4" />
                  Quick Jump
                  <span className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl+K</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Navigate</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allItems.map((item) => {
                  const ItemIcon = item.icon;
                  const itemActive = isActivePath(pathname, item.href);
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      asChild
                      className={cn(itemActive && 'bg-accent font-medium')}
                    >
                      <Link href={item.href} onClick={() => setQuickJumpOpen(false)}>
                        <ItemIcon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

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
    </nav>
  );
}
