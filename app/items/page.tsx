'use client';

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpDown,
  Grid3x3,
  List,
  Package2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ItemsPageSkeleton from '@/components/items-page-skeleton';
import { cn } from '@/lib/utils';
import type { Item } from '../api/items/route';

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const GRID_PAGE_SIZE = 108;
const LIST_PAGE_SIZE = 42;

const RARITY_ICON_MAP: Record<number, string> = {
  1: '/FilterIcons/rarity/rarity_one.png',
  2: '/FilterIcons/rarity/rarity_two.png',
  3: '/FilterIcons/rarity/rarity_three.png',
  4: '/FilterIcons/rarity/rarity_four.png',
  5: '/FilterIcons/rarity/rarity_five.png',
};

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'id_asc', label: 'ID (Low to High)' },
  { value: 'id_desc', label: 'ID (High to Low)' },
  { value: 'rarity_desc', label: 'Rarity (High to Low)' },
  { value: 'rarity_asc', label: 'Rarity (Low to High)' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'grid' | 'list';
type ItemTypeFilter = 'all' | Item['type'];
type RegionFilter = 'all' | 'gl' | 'ja';

const hasImageExtension = (value: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(value);

const buildImageUrl = (value: string) => {
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const normalized = value.replace(/^\/+/, '');
  return `${CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
};

const getImageCandidates = (item: Item) => {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const pushCandidate = (raw?: string) => {
    if (!raw || !raw.trim()) return;
    const url = buildImageUrl(raw.trim());
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push(url);
  };
  pushCandidate(item.thumbnail);
  pushCandidate(item.icon);
  return candidates;
};

const clampRarity = (value: number) => {
  const parsed = Number.isFinite(value) ? Math.round(value) : 1;
  return Math.max(1, Math.min(5, parsed));
};

function ItemArtwork({
  item,
  className,
  iconClassName,
}: {
  item: Item;
  className?: string;
  iconClassName?: string;
}) {
  const candidates = useMemo(() => getImageCandidates(item), [item.icon, item.thumbnail]);
  const candidateKey = candidates.join('|');
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  if (candidateIndex >= candidates.length) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center rounded-md border border-dashed border-border/60', className)}>
        <Package2 className='h-6 w-6 text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center rounded-md bg-background/40', className)}>
      <Image
        src={candidates[candidateIndex]}
        alt={item.name}
        width={120}
        height={120}
        className={cn('h-full w-full object-contain [image-rendering:pixelated]', iconClassName)}
        unoptimized={true}
        onError={() => setCandidateIndex((prev) => prev + 1)}
      />
    </div>
  );
}

function RarityIcon({ rarity, className }: { rarity: number; className?: string }) {
  const rarityLevel = clampRarity(rarity);
  return (
    <Image
      src={RARITY_ICON_MAP[rarityLevel]}
      alt={`${rarityLevel}-star rarity`}
      width={108}
      height={22}
      className={cn('h-[18px] w-auto [image-rendering:pixelated]', className)}
      unoptimized={true}
    />
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [onlyWithArtwork, setOnlyWithArtwork] = useState(false);

  const [sortBy, setSortBy] = useState<SortKey>('name_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch('/api/items')
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setItems(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch((fetchError) => {
        if (!active) return;
        console.error('Failed to load items:', fetchError);
        setError('Failed to load items. Please try again.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(min-width: 1024px)');
    const { body, documentElement } = document;
    const previousBodyOverflowY = body.style.overflowY;
    const previousHtmlOverflowY = documentElement.style.overflowY;

    const applyScrollLock = () => {
      if (media.matches) {
        body.style.overflowY = 'hidden';
        documentElement.style.overflowY = 'hidden';
      } else {
        body.style.overflowY = previousBodyOverflowY;
        documentElement.style.overflowY = previousHtmlOverflowY;
      }
    };

    applyScrollLock();
    media.addEventListener('change', applyScrollLock);

    return () => {
      media.removeEventListener('change', applyScrollLock);
      body.style.overflowY = previousBodyOverflowY;
      documentElement.style.overflowY = previousHtmlOverflowY;
    };
  }, []);

  const typedItems = useMemo(() => {
    if (typeFilter === 'all') return items;
    return items.filter((item) => item.type === typeFilter);
  }, [items, typeFilter]);

  const itemCount = useMemo(() => items.filter((item) => item.type === 'item').length, [items]);
  const equipmentCount = useMemo(() => items.filter((item) => item.type === 'equipment').length, [items]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of typedItems) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return counts;
  }, [typedItems]);

  const categoryOptions = useMemo(
    () =>
      [...categoryCounts.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      }),
    [categoryCounts]
  );

  const rarityCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of typedItems) {
      const rarity = clampRarity(item.rarity);
      counts.set(rarity, (counts.get(rarity) || 0) + 1);
    }
    return counts;
  }, [typedItems]);

  const regionCounts = useMemo(() => {
    let gl = 0;
    let ja = 0;

    for (const item of typedItems) {
      if (item.type !== 'equipment') continue;
      const regions = item.sheetRegions || [];
      const hasGl = regions.includes('gl');
      const hasJa = regions.includes('ja');
      if (hasGl) gl += 1;
      if (hasJa && !hasGl) ja += 1;
    }

    return { gl, ja };
  }, [typedItems]);

  const filteredItems = useMemo(() => {
    const result = typedItems.filter((item) => {
      if (deferredSearch) {
        const haystack = `${item.id} ${item.name} ${item.devname} ${item.description} ${item.flavorText || ''} ${item.category}`.toLowerCase();
        if (!haystack.includes(deferredSearch)) {
          return false;
        }
      }

      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
        return false;
      }

      if (regionFilter !== 'all') {
        if (item.type !== 'equipment') return false;
        const regions = item.sheetRegions || [];
        const hasGl = regions.includes('gl');
        const hasJa = regions.includes('ja');
        if (regionFilter === 'gl') {
          if (!hasGl) return false;
        } else if (regionFilter === 'ja') {
          if (!(hasJa && !hasGl)) return false;
        }
      }

      if (selectedRarities.length > 0 && !selectedRarities.includes(clampRarity(item.rarity))) {
        return false;
      }

      if (onlyWithArtwork && getImageCandidates(item).length === 0) {
        return false;
      }

      return true;
    });

    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        case 'id_asc': {
          const aNum = Number.parseInt(a.id, 10);
          const bNum = Number.parseInt(b.id, 10);
          if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
          return a.id.localeCompare(b.id);
        }
        case 'id_desc': {
          const aNum = Number.parseInt(a.id, 10);
          const bNum = Number.parseInt(b.id, 10);
          if (Number.isFinite(aNum) && Number.isFinite(bNum)) return bNum - aNum;
          return b.id.localeCompare(a.id);
        }
        case 'rarity_desc': {
          const rarityDiff = clampRarity(b.rarity) - clampRarity(a.rarity);
          return rarityDiff !== 0 ? rarityDiff : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        case 'rarity_asc': {
          const rarityDiff = clampRarity(a.rarity) - clampRarity(b.rarity);
          return rarityDiff !== 0 ? rarityDiff : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
    });

    return sorted;
  }, [deferredSearch, onlyWithArtwork, regionFilter, selectedCategories, selectedRarities, sortBy, typedItems]);

  const itemsPerPage = viewMode === 'grid' ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  useLayoutEffect(() => {
    setCurrentPage((prev) => (prev === 1 ? prev : 1));
  }, [deferredSearch, onlyWithArtwork, regionFilter, selectedCategories, selectedRarities, sortBy, typeFilter, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, itemsPerPage, safePage]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'all') count += 1;
    if (regionFilter !== 'all') count += 1;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedRarities.length > 0) count += selectedRarities.length;
    if (onlyWithArtwork) count += 1;
    return count;
  }, [onlyWithArtwork, regionFilter, selectedCategories.length, selectedRarities.length, typeFilter]);

  const paginationSlots = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const slots: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1];
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    if (start > 2) slots.push('ellipsis-start');
    for (let page = start; page <= end; page += 1) slots.push(page);
    if (end < totalPages - 1) slots.push('ellipsis-end');
    slots.push(totalPages);

    return slots;
  }, [safePage, totalPages]);

  const resultRangeLabel = useMemo(() => {
    if (filteredItems.length === 0) return 'Showing 0 results';
    const start = (safePage - 1) * itemsPerPage + 1;
    const end = Math.min(safePage * itemsPerPage, filteredItems.length);
    return `Showing ${start}-${end} of ${filteredItems.length} results`;
  }, [filteredItems.length, itemsPerPage, safePage]);

  const clearAllFilters = () => {
    setTypeFilter('all');
    setRegionFilter('all');
    setSelectedCategories([]);
    setSelectedRarities([]);
    setOnlyWithArtwork(false);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((value) => value !== category) : [...prev, category]
    );
  };

  const toggleRarity = (rarity: number) => {
    setSelectedRarities((prev) =>
      prev.includes(rarity) ? prev.filter((value) => value !== rarity) : [...prev, rarity]
    );
  };

  const FilterPanel = ({ mobile = false }: { mobile?: boolean }) => (
    <div className='space-y-3'>
      <div className='space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Type</p>
        <div className='grid grid-cols-3 gap-2'>
          {[
            { key: 'all' as const, label: 'All' },
            { key: 'item' as const, label: 'Items' },
            { key: 'equipment' as const, label: 'Equipment' },
          ].map((option) => (
            <Button
              key={option.key}
              type='button'
              size='sm'
              variant={typeFilter === option.key ? 'default' : 'outline'}
              className='h-8 text-xs'
              onClick={() => setTypeFilter(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className='space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Region (Equipment)</p>
        <div className='grid grid-cols-3 gap-2'>
          {[
            { key: 'all' as const, label: 'All' },
            { key: 'gl' as const, label: `GL ${regionCounts.gl}` },
            { key: 'ja' as const, label: `JP Excl ${regionCounts.ja}` },
          ].map((option) => (
            <Button
              key={option.key}
              type='button'
              size='sm'
              variant={regionFilter === option.key ? 'default' : 'outline'}
              className='h-8 text-xs'
              onClick={() => setRegionFilter(option.key)}
              disabled={option.key !== 'all' && (option.key === 'gl' ? regionCounts.gl : regionCounts.ja) === 0}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className='space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Rarity</p>
        <div className='flex flex-wrap gap-2'>
          {[1, 2, 3, 4, 5].map((rarity) => {
            const count = rarityCounts.get(rarity) || 0;
            if (count === 0) return null;
            const selected = selectedRarities.includes(rarity);
            return (
              <button
                key={rarity}
                type='button'
                onClick={() => toggleRarity(rarity)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                <RarityIcon rarity={rarity} />
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className='space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5'>
        <div className='flex items-center justify-between'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Category</p>
          {selectedCategories.length > 0 && (
            <Button variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={() => setSelectedCategories([])}>
              Clear
            </Button>
          )}
        </div>
        <ScrollArea className={cn('rounded-md border border-border/50 bg-background/40', mobile ? 'h-56' : 'h-[20rem]')}>
          <div className='space-y-1 p-1.5'>
            {categoryOptions.map(([category, count]) => (
              <button
                key={category}
                type='button'
                onClick={() => toggleCategory(category)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                  selectedCategories.includes(category)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                <span className='truncate pr-2'>{category}</span>
                <Badge variant='secondary' className='h-5 min-w-6 justify-center px-1.5 text-[10px]'>
                  {count}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className='space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Advanced</p>
        <Button
          type='button'
          variant={onlyWithArtwork ? 'default' : 'outline'}
          className='h-8 w-full justify-start text-xs'
          onClick={() => setOnlyWithArtwork((prev) => !prev)}
        >
          <Sparkles className='mr-2 h-3.5 w-3.5' />
          Has artwork only
        </Button>
      </div>

      <Button type='button' variant='outline' className='h-8 w-full text-xs' onClick={clearAllFilters}>
        Reset Filters
      </Button>
    </div>
  );

  if (loading) {
    return <ItemsPageSkeleton />;
  }

  if (error) {
    return (
      <div className='mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center px-4'>
        <Card className='w-full max-w-xl border-destructive/40 bg-card/80'>
          <CardHeader>
            <CardTitle className='text-lg'>Could not load items</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-muted-foreground'>{error}</p>
            <Button variant='outline' onClick={() => setReloadToken((prev) => prev + 1)}>
              <RefreshCw className='mr-2 h-4 w-4' />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='flex min-h-0 max-h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background h-[calc(100dvh-4rem)]'>
      <div className='shrink-0 border-b border-border bg-background'>
        <div className='flex flex-wrap items-center gap-2 p-3 md:flex-nowrap md:gap-3 md:p-4'>
          <div className='order-1 flex items-center gap-1 rounded-md border p-1'>
            <Button
              variant={typeFilter === 'all' ? 'default' : 'ghost'}
              size='sm'
              className='h-8 px-3 text-xs'
              onClick={() => setTypeFilter('all')}
            >
              All
            </Button>
            <Button
              variant={typeFilter === 'item' ? 'default' : 'ghost'}
              size='sm'
              className='h-8 px-3 text-xs'
              onClick={() => setTypeFilter('item')}
            >
              Items
            </Button>
            <Button
              variant={typeFilter === 'equipment' ? 'default' : 'ghost'}
              size='sm'
              className='h-8 px-3 text-xs'
              onClick={() => setTypeFilter('equipment')}
            >
              Equip
            </Button>
          </div>

          <div className='relative order-4 w-full flex-1 md:order-2 md:w-auto lg:hidden'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Search by name, ID, devname...'
              className='h-10 pl-9 pr-9'
            />
            {search && (
              <button
                type='button'
                onClick={() => setSearch('')}
                className='absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground'
                aria-label='Clear search'
              >
                <X className='h-3.5 w-3.5' />
              </button>
            )}
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
            <SelectTrigger className='order-2 h-10 min-w-[170px] md:order-3 md:min-w-[210px]'>
              <ArrowUpDown className='mr-2 h-4 w-4' />
              <SelectValue placeholder='Sort by' />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type='button'
            variant='outline'
            className='order-3 h-10 gap-2 lg:hidden'
            onClick={() => setMobileFilterOpen(true)}
          >
            <SlidersHorizontal className='h-4 w-4' />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant='secondary' className='ml-1 h-5 min-w-5 justify-center px-1.5 text-[10px]'>
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <div className='order-5 flex items-center gap-1 rounded-md border p-1'>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('grid')}
              className='h-8 w-9 p-0'
            >
              <Grid3x3 className='h-4 w-4' />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('list')}
              className='h-8 w-9 p-0'
            >
              <List className='h-4 w-4' />
            </Button>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className='flex flex-wrap items-center gap-2 px-4 pb-3 lg:hidden'>
            <span className='text-sm text-muted-foreground'>Filters:</span>
            {typeFilter !== 'all' && (
              <button
                type='button'
                onClick={() => setTypeFilter('all')}
                className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground'
              >
                Type: {typeFilter}
                <X className='h-3 w-3' />
              </button>
            )}
            {regionFilter !== 'all' && (
              <button
                type='button'
                onClick={() => setRegionFilter('all')}
                className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground'
              >
                Region: {regionFilter === 'ja' ? 'JP Exclusive' : 'GL'}
                <X className='h-3 w-3' />
              </button>
            )}
            {onlyWithArtwork && (
              <button
                type='button'
                onClick={() => setOnlyWithArtwork(false)}
                className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground'
              >
                Artwork only
                <X className='h-3 w-3' />
              </button>
            )}
            {selectedRarities.map((rarity) => (
              <button
                key={`mobile-rarity-${rarity}`}
                type='button'
                onClick={() => toggleRarity(rarity)}
                className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground'
              >
                R{rarity}
                <X className='h-3 w-3' />
              </button>
            ))}
            {selectedCategories.map((category) => (
              <button
                key={`mobile-category-${category}`}
                type='button'
                onClick={() => toggleCategory(category)}
                className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground'
              >
                <span className='max-w-28 truncate'>{category}</span>
                <X className='h-3 w-3' />
              </button>
            ))}
          </div>
        )}

        <div className='px-4 pb-3 text-sm text-muted-foreground lg:hidden'>{resultRangeLabel}</div>
      </div>

      <div className='flex min-h-0 flex-1 overflow-hidden'>
        <aside className='hidden min-h-0 shrink-0 flex-col border-r border-border bg-card/30 lg:flex lg:w-[320px] xl:w-[360px]'>
          <div className='space-y-3 border-b border-border p-4'>
            <div className='grid grid-cols-2 gap-2 text-xs'>
              <div className='rounded-md border bg-background/60 px-2.5 py-2'>
                <p className='text-muted-foreground'>Total</p>
                <p className='text-sm font-semibold'>{items.length}</p>
              </div>
              <div className='rounded-md border bg-background/60 px-2.5 py-2'>
                <p className='text-muted-foreground'>Filtered</p>
                <p className='text-sm font-semibold'>{filteredItems.length}</p>
              </div>
              <div className='rounded-md border bg-background/60 px-2.5 py-2'>
                <p className='text-muted-foreground'>Items</p>
                <p className='text-sm font-semibold'>{itemCount}</p>
              </div>
              <div className='rounded-md border bg-background/60 px-2.5 py-2'>
                <p className='text-muted-foreground'>Equip</p>
                <p className='text-sm font-semibold'>{equipmentCount}</p>
              </div>
            </div>

            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Search by name, ID, devname...'
                className='h-10 pl-9 pr-9'
              />
              {search && (
                <button
                  type='button'
                  onClick={() => setSearch('')}
                  className='absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground'
                  aria-label='Clear search'
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              )}
            </div>

            <div className='flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-2.5'>
              <span className='text-xs uppercase tracking-wide text-muted-foreground'>
                {activeFilterCount > 0 ? `${activeFilterCount} active` : 'No Active Filters'}
              </span>
              <Button variant='ghost' size='sm' onClick={clearAllFilters} className='h-6 px-2 text-xs' disabled={activeFilterCount === 0}>
                Clear All
              </Button>
            </div>
          </div>

          <ScrollArea className='min-h-0 flex-1 px-3 py-3'>
            <FilterPanel />
          </ScrollArea>
        </aside>

        <div className='min-h-0 flex-1 overflow-hidden'>
          <div className='h-full overflow-y-auto p-2 pb-24 sm:p-3 sm:pb-24 lg:p-2 lg:pb-24'>
            {paginatedItems.length === 0 ? (
              <div className='py-16 text-center'>
                <Package2 className='mx-auto mb-4 h-12 w-12 text-muted-foreground' />
                <p className='text-muted-foreground'>No items found</p>
                {(activeFilterCount > 0 || search) && (
                  <Button variant='link' onClick={() => { clearAllFilters(); setSearch(''); }} className='mt-2'>
                    Clear all filters and search
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className='grid grid-cols-4 gap-0.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14'>
                {paginatedItems.map((item) => {
                  const detailHref = `/${item.type === 'equipment' ? 'equip' : 'item'}/${item.id}`;

                  return (
                    <Link key={`${item.type}-${item.id}`} href={detailHref} className='block' title={`${item.name}\nID ${item.id}`}>
                      <Card className='cursor-pointer overflow-hidden rounded-sm transition-shadow hover:shadow-md'>
                        <CardContent className='flex flex-col items-center p-0.5'>
                          <div className='relative mb-0.5 w-full overflow-hidden rounded-sm bg-muted aspect-square'>
                            <ItemArtwork item={item} className='rounded-sm' iconClassName='transition-transform duration-200 hover:scale-[1.04]' />
                            <Badge
                              variant='secondary'
                              className='absolute left-0.5 top-0.5 h-4 px-1 text-[9px] uppercase leading-none'
                            >
                              {item.type === 'equipment' ? 'Eq' : 'It'}
                            </Badge>
                          </div>
                          <div className='w-full overflow-hidden whitespace-nowrap text-center text-[11px] font-medium leading-tight' title={item.name}>
                            {item.name}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className='space-y-2'>
                {paginatedItems.map((item) => {
                  const detailHref = `/${item.type === 'equipment' ? 'equip' : 'item'}/${item.id}`;

                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={detailHref}
                      className='grid w-full cursor-pointer grid-cols-[64px,minmax(0,1fr),auto] items-center gap-3 rounded-md border p-2 text-left transition-shadow hover:shadow-md'
                    >
                      <div className='aspect-square overflow-hidden rounded-md bg-muted'>
                        <ItemArtwork item={item} />
                      </div>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold'>{item.name}</p>
                        <p className='truncate text-xs text-muted-foreground'>{item.devname || 'Unknown devname'}</p>
                        <p className='line-clamp-1 text-xs text-muted-foreground'>
                          {item.description || item.flavorText || 'No description available.'}
                        </p>
                      </div>
                      <div className='flex flex-col items-end gap-1 text-xs'>
                        <Badge variant='outline'>{item.category}</Badge>
                        <RarityIcon rarity={item.rarity} className='h-[14px]' />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-3 shadow-lg'>
        <div className='flex flex-wrap items-center justify-center gap-2 text-sm'>
          <Button
            variant='outline'
            size='sm'
            className='h-8 px-3'
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          {paginationSlots.map((slot) =>
            typeof slot === 'number' ? (
              <Button
                key={slot}
                variant={slot === safePage ? 'default' : 'outline'}
                size='sm'
                className='h-8 min-w-8 px-2'
                onClick={() => setCurrentPage(slot)}
              >
                {slot}
              </Button>
            ) : (
              <span key={slot} className='px-1 text-xs text-muted-foreground'>
                ...
              </span>
            )
          )}
          <Button
            variant='outline'
            size='sm'
            className='h-8 px-3'
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side='left' className='w-[92vw] max-w-[380px] p-0 sm:w-[420px] sm:max-w-[420px]'>
          <SheetHeader className='border-b px-4 py-4'>
            <SheetTitle className='text-left text-base'>Item Filters</SheetTitle>
          </SheetHeader>
          <div className='h-[calc(100%-4rem)] px-4 py-4'>
            <ScrollArea className='h-full pr-3'>
              <FilterPanel mobile={true} />
              <Button type='button' className='mt-4 w-full' onClick={() => setMobileFilterOpen(false)}>
                Apply Filters
              </Button>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
