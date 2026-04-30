'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Grid3x3, List, Loader2, User, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CharacterPortrait } from '@/components/character/character-portrait';
import {
  buildCharacterSquareImageUrl,
  getCharacterAttributeIcon as getAttributeIcon,
  getCharacterRaceIcon as getRaceIcon,
  getCharacterRarityIcon as getRarityIcon,
  getCharacterStanceIcon as getStanceIcon,
  getCharacterWeaponTypeIcon as getWeaponTypeIcon,
} from '@/lib/character-assets';
import { Character, CharacterFilters, filterCharacters, getUniqueValues } from '@/lib/character-parser';
import { searchDocuments } from '@/lib/search/core';
import { buildCharacterSearchDocument } from '@/lib/search/documents';

const ITEMS_PER_PAGE = 96;

function CharactersPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'jp' | 'en'>('en');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState(qParam);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [modalTooltipsArmed, setModalTooltipsArmed] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [apiJpExclusiveCount, setApiJpExclusiveCount] = useState<number | null>(null);
  
  const [filters, setFilters] = useState<CharacterFilters>({});

  // Fetch characters
  useEffect(() => {
    async function loadCharacters() {
      setLoading(true);
      try {
        const response = await fetch('/api/characters?lang=both', { cache: 'no-store' });
        const data = await response.json();
        setCharacters(data.characters || []);
        setApiJpExclusiveCount(Number.isFinite(data.jpExclusiveCount) ? data.jpExclusiveCount : null);
      } catch (error) {
        console.error('Error loading characters:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCharacters();
  }, []);

  // Get unique filter values
  const filterOptions = useMemo(() => {
    if (characters.length === 0) return {
      attributes: [],
      weaponTypes: [],
      races: [],
      genders: [],
      rarities: [],
      stances: [],
    };

    return {
      attributes: getUniqueValues(characters, 'attribute'),
      weaponTypes: getUniqueValues(characters, 'weaponType'),
      races: getUniqueValues(characters, 'race'),
      genders: getUniqueValues(characters, 'gender'),
      rarities: getUniqueValues(characters, 'rarity'),
      stances: getUniqueValues(characters, 'stance'),
    };
  }, [characters]);

  const orderedGenders = useMemo(() => {
    const preferredOrder = ['Male', 'Female', 'Lily', 'Unknown'];
    const rank = new Map(preferredOrder.map((value, index) => [value.toLowerCase(), index]));
    return [...filterOptions.genders].sort((a, b) => {
      const aRank = rank.get(a.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b);
    });
  }, [filterOptions.genders]);

  const characterSearchIndex = useMemo(
    () =>
      characters.map((char) => {
        const document = buildCharacterSearchDocument(char);
        return { char, document };
      }),
    [characters]
  );

  const characterByDocumentId = useMemo(
    () => new Map(characterSearchIndex.map((entry) => [entry.document.id, entry.char])),
    [characterSearchIndex]
  );

  const characterDocumentByFaceCode = useMemo(
    () => new Map(characterSearchIndex.map((entry) => [entry.char.faceCode, entry.document])),
    [characterSearchIndex]
  );

  // Apply filters and search
  const filteredCharacters = useMemo(() => {
    const base = filterCharacters(characters, filters);
    if (!searchTerm.trim()) return base;

    const candidateDocuments = base
      .map((char) => characterDocumentByFaceCode.get(char.faceCode))
      .filter((document): document is ReturnType<typeof buildCharacterSearchDocument> => Boolean(document));

    return searchDocuments(candidateDocuments, searchTerm).results
      .map((result) => characterByDocumentId.get(result.document.id))
      .filter((char): char is Character => Boolean(char));
  }, [characterByDocumentId, characterDocumentByFaceCode, characters, filters, searchTerm]);

  // Reset suggestion index when search term changes
  useEffect(() => {
    setSelectedSuggestionIndex(-1);
  }, [searchTerm]);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionRefs.current[selectedSuggestionIndex]) {
      suggestionRefs.current[selectedSuggestionIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedSuggestionIndex]);

  useEffect(() => {
    if (filterModalOpen) {
      setModalTooltipsArmed(false);
    }
  }, [filterModalOpen]);

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

  // Autocomplete suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];

    return searchDocuments(
      characterSearchIndex.map((entry) => entry.document),
      searchTerm,
      { limit: 10 }
    ).results
      .map((result) => {
        const char = characterByDocumentId.get(result.document.id);
        if (!char) return null;
        return {
          char,
          text: result.document.title,
          value: result.match.bestFieldKey === 'faceCode' ? char.faceCode : result.document.title,
          type: result.match.reason,
        };
      })
      .filter(
        (
          suggestion
        ): suggestion is { char: Character; text: string; value: string; type: string } => Boolean(suggestion)
      );
  }, [characterByDocumentId, characterSearchIndex, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);
  const paginatedCharacters = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredCharacters.slice(startIndex, endIndex);
  }, [filteredCharacters, currentPage]);

  // Reset to page 1 before paint when filters/search change to avoid one-frame flicker.
  useLayoutEffect(() => {
    setCurrentPage((prev) => (prev === 1 ? prev : 1));
  }, [filters, searchTerm]);

  const getCharacterName = useCallback((char: Character) => {
    if (language === 'jp') return char.nameJP;
    if (language === 'en' && char.nameEN) return char.nameEN;
    return char.nameEN || char.nameJP;
  }, [language]);

  const getCharacterTitle = useCallback((char: Character) => {
    if (language === 'jp') return char.titleJP;
    if (language === 'en' && char.titleEN) return char.titleEN;
    return char.titleEN || char.titleJP;
  }, [language]);

  const getCharacterImage = useCallback((faceCode: string) => {
    return buildCharacterSquareImageUrl(faceCode);
  }, []);

  const clearFilter = (key: keyof CharacterFilters) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const toggleJpExclusiveFilter = () => {
    setFilters((prev) => ({ ...prev, jpExclusive: prev.jpExclusive ? undefined : true }));
  };

  const getFilterBadgeLabel = (key: string, value: unknown) => {
    if (key === 'jpExclusive') return 'JP Exclusive';
    return String(value);
  };

  const activeFilterCount = Object.values(filters).reduce((count, value) => {
    if (Array.isArray(value)) {
      return count + value.length;
    }
    return count + (value ? 1 : 0);
  }, 0);

  const derivedJpExclusiveCount = useMemo(
    () => characters.filter((character) => character.jpExclusive === true).length,
    [characters]
  );
  const jpExclusiveCount = apiJpExclusiveCount ?? derivedJpExclusiveCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-col bg-background h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden">
        {/* Top Toolbar */}
        <div className="border-b border-border bg-background shrink-0">
          <div className="p-3 md:p-4 flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap">
            {/* Language Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1 order-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={language === 'en' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLanguage('en')}
                    className="h-8 w-9 md:w-auto md:px-3 p-0 md:p-2"
                  >
                    <span className="md:hidden">🇬🇧</span>
                    <span className="hidden md:inline">🇬🇧 EN</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="md:hidden"><p>English</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={language === 'jp' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLanguage('jp')}
                    className="h-8 w-9 md:w-auto md:px-3 p-0 md:p-2"
                  >
                    <span className="md:hidden">🇯🇵</span>
                    <span className="hidden md:inline">🇯🇵 JP</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="md:hidden"><p>Japanese</p></TooltipContent>
              </Tooltip>
            </div>

            {/* Search with Autocomplete (mobile/tablet) */}
            <div className="flex-1 relative order-3 md:order-2 w-full md:w-auto lg:hidden">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Search name, face, VA, or use id:/face:/va:/rarity:..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (!showSuggestions || searchSuggestions.length === 0) return;
                  
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSuggestionIndex(prev => 
                      prev < searchSuggestions.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                  } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                    e.preventDefault();
                    setSearchTerm(searchSuggestions[selectedSuggestionIndex].value);
                    setShowSuggestions(false);
                    setSelectedSuggestionIndex(-1);
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                    setSelectedSuggestionIndex(-1);
                  }
                }}
                className="pl-9 pr-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Autocomplete Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-auto">
                  {searchSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      ref={(el) => { suggestionRefs.current[idx] = el; }}
                      className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 transition-colors ${
                        idx === selectedSuggestionIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                      onMouseDown={() => {
                        setSearchTerm(suggestion.value);
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                    >
                      <span className="truncate text-sm">{suggestion.text}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{suggestion.type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Button (mobile/tablet only) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterModalOpen(true)}
              className="h-10 px-3 md:px-4 gap-2 order-2 md:order-3 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Button
              variant={filters.jpExclusive ? 'default' : 'outline'}
              size="sm"
              onClick={toggleJpExclusiveFilter}
              className="h-10 px-3 md:px-4 order-2 md:order-3"
              title="Show JP-exclusive characters"
            >
              JP Only
            </Button>

            {/* Layout Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1 order-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layout === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLayout('grid')}
                    className="h-8 w-9 p-0"
                    title="Grid view"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Grid View</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layout === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setLayout('list')}
                    className="h-8 w-9 p-0"
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>List View</p></TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Active Filters Bar */}
          {activeFilterCount > 0 && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap lg:hidden">
              <span className="text-sm text-muted-foreground shrink-0">Filters:</span>
              <div className="flex flex-wrap gap-2 flex-1">
                {Object.entries(filters).map(([key, value]) => {
                  if (Array.isArray(value)) {
                    return value.map((item) => (
                      <Badge key={`${key}-${item}`} variant="secondary" className="gap-1">
                        {item}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => {
                            if (key === 'race') {
                              setFilters(prev => {
                                const newRace = (prev.race || []).filter(r => r !== item);
                                return { ...prev, race: newRace.length > 0 ? newRace : undefined };
                              });
                            }
                          }}
                        />
                      </Badge>
                    ));
                  }
                  return (
                    <Badge key={key} variant="secondary" className="gap-1">
                      {getFilterBadgeLabel(key, value)}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => clearFilter(key as keyof CharacterFilters)}
                      />
                    </Badge>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="shrink-0 h-7">
                Clear All
              </Button>
            </div>
          )}

          {/* Results Count */}
          <div className="px-4 pb-3 text-sm text-muted-foreground lg:hidden">
            {filteredCharacters.length} of {characters.length} characters
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <aside className="hidden lg:flex lg:w-[320px] xl:w-[360px] shrink-0 border-r border-border bg-card/30 flex-col min-h-0">
            <div className="p-4 border-b border-border space-y-3">
              <div className="text-sm text-muted-foreground">
                {filteredCharacters.length} of {characters.length} characters
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="text"
                placeholder="Search name, face, VA, or use id:/face:/va:/rarity:..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={(e) => {
                    if (!showSuggestions || searchSuggestions.length === 0) return;

                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev =>
                        prev < searchSuggestions.length - 1 ? prev + 1 : prev
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                      e.preventDefault();
                    setSearchTerm(searchSuggestions[selectedSuggestionIndex].value);
                      setShowSuggestions(false);
                      setSelectedSuggestionIndex(-1);
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                      setSelectedSuggestionIndex(-1);
                    }
                  }}
                  className="pl-9 pr-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-auto">
                    {searchSuggestions.map((suggestion, idx) => (
                      <button
                        key={`desktop-${idx}`}
                        ref={(el) => {
                          suggestionRefs.current[idx] = el;
                        }}
                        className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 transition-colors ${
                          idx === selectedSuggestionIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onMouseDown={() => {
                        setSearchTerm(suggestion.value);
                          setShowSuggestions(false);
                          setSelectedSuggestionIndex(-1);
                        }}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                      >
                        <span className="truncate text-sm">{suggestion.text}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {suggestion.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-2.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {activeFilterCount > 0 ? `${activeFilterCount} active` : 'No Active Filters'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 px-2 text-xs"
                  disabled={activeFilterCount === 0}
                >
                  Clear All
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-3 py-3">
              <div className="space-y-3">
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Region</label>
                    {filters.jpExclusive && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, jpExclusive: undefined }))} className="h-6 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <Button
                    variant={filters.jpExclusive ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleJpExclusiveFilter}
                    className="h-8 w-full justify-between text-xs"
                  >
                    <span>JP Exclusive</span>
                    <Badge variant={filters.jpExclusive ? 'secondary' : 'outline'} className="text-[10px]">
                      {jpExclusiveCount}
                    </Badge>
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attribute</label>
                    {filters.attribute && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, attribute: undefined }))} className="h-6 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {filterOptions.attributes.map((attr) => (
                      <Tooltip key={attr}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setFilters(prev => ({ ...prev, attribute: prev.attribute === attr ? undefined : attr }))}
                            aria-label={`Filter by ${attr} attribute`}
                            className={`relative h-9 w-9 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                              filters.attribute === attr
                                ? 'border-primary bg-primary/10'
                                : 'opacity-75 hover:opacity-100 hover:border-border'
                            }`}
                          >
                            <Image
                              src={getAttributeIcon(attr)}
                              alt={attr}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{attr}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weapon Type</label>
                    {filters.weaponType && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, weaponType: undefined }))} className="h-6 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {filterOptions.weaponTypes.map((weapon) => (
                      <Tooltip key={weapon}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setFilters(prev => ({ ...prev, weaponType: prev.weaponType === weapon ? undefined : weapon }))}
                            aria-label={`Filter by ${weapon} weapon`}
                            className={`relative h-9 w-9 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                              filters.weaponType === weapon
                                ? 'border-primary bg-primary/10'
                                : 'opacity-75 hover:opacity-100 hover:border-border'
                            }`}
                          >
                            <Image
                              src={getWeaponTypeIcon(weapon)}
                              alt={weapon}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{weapon}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stance</label>
                    {filters.stance && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, stance: undefined }))} className="h-6 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {filterOptions.stances.map((stance) => (
                      <Tooltip key={stance}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setFilters(prev => ({ ...prev, stance: prev.stance === stance ? undefined : stance }))}
                            aria-label={`Filter by ${stance} stance`}
                            className={`relative h-9 w-9 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                              filters.stance === stance
                                ? 'border-primary bg-primary/10'
                                : 'opacity-75 hover:opacity-100 hover:border-border'
                            }`}
                          >
                            <Image
                              src={getStanceIcon(stance)}
                              alt={stance}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{stance}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rarity</label>
                    {filters.rarity && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, rarity: undefined }))} className="h-6 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-nowrap items-center justify-center gap-1">
                    {[...filterOptions.rarities]
                      .sort((a, b) => Number(a) - Number(b))
                      .map((rarity) => {
                        // Scale width by star count so all rarity strips fit on one row.
                        const starCount = Math.max(1, Math.min(5, Number(rarity) || 1));
                        const buttonWidth = 22 + starCount * 12;
                        return (
                          <button
                            key={rarity}
                            onClick={() => setFilters(prev => ({ ...prev, rarity: prev.rarity === rarity ? undefined : rarity }))}
                            className={`flex h-6 items-center justify-center rounded-md border border-border/50 bg-background/40 px-1 transition-colors ${
                              filters.rarity === rarity
                                ? 'border-primary bg-primary/10 opacity-100'
                                : 'opacity-80 hover:opacity-100 hover:border-border'
                            }`}
                            style={{ width: `${buttonWidth}px` }}
                            title={`${rarity} star rarity`}
                            aria-label={`Filter by ${rarity} star rarity`}
                          >
                            <Image
                              src={getRarityIcon(rarity)}
                              alt={`${rarity} star`}
                              width={buttonWidth - 8}
                              height={18}
                              unoptimized
                              className="h-[16px] w-full object-contain"
                            />
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Race <span className="text-[10px] font-normal">(Multi-select)</span></label>
                    {filters.race && filters.race.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, race: undefined }))} className="h-6 px-2 text-xs">
                        Clear ({filters.race.length})
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {filterOptions.races.map((race) => (
                      <Tooltip key={race}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              setFilters(prev => {
                                const currentRaces = prev.race || [];
                                const isSelected = currentRaces.includes(race);
                                const newRaces = isSelected
                                  ? currentRaces.filter(r => r !== race)
                                  : [...currentRaces, race];
                                return { ...prev, race: newRaces.length > 0 ? newRaces : undefined };
                              })
                            }
                            aria-label={`Filter by ${race} race`}
                            className={`relative h-9 w-9 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                              filters.race?.includes(race)
                                ? 'border-primary bg-primary/10'
                                : 'opacity-75 hover:opacity-100 hover:border-border'
                            }`}
                          >
                            <Image
                              src={getRaceIcon(race)}
                              alt={race}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{race}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gender</label>
                    {filters.gender && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, gender: undefined }))} className="h-6 px-2 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-nowrap gap-1">
                    {orderedGenders.map((gender) => (
                      <Button
                        key={gender}
                        size="sm"
                        variant={filters.gender === gender ? 'default' : 'outline'}
                        onClick={() => setFilters(prev => ({ ...prev, gender: prev.gender === gender ? undefined : gender }))}
                        className="h-6 min-w-0 flex-1 px-1.5 text-[10px]"
                      >
                        {gender}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>

          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
            <div className="p-2 sm:p-3 lg:p-2 pb-20">
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No characters found</p>
                {(activeFilterCount > 0 || searchTerm) && (
                  <Button variant="link" onClick={() => { clearAllFilters(); setSearchTerm(''); }} className="mt-2">
                    Clear all filters and search
                  </Button>
                )}
              </div>
            ) : layout === 'grid' ? (
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16 gap-0.5">
                  {paginatedCharacters.map((char) => {
                    const raceTokens = Array.from(
                      new Set(
                        char.race
                          .split('/')
                          .map((token) => token.trim())
                          .filter(Boolean)
                      )
                    );
                    return (
                      <Tooltip key={char.id}>
                        <TooltipTrigger asChild>
                          <Card
                            className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer rounded-sm"
                            onClick={() => router.push(`/characters/${char.faceCode}`)}
                          >
                            <CardContent className="p-0.5 flex flex-col items-center">
                              <div className="w-full aspect-square relative bg-muted rounded-sm overflow-hidden mb-0.5">
                                <CharacterPortrait
                                  src={getCharacterImage(char.faceCode)}
                                  name={getCharacterName(char)}
                                />
                                {/* Attribute icon overlay */}
                                <div className="absolute top-0.5 right-0.5 h-4 w-4 overflow-hidden sm:h-8 sm:w-8">
                                  <Image
                                    src={getAttributeIcon(char.attribute)}
                                    alt={char.attribute}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                </div>
                              </div>
                              <div className="text-[11px] font-medium text-center w-full overflow-hidden whitespace-nowrap group/name" title={getCharacterName(char)}>
                                <span className="inline-block group-hover/name:animate-scroll-text">
                                  {getCharacterName(char)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" sideOffset={6} className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="relative h-5 w-5 rounded-sm overflow-hidden">
                              <Image
                                src={getWeaponTypeIcon(char.weaponType)}
                                alt={char.weaponType}
                                fill
                                className="object-contain p-0.5"
                                unoptimized
                              />
                            </div>
                            <div className="relative h-5 w-5 rounded-sm overflow-hidden">
                              <Image
                                src={getStanceIcon(char.stance)}
                                alt={char.stance}
                                fill
                                className="object-contain p-0.5"
                                unoptimized
                              />
                            </div>
                            <div className="h-4 w-px bg-border/70" />
                            <div className="flex items-center gap-1">
                              {raceTokens.map((race) => (
                                <div key={`${char.id}-${race}`} className="relative h-5 w-5 rounded-sm overflow-hidden">
                                  <Image
                                    src={getRaceIcon(race)}
                                    alt={race}
                                    fill
                                    className="object-contain p-0.5"
                                    unoptimized
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedCharacters.map((char) => (
                    <Card
                      key={char.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => router.push(`/characters/${char.faceCode}`)}
                    >
                      <div className="flex gap-4 p-4">
                        <div className="w-20 h-20 shrink-0 relative bg-muted rounded-md overflow-hidden">
                          <CharacterPortrait
                            src={getCharacterImage(char.faceCode)}
                            name={getCharacterName(char)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{getCharacterName(char)}</h4>
                          <p className="text-sm text-muted-foreground truncate">{getCharacterTitle(char)}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{char.attribute}</Badge>
                            <Badge variant="outline" className="text-xs">{char.weaponType}</Badge>
                            <Badge variant="outline" className="text-xs">{char.stance}</Badge>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">{char.race}</p>
                          <p className="text-xs text-muted-foreground mt-1">{'⭐'.repeat(parseInt(char.rarity) || 1)}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-3 shadow-lg z-50">
          <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>
            
            {/* Page Numbers */}
            {(() => {
              const pageNumbers = [];
              const maxVisible = 7; // Maximum number of page buttons to show
              
              if (totalPages <= maxVisible) {
                // Show all pages if total is small
                for (let i = 1; i <= totalPages; i++) {
                  pageNumbers.push(i);
                }
              } else {
                // Smart pagination with ellipsis
                if (currentPage <= 4) {
                  // Near start: 1 2 3 4 5 ... last
                  for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                  pageNumbers.push('...');
                  pageNumbers.push(totalPages);
                } else if (currentPage >= totalPages - 3) {
                  // Near end: 1 ... last-4 last-3 last-2 last-1 last
                  pageNumbers.push(1);
                  pageNumbers.push('...');
                  for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
                } else {
                  // Middle: 1 ... current-1 current current+1 ... last
                  pageNumbers.push(1);
                  pageNumbers.push('...');
                  pageNumbers.push(currentPage - 1);
                  pageNumbers.push(currentPage);
                  pageNumbers.push(currentPage + 1);
                  pageNumbers.push('...');
                  pageNumbers.push(totalPages);
                }
              }
              
              return pageNumbers.map((page, idx) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  );
                }
                
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page as number)}
                    className="min-w-[2.5rem]"
                  >
                    {page}
                  </Button>
                );
              });
            })()}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent
          className="w-[calc(100vw-1rem)] max-w-5xl max-h-[92dvh] overflow-hidden p-0 flex flex-col sm:max-h-[90vh]"
          onPointerMove={() => {
            if (!modalTooltipsArmed) setModalTooltipsArmed(true);
          }}
          onKeyDown={() => {
            if (!modalTooltipsArmed) setModalTooltipsArmed(true);
          }}
        >
          <DialogHeader className="border-b border-border/70 px-3 py-3 sm:px-4 sm:py-3.5">
            <DialogTitle className="text-lg font-bold sm:text-2xl">Filter Characters</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 px-2 py-2 sm:px-4 sm:py-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {/* Region Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Region</label>
                  {filters.jpExclusive && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, jpExclusive: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear
                    </Button>
                  )}
                </div>
                <Button
                  variant={filters.jpExclusive ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleJpExclusiveFilter}
                  className="h-8 w-full justify-between text-[11px]"
                >
                  <span>JP Exclusive</span>
                  <Badge variant={filters.jpExclusive ? 'secondary' : 'outline'} className="text-[10px]">
                    {jpExclusiveCount}
                  </Badge>
                </Button>
              </div>

              {/* Attribute Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Attribute</label>
                  {filters.attribute && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, attribute: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {filterOptions.attributes.map((attr) => (
                    <Tooltip key={attr} open={modalTooltipsArmed ? undefined : false}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, attribute: prev.attribute === attr ? undefined : attr }))}
                          aria-label={`Filter by ${attr} attribute`}
                          className={`relative h-8 w-8 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                            filters.attribute === attr
                              ? 'border-primary bg-primary/10'
                              : 'opacity-75 hover:opacity-100 hover:border-border'
                          }`}
                        >
                          <Image
                            src={getAttributeIcon(attr)}
                            alt={attr}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{attr}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Weapon Type Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Weapon Type</label>
                  {filters.weaponType && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, weaponType: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {filterOptions.weaponTypes.map((weapon) => (
                    <Tooltip key={weapon} open={modalTooltipsArmed ? undefined : false}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, weaponType: prev.weaponType === weapon ? undefined : weapon }))}
                          aria-label={`Filter by ${weapon} weapon`}
                          className={`relative h-8 w-8 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                            filters.weaponType === weapon
                              ? 'border-primary bg-primary/10'
                              : 'opacity-75 hover:opacity-100 hover:border-border'
                          }`}
                        >
                          <Image
                            src={getWeaponTypeIcon(weapon)}
                            alt={weapon}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{weapon}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Stance Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Stance</label>
                  {filters.stance && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, stance: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {filterOptions.stances.map((stance) => (
                    <Tooltip key={stance} open={modalTooltipsArmed ? undefined : false}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, stance: prev.stance === stance ? undefined : stance }))}
                          aria-label={`Filter by ${stance} stance`}
                          className={`relative h-8 w-8 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                            filters.stance === stance
                              ? 'border-primary bg-primary/10'
                              : 'opacity-75 hover:opacity-100 hover:border-border'
                          }`}
                        >
                          <Image
                            src={getStanceIcon(stance)}
                            alt={stance}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{stance}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Rarity Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Rarity</label>
                  {filters.rarity && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, rarity: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {[...filterOptions.rarities].sort((a, b) => Number(a) - Number(b)).map((rarity) => (
                    <button
                      key={rarity}
                      onClick={() => setFilters(prev => ({ ...prev, rarity: prev.rarity === rarity ? undefined : rarity }))}
                      className={`flex h-5 items-center justify-center rounded border border-border/50 bg-background/40 px-1 transition-colors ${
                        filters.rarity === rarity
                          ? 'border-primary bg-primary/10 opacity-100'
                          : 'opacity-80 hover:opacity-100 hover:border-border'
                      }`}
                      style={{ width: `${18 + Math.max(1, Math.min(5, Number(rarity) || 1)) * 10}px` }}
                      title={`${rarity} star rarity`}
                      aria-label={`Filter by ${rarity} star rarity`}
                    >
                      <Image
                        src={getRarityIcon(rarity)}
                        alt={`${rarity} star`}
                        width={64}
                        height={16}
                        unoptimized
                        className="h-[14px] w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Race Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                    Race <span className="text-[10px] font-normal">(Multi)</span>
                  </label>
                  {filters.race && filters.race.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, race: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear ({filters.race.length})
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {filterOptions.races.map((race) => (
                    <Tooltip key={race} open={modalTooltipsArmed ? undefined : false}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setFilters(prev => {
                            const currentRaces = prev.race || [];
                            const isSelected = currentRaces.includes(race);
                            const newRaces = isSelected
                              ? currentRaces.filter(r => r !== race)
                              : [...currentRaces, race];
                            return { ...prev, race: newRaces.length > 0 ? newRaces : undefined };
                          })}
                          aria-label={`Filter by ${race} race`}
                          className={`relative h-8 w-8 rounded-md border border-border/50 bg-background/40 overflow-hidden transition-colors ${
                            filters.race?.includes(race)
                              ? 'border-primary bg-primary/10'
                              : 'opacity-75 hover:opacity-100 hover:border-border'
                          }`}
                        >
                          <Image
                            src={getRaceIcon(race)}
                            alt={race}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{race}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Gender Filter */}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">Gender</label>
                  {filters.gender && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, gender: undefined }))} className="h-5 px-1.5 text-[10px]">
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {orderedGenders.map((gender) => (
                    <Button
                      key={gender}
                      variant={filters.gender === gender ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, gender: prev.gender === gender ? undefined : gender }))}
                      className="h-7 text-[11px]"
                    >
                      {gender}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t border-border/70 bg-background px-3 py-2.5 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground sm:text-sm">
                {activeFilterCount > 0 && (
                  <span>{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={clearAllFilters} disabled={activeFilterCount === 0} className="h-8">
                  Clear All
                </Button>
                <Button size="sm" onClick={() => setFilterModalOpen(false)} className="h-8">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function CharactersPageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading characters...
        </CardContent>
      </Card>
    </div>
  );
}

export default function CharactersPage() {
  return (
    <Suspense fallback={<CharactersPageFallback />}>
      <CharactersPageClient />
    </Suspense>
  );
}

