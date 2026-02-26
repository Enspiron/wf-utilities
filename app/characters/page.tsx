'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, X, Grid3x3, List, Loader2, User, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Character, CharacterFilters, filterCharacters, getUniqueValues } from '@/lib/character-parser';

const ITEMS_PER_PAGE = 48;

// Icon mapping helpers
const getAttributeIcon = (attr: string) => {
  const map: Record<string, string> = {
    'Fire': 'red',
    'Water': 'blue',
    'Thunder': 'yellow',
    'Wind': 'green',
    'Light': 'white',
    'Dark': 'black',
  };
  return `/FilterIcons/elements/element_${map[attr] || attr.toLowerCase()}_medium.png`;
};

const getWeaponTypeIcon = (type: string) => {
  const map: Record<string, string> = {
    'Slash': 'fighter',
    'Strike': 'knight',
    'Thrust': 'special',
    'Shot': 'ranged',
    'Support': 'supporter',
  };
  const iconName = map[type] || type.toLowerCase();
  return `/FilterIcons/types/type_${iconName}_medium.png`;
};

const getStanceIcon = (stance: string) => {
  const map: Record<string, string> = {
    'Supporter': 'buffer',
    'Jammer': 'debuffer',
  };
  const iconName = map[stance] || stance.toLowerCase();
  return `/FilterIcons/stances/stance_${iconName}_medium.png`;
};

const getRaceIcon = (race: string) => {
  const map: Record<string, string> = {
    'Mecha': 'machine',
    'Sprite': 'element',
    'Demon': 'devil',
    'Plant': 'plants',
    'Youkai': 'mystery',
    'Human / Youkai': 'mystery',  // Handle hybrid races
  };
  // Clean race name: take first part if it contains a slash, remove special chars
  const cleanedRace = race.includes('/') ? race.split('/')[0].trim() : race;
  const iconName = map[race] || map[cleanedRace] || cleanedRace.toLowerCase();
  return `/FilterIcons/races/race_${iconName}_medium.png`;
};

const getRarityIcon = (rarity: string) => {
  const rarityMap: Record<string, string> = {
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
  };
  const rarityWord = rarityMap[rarity] || 'five';
  return `/FilterIcons/rarity/rarity_${rarityWord}.png`;
};

export default function CharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'jp' | 'en'>('en');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  const [filters, setFilters] = useState<CharacterFilters>({});

  // Fetch characters
  useEffect(() => {
    async function loadCharacters() {
      setLoading(true);
      try {
        const response = await fetch('/api/characters?lang=both');
        const data = await response.json();
        setCharacters(data.characters || []);
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

  // Apply filters and search
  const filteredCharacters = useMemo(() => {
    let result = filterCharacters(characters, filters);
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((char) =>
        char.nameJP.toLowerCase().includes(term) ||
        char.nameEN?.toLowerCase().includes(term) ||
        char.subNameJP.toLowerCase().includes(term) ||
        char.subNameEN?.toLowerCase().includes(term) ||
        char.titleJP.toLowerCase().includes(term) ||
        char.titleEN?.toLowerCase().includes(term) ||
        char.faceCode.toLowerCase().includes(term) ||
        char.voiceActorJP.toLowerCase().includes(term) ||
        char.voiceActorEN?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [characters, filters, searchTerm]);

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

  // Autocomplete suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const term = searchTerm.toLowerCase();
    const suggestions: Array<{ text: string; type: string; char: Character }> = [];
    
    characters.forEach((char) => {
      if (char.nameJP.toLowerCase().includes(term)) {
        suggestions.push({ text: char.nameJP, type: 'Name (JP)', char });
      }
      if (char.nameEN?.toLowerCase().includes(term)) {
        suggestions.push({ text: char.nameEN, type: 'Name (EN)', char });
      }
      if (char.faceCode.toLowerCase().includes(term)) {
        suggestions.push({ text: char.faceCode, type: 'Face Code', char });
      }
    });
    
    const uniqueSuggestions = suggestions
      .filter((s, i, arr) => arr.findIndex(x => x.text === s.text) === i)
      .slice(0, 10);
    
    return uniqueSuggestions;
  }, [searchTerm, characters]);

  // Pagination
  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);
  const paginatedCharacters = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredCharacters.slice(startIndex, endIndex);
  }, [filteredCharacters, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

  // Scroll to top when page changes
  useEffect(() => {
    // Find the ScrollArea viewport and scroll to top
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

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
    return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceCode}/ui/square_0.png`;
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

  const activeFilterCount = Object.values(filters).reduce((count, value) => {
    if (Array.isArray(value)) {
      return count + value.length;
    }
    return count + (value ? 1 : 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col bg-background h-screen max-h-screen overflow-hidden">
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

            {/* Search with Autocomplete */}
            <div className="flex-1 relative order-3 md:order-2 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Search by name, face code..."
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
                    setSearchTerm(searchSuggestions[selectedSuggestionIndex].text);
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
                        setSearchTerm(suggestion.text);
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

            {/* Filter Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterModalOpen(true)}
              className="h-10 px-3 md:px-4 gap-2 order-2 md:order-3"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
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
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
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
                      {value}
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
          <div className="px-4 pb-3 text-sm text-muted-foreground">
            {filteredCharacters.length} of {characters.length} characters
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto min-h-0">
          <div className="p-4 pb-20">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1">
                  {paginatedCharacters.map((char) => (
                    <Card
                      key={char.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer rounded-sm"
                      onClick={() => router.push(`/characters/${char.faceCode}`)}
                    >
                      <CardContent className="px-0.5 py-1 flex flex-col items-center">
                        <div className="w-1/2 aspect-square relative bg-muted rounded-md overflow-hidden mb-1">
                          <Image
                            src={getCharacterImage(char.faceCode)}
                            alt={getCharacterName(char)}
                            fill
                            className="object-contain"
                            loading="lazy"
                            unoptimized
                          />
                          {/* Attribute icon overlay */}
                          <div className="absolute bottom-1 right-1 w-6 h-6 rounded-md overflow-hidden bg-background/80 backdrop-blur-sm shadow-lg">
                            <Image
                              src={getAttributeIcon(char.attribute)}
                              alt={char.attribute}
                              fill
                              className="object-contain p-0.5"
                              unoptimized
                            />
                          </div>
                        </div>
                        <div className="text-xs font-medium text-center w-full overflow-hidden whitespace-nowrap group/name" title={getCharacterName(char)}>
                          <span className="inline-block group-hover/name:animate-scroll-text">
                            {getCharacterName(char)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                          <Image
                            src={getCharacterImage(char.faceCode)}
                            alt={getCharacterName(char)}
                            fill
                            className="object-contain"
                            loading="lazy"
                            unoptimized
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
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Filter Characters</DialogTitle>
            </DialogHeader>
            
            <ScrollArea className="flex-1 pr-2 min-h-0 [&>[data-radix-scroll-area-viewport]]:max-h-[60vh]">
              <div className="space-y-6 py-4">
                {/* Attribute Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attribute</label>
                    {filters.attribute && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, attribute: undefined }))} className="h-6 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
                      {filterOptions.attributes.map((attr) => (
                        <Tooltip key={attr}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setFilters(prev => ({ ...prev, attribute: prev.attribute === attr ? undefined : attr }))}
                              aria-label={`Filter by ${attr} attribute`}
                              className={`relative w-[50px] h-[50px] rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                filters.attribute === attr
                                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105'
                                  : 'opacity-60 hover:opacity-100'
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
                </div>

                <div className="border-t" />

                {/* Weapon Type Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Weapon Type</label>
                    {filters.weaponType && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, weaponType: undefined }))} className="h-6 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
                      {filterOptions.weaponTypes.map((weapon) => (
                        <Tooltip key={weapon}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setFilters(prev => ({ ...prev, weaponType: prev.weaponType === weapon ? undefined : weapon }))}
                              aria-label={`Filter by ${weapon} weapon`}
                              className={`relative w-[50px] h-[50px] rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                filters.weaponType === weapon
                                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105'
                                  : 'opacity-60 hover:opacity-100'
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
                </div>

                <div className="border-t" />

                {/* Stance Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stance</label>
                    {filters.stance && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, stance: undefined }))} className="h-6 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
                      {filterOptions.stances.map((stance) => (
                        <Tooltip key={stance}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setFilters(prev => ({ ...prev, stance: prev.stance === stance ? undefined : stance }))}
                              aria-label={`Filter by ${stance} stance`}
                              className={`relative w-[50px] h-[50px] rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                filters.stance === stance
                                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105'
                                  : 'opacity-60 hover:opacity-100'
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
                </div>

                <div className="border-t" />

                {/* Rarity Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rarity</label>
                    {filters.rarity && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, rarity: undefined }))} className="h-6 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {filterOptions.rarities.map((rarity) => (
                        <button
                          key={rarity}
                          onClick={() => setFilters(prev => ({ ...prev, rarity: prev.rarity === rarity ? undefined : rarity }))}
                          className={`w-[108px] h-[22px] flex items-center justify-center transition-all hover:scale-105 ${
                            filters.rarity === rarity ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105' : 'opacity-60 hover:opacity-100'
                          }`}
                          title={`${rarity} star rarity`}
                          aria-label={`Filter by ${rarity} star rarity`}
                        >
                          <Image
                            src={getRarityIcon(rarity)}
                            alt={`${rarity} star`}
                            width={108}
                            height={22}
                            unoptimized
                            className="object-contain w-full h-full"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Race Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Race <span className="text-xs font-normal">(Multi-select)</span></label>
                    {filters.race && filters.race.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, race: undefined }))} className="h-6 text-xs">
                        Clear ({filters.race.length})
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
                      {filterOptions.races.map((race) => (
                        <Tooltip key={race}>
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
                              className={`relative w-[50px] h-[50px] rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                filters.race?.includes(race)
                                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105'
                                  : 'opacity-60 hover:opacity-100'
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
                </div>

                <div className="border-t" />

                {/* Gender Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gender</label>
                    {filters.gender && (
                      <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, gender: undefined }))} className="h-6 text-xs">
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {filterOptions.genders.map((gender) => (
                        <Button
                          key={gender}
                          variant={filters.gender === gender ? 'default' : 'outline'}
                          size="default"
                          onClick={() => setFilters(prev => ({ ...prev, gender: prev.gender === gender ? undefined : gender }))}
                          className="min-w-[100px]"
                        >
                          {gender}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {activeFilterCount > 0 && (
                  <span>{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearAllFilters} disabled={activeFilterCount === 0}>
                  Clear All
                </Button>
                <Button onClick={() => setFilterModalOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </TooltipProvider>
  );
}
