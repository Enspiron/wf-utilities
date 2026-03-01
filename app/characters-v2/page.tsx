'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  LayoutList,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Character, getUniqueValues } from '@/lib/character-parser';
import { cn } from '@/lib/utils';

type Language = 'en' | 'jp';
type ViewMode = 'gallery' | 'compact';
type SortMode = 'name_asc' | 'name_desc' | 'rarity_desc' | 'attribute';

type FilterState = {
  attribute: string | null;
  weaponType: string | null;
  stance: string | null;
  gender: string | null;
  rarity: string | null;
  races: string[];
};

const ITEMS_PER_PAGE = 72;

const ATTRIBUTE_TONE: Record<string, string> = {
  Fire: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  Water: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  Wind: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Thunder: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Light: 'border-slate-300/50 bg-slate-300/10 text-slate-200',
  Dark: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
};

const DEFAULT_FILTERS: FilterState = {
  attribute: null,
  weaponType: null,
  stance: null,
  gender: null,
  rarity: null,
  races: [],
};

function getCharacterImage(faceCode: string): string {
  return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceCode}/ui/square_0.png`;
}

function parseCharacterRaces(race: string): string[] {
  return race
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function characterMatchesSearch(char: Character, queryLower: string): boolean {
  return (
    char.nameJP.toLowerCase().includes(queryLower) ||
    (char.nameEN || '').toLowerCase().includes(queryLower) ||
    char.subNameJP.toLowerCase().includes(queryLower) ||
    (char.subNameEN || '').toLowerCase().includes(queryLower) ||
    char.titleJP.toLowerCase().includes(queryLower) ||
    (char.titleEN || '').toLowerCase().includes(queryLower) ||
    char.faceCode.toLowerCase().includes(queryLower) ||
    char.voiceActorJP.toLowerCase().includes(queryLower) ||
    (char.voiceActorEN || '').toLowerCase().includes(queryLower)
  );
}

function getCharacterName(char: Character, language: Language): string {
  if (language === 'jp') return char.nameJP;
  return char.nameEN || char.nameJP;
}

function getCharacterTitle(char: Character, language: Language): string {
  if (language === 'jp') return char.titleJP;
  return char.titleEN || char.titleJP;
}

function Pager({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalItems, page * pageSize);

  return (
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <p className='text-sm text-muted-foreground'>
        Showing {rangeStart}-{rangeEnd} of {totalItems.toLocaleString()}
      </p>
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => onPageChange(1)} disabled={page === 1}>
          First
        </Button>
        <Button
          variant='outline'
          size='icon'
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <span className='text-xs text-muted-foreground'>
          Page {page} / {totalPages}
        </span>
        <Button
          variant='outline'
          size='icon'
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
        <Button variant='outline' size='sm' onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>
          Last
        </Button>
      </div>
    </div>
  );
}

export default function CharactersPageV2() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [language, setLanguage] = useState<Language>('en');
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [sortMode, setSortMode] = useState<SortMode>('name_asc');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCharacters() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/characters?lang=both', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data = (await response.json()) as { characters?: Character[] };
        setCharacters(data.characters || []);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Failed to load character data:', loadError);
        setCharacters([]);
        setError('Failed to load characters.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCharacters();
    return () => controller.abort();
  }, []);

  const filterOptions = useMemo(() => {
    if (characters.length === 0) {
      return {
        attributes: [] as string[],
        weaponTypes: [] as string[],
        stances: [] as string[],
        genders: [] as string[],
        rarities: [] as string[],
        races: [] as string[],
      };
    }

    return {
      attributes: getUniqueValues(characters, 'attribute'),
      weaponTypes: getUniqueValues(characters, 'weaponType'),
      stances: getUniqueValues(characters, 'stance'),
      genders: getUniqueValues(characters, 'gender'),
      rarities: getUniqueValues(characters, 'rarity'),
      races: getUniqueValues(characters, 'race'),
    };
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = characters.filter((char) => {
      if (filters.attribute && char.attribute !== filters.attribute) return false;
      if (filters.weaponType && char.weaponType !== filters.weaponType) return false;
      if (filters.stance && char.stance !== filters.stance) return false;
      if (filters.gender && char.gender !== filters.gender) return false;
      if (filters.rarity && char.rarity !== filters.rarity) return false;

      if (filters.races.length > 0) {
        const charRaces = parseCharacterRaces(char.race);
        const hasAnySelectedRace = filters.races.some((race) => charRaces.includes(race));
        if (!hasAnySelectedRace) return false;
      }

      if (query && !characterMatchesSearch(char, query)) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortMode === 'name_desc') {
        return getCharacterName(b, language).localeCompare(getCharacterName(a, language));
      }
      if (sortMode === 'rarity_desc') {
        const rarityDiff = Number.parseInt(b.rarity, 10) - Number.parseInt(a.rarity, 10);
        if (rarityDiff !== 0) return rarityDiff;
        return getCharacterName(a, language).localeCompare(getCharacterName(b, language));
      }
      if (sortMode === 'attribute') {
        const attrDiff = a.attribute.localeCompare(b.attribute);
        if (attrDiff !== 0) return attrDiff;
        return getCharacterName(a, language).localeCompare(getCharacterName(b, language));
      }
      return getCharacterName(a, language).localeCompare(getCharacterName(b, language));
    });

    return result;
  }, [characters, filters, language, search, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const paginatedCharacters = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, safePage]);

  useEffect(() => {
    setPage(1);
  }, [filters, search, sortMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.attribute) count += 1;
    if (filters.weaponType) count += 1;
    if (filters.stance) count += 1;
    if (filters.gender) count += 1;
    if (filters.rarity) count += 1;
    count += filters.races.length;
    return count;
  }, [filters]);

  const toggleRaceFilter = useCallback((race: string) => {
    setFilters((prev) => {
      const exists = prev.races.includes(race);
      return {
        ...prev,
        races: exists ? prev.races.filter((item) => item !== race) : [...prev.races, race],
      };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filterPanel = (
    <div className='space-y-4'>
      <div className='grid gap-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Attribute</p>
        <Select
          value={filters.attribute ?? 'all'}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, attribute: value === 'all' ? null : value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder='All attributes' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All attributes</SelectItem>
            {filterOptions.attributes.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Weapon</p>
        <Select
          value={filters.weaponType ?? 'all'}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, weaponType: value === 'all' ? null : value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder='All weapons' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All weapons</SelectItem>
            {filterOptions.weaponTypes.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Stance</p>
        <Select
          value={filters.stance ?? 'all'}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, stance: value === 'all' ? null : value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder='All stances' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All stances</SelectItem>
            {filterOptions.stances.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        <div className='grid gap-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Gender</p>
          <Select
            value={filters.gender ?? 'all'}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, gender: value === 'all' ? null : value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder='All genders' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All genders</SelectItem>
              {filterOptions.genders.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid gap-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Rarity</p>
          <Select
            value={filters.rarity ?? 'all'}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, rarity: value === 'all' ? null : value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder='All rarity' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All rarity</SelectItem>
              {filterOptions.rarities.map((value) => (
                <SelectItem key={value} value={value}>
                  {value} Star
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid gap-2'>
        <div className='flex items-center justify-between'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Race (multi-select)</p>
          {filters.races.length > 0 ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs'
              onClick={() => setFilters((prev) => ({ ...prev, races: [] }))}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div className='flex flex-wrap gap-1.5'>
          {filterOptions.races.map((race) => {
            const selected = filters.races.includes(race);
            return (
              <Button
                key={race}
                type='button'
                variant={selected ? 'default' : 'outline'}
                size='sm'
                className='h-7 px-2 text-xs'
                onClick={() => toggleRaceFilter(race)}
              >
                {race}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className='flex min-h-[calc(100vh-4rem)] items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_45%)] pb-8'>
      <div className='mx-auto w-full max-w-[1600px] space-y-4 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/85 backdrop-blur'>
          <CardContent className='p-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <div className='mb-1 flex items-center gap-2'>
                  <Sparkles className='h-4 w-4 text-primary' />
                  <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Character Explorer V2</h1>
                  <Badge variant='outline'>Temporary</Badge>
                </div>
                <p className='max-w-3xl text-sm text-muted-foreground'>
                  New explorer layout with always-visible filters, denser results, and cleaner navigation.
                </p>
              </div>
              <div className='flex flex-wrap gap-2 text-xs'>
                <Badge variant='outline'>{characters.length.toLocaleString()} total</Badge>
                <Badge variant='outline'>{filteredCharacters.length.toLocaleString()} matching</Badge>
                {activeFilterCount > 0 ? <Badge variant='outline'>{activeFilterCount} active filters</Badge> : null}
              </div>
            </div>

            <div className='mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_170px_auto_auto_auto]'>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search name, title, face code, voice actor...'
                  className='pl-9'
                />
                {search ? (
                  <button
                    type='button'
                    onClick={() => setSearch('')}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                    aria-label='Clear search'
                  >
                    <X className='h-4 w-4' />
                  </button>
                ) : null}
              </div>

              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger>
                  <SelectValue placeholder='Sort' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='name_asc'>Name (A-Z)</SelectItem>
                  <SelectItem value='name_desc'>Name (Z-A)</SelectItem>
                  <SelectItem value='rarity_desc'>Rarity (High-Low)</SelectItem>
                  <SelectItem value='attribute'>Attribute</SelectItem>
                </SelectContent>
              </Select>

              <div className='inline-flex items-center rounded-md border bg-muted/20 p-1'>
                <Button
                  size='sm'
                  variant={language === 'en' ? 'default' : 'ghost'}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </Button>
                <Button
                  size='sm'
                  variant={language === 'jp' ? 'default' : 'ghost'}
                  onClick={() => setLanguage('jp')}
                >
                  JP
                </Button>
              </div>

              <div className='inline-flex items-center rounded-md border bg-muted/20 p-1'>
                <Button
                  size='sm'
                  variant={viewMode === 'gallery' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('gallery')}
                >
                  <Grid3X3 className='h-4 w-4' />
                </Button>
                <Button
                  size='sm'
                  variant={viewMode === 'compact' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('compact')}
                >
                  <LayoutList className='h-4 w-4' />
                </Button>
              </div>

              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant='outline' className='gap-2 lg:hidden'>
                    <SlidersHorizontal className='h-4 w-4' />
                    Filters
                    {activeFilterCount > 0 ? <Badge variant='secondary'>{activeFilterCount}</Badge> : null}
                  </Button>
                </SheetTrigger>
                <SheetContent side='right' className='w-[92vw] max-w-[420px]'>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Tune the result list without leaving the page.</SheetDescription>
                  </SheetHeader>
                  <div className='mt-4 space-y-3 overflow-y-auto pb-6'>{filterPanel}</div>
                  <div className='mt-3 flex items-center justify-between border-t pt-3'>
                    <span className='text-xs text-muted-foreground'>{activeFilterCount} active</span>
                    <Button variant='outline' size='sm' onClick={clearAllFilters}>
                      Clear All
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className='border-destructive/40 bg-destructive/5'>
            <CardContent className='p-4 text-sm text-destructive'>{error}</CardContent>
          </Card>
        ) : null}

        <div className='grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]'>
          <Card className='hidden lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col lg:sticky lg:top-20'>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <CardTitle className='text-base'>Filters</CardTitle>
                  <CardDescription>Refine by role, rarity, and race.</CardDescription>
                </div>
                <Button variant='ghost' size='sm' onClick={clearAllFilters}>
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className='min-h-0 flex-1'>
              <ScrollArea className='h-[calc(100vh-14rem)] pr-3'>{filterPanel}</ScrollArea>
            </CardContent>
          </Card>

          <div className='space-y-4'>
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Results</CardTitle>
                <CardDescription>
                  {viewMode === 'gallery' ? 'Gallery layout for browsing.' : 'Compact layout for quick scanning.'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Pager
                  page={safePage}
                  totalPages={totalPages}
                  totalItems={filteredCharacters.length}
                  pageSize={ITEMS_PER_PAGE}
                  onPageChange={setPage}
                />

                {paginatedCharacters.length === 0 ? (
                  <div className='rounded-lg border border-dashed p-12 text-center'>
                    <User className='mx-auto mb-3 h-10 w-10 text-muted-foreground' />
                    <p className='text-sm text-muted-foreground'>No characters matched your filters.</p>
                    <Button
                      variant='link'
                      onClick={() => {
                        clearAllFilters();
                        setSearch('');
                      }}
                      className='mt-1'
                    >
                      Clear filters and search
                    </Button>
                  </div>
                ) : viewMode === 'gallery' ? (
                  <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'>
                    {paginatedCharacters.map((char) => {
                      const name = getCharacterName(char, language);
                      const title = getCharacterTitle(char, language);
                      return (
                        <button
                          key={char.id}
                          type='button'
                          onClick={() => router.push(`/characters/${char.faceCode}`)}
                          className='group overflow-hidden rounded-lg border bg-background/70 text-left transition hover:border-primary/40 hover:bg-accent/20'
                        >
                          <div className='relative aspect-square w-full overflow-hidden bg-muted/40'>
                            <Image
                              src={getCharacterImage(char.faceCode)}
                              alt={name}
                              fill
                              className='object-contain transition duration-300 group-hover:scale-105'
                              loading='lazy'
                              unoptimized
                            />
                            <div className='absolute right-2 top-2 flex items-center gap-1'>
                              <Badge variant='outline' className={cn('text-[10px]', ATTRIBUTE_TONE[char.attribute] || '')}>
                                {char.attribute}
                              </Badge>
                              <Badge variant='secondary' className='text-[10px]'>
                                {char.rarity} Star
                              </Badge>
                            </div>
                          </div>
                          <div className='space-y-1 p-3'>
                            <p className='truncate text-sm font-semibold'>{name}</p>
                            <p className='truncate text-xs text-muted-foreground'>{title || 'No title'}</p>
                            <div className='flex flex-wrap gap-1'>
                              <Badge variant='outline' className='text-[10px]'>{char.weaponType}</Badge>
                              <Badge variant='outline' className='text-[10px]'>{char.stance}</Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {paginatedCharacters.map((char) => {
                      const name = getCharacterName(char, language);
                      const title = getCharacterTitle(char, language);
                      return (
                        <button
                          key={char.id}
                          type='button'
                          onClick={() => router.push(`/characters/${char.faceCode}`)}
                          className='w-full rounded-lg border bg-background/70 p-3 text-left transition hover:border-primary/40 hover:bg-accent/20'
                        >
                          <div className='flex items-start gap-3'>
                            <div className='relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted/40'>
                              <Image
                                src={getCharacterImage(char.faceCode)}
                                alt={name}
                                fill
                                className='object-contain'
                                loading='lazy'
                                unoptimized
                              />
                            </div>
                            <div className='min-w-0 flex-1'>
                              <p className='truncate text-sm font-semibold'>{name}</p>
                              <p className='truncate text-xs text-muted-foreground'>{title || 'No title'}</p>
                              <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                                <Badge variant='outline' className={cn('text-[10px]', ATTRIBUTE_TONE[char.attribute] || '')}>
                                  {char.attribute}
                                </Badge>
                                <Badge variant='secondary' className='text-[10px]'>{char.rarity} Star</Badge>
                                <Badge variant='outline' className='text-[10px]'>{char.weaponType}</Badge>
                                <Badge variant='outline' className='text-[10px]'>{char.stance}</Badge>
                                <Badge variant='outline' className='text-[10px]'>{char.race}</Badge>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {paginatedCharacters.length > 0 ? (
                  <Pager
                    page={safePage}
                    totalPages={totalPages}
                    totalItems={filteredCharacters.length}
                    pageSize={ITEMS_PER_PAGE}
                    onPageChange={setPage}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
