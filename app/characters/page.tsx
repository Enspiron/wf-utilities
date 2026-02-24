'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Search, X, Grid3x3, List, Loader2, User, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Character, CharacterFilters, filterCharacters, getUniqueValues } from '@/lib/character-parser';

const ITEMS_PER_PAGE = 24;

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
  // Map weapon types to available icon names
  const map: Record<string, string> = {
    'Slash': 'fighter',
    'Strike': 'knight',
    'Thrust': 'special',
    'Shot': 'ranged',
  };
  const iconName = map[type] || type.toLowerCase();
  return `/FilterIcons/types/type_${iconName}_medium.png`;
};

const getStanceIcon = (stance: string) => {
  // Map stances to available icon names
  const map: Record<string, string> = {
    'Supporter': 'buffer',
    'Jammer': 'debuffer',
  };
  const iconName = map[stance] || stance.toLowerCase();
  return `/FilterIcons/stances/stance_${iconName}_medium.png`;
};

const getRaceIcon = (race: string) => {
  return `/FilterIcons/races/race_${race.toLowerCase()}_medium.png`;
};

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'jp' | 'en'>('jp');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  const [filters, setFilters] = useState<CharacterFilters>({});

  // Fetch characters (both languages at once)
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
      voiceActors: [],
    };

    return {
      attributes: getUniqueValues(characters, 'attribute'),
      weaponTypes: getUniqueValues(characters, 'weaponType'),
      races: getUniqueValues(characters, 'race'),
      genders: getUniqueValues(characters, 'gender'),
      rarities: getUniqueValues(characters, 'rarity'),
      stances: getUniqueValues(characters, 'stance'),
      voiceActors: getUniqueValues(characters, 'voiceActorJP'),
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

  const getCharacterDescription = useCallback((char: Character) => {
    if (language === 'jp') return char.descriptionJP;
    if (language === 'en' && char.descriptionEN) return char.descriptionEN;
    return char.descriptionEN || char.descriptionJP;
  }, [language]);

  const getSkillName = useCallback((char: Character) => {
    if (language === 'jp') return char.skillNameJP;
    if (language === 'en' && char.skillNameEN) return char.skillNameEN;
    return char.skillNameEN || char.skillNameJP;
  }, [language]);

  const getSkillDescription = useCallback((char: Character) => {
    if (language === 'jp') return char.skillDescriptionJP;
    if (language === 'en' && char.skillDescriptionEN) return char.skillDescriptionEN;
    return char.skillDescriptionEN || char.skillDescriptionJP;
  }, [language]);

  const getLeaderAbilityName = useCallback((char: Character) => {
    if (language === 'jp') return char.leaderAbilityNameJP;
    if (language === 'en' && char.leaderAbilityNameEN) return char.leaderAbilityNameEN;
    return char.leaderAbilityNameEN || char.leaderAbilityNameJP;
  }, [language]);

  const getVoiceActor = useCallback((char: Character) => {
    if (language === 'jp') return char.voiceActorJP;
    if (language === 'en' && char.voiceActorEN) return char.voiceActorEN;
    return char.voiceActorEN || char.voiceActorJP;
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
    setSearchTerm('');
  };

  const activeFilterCount = Object.keys(filters).length;

  // Filters sidebar content component (reusable for desktop and mobile)
  const FiltersSidebar = useMemo(() => (
    <>
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Characters</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filteredCharacters.length} of {characters.length} characters
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Language Toggle */}
          <div>
            <label className="text-sm font-medium mb-2 block">Language</label>
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={language === 'jp' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLanguage('jp')}
                className="flex-1 h-8"
              >
                🇯🇵 JP
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLanguage('en')}
                className="flex-1 h-8"
              >
                🇬🇧 EN
              </Button>
            </div>
          </div>

          {/* Layout Toggle */}
          <div>
            <label className="text-sm font-medium mb-2 block">Layout</label>
            <div className="flex flex-col gap-2">
              <Button
                variant={layout === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLayout('grid')}
                className="justify-start"
              >
                <Grid3x3 className="mr-2 h-4 w-4" />
                Grid
              </Button>
              <Button
                variant={layout === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLayout('list')}
                className="justify-start"
              >
                <List className="mr-2 h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search characters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Active Filters */}
          {activeFilterCount > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Active Filters</label>
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="gap-1">
                    {value}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => clearFilter(key as keyof CharacterFilters)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Attribute Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Attribute</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.attributes.map((attr) => (
                <Tooltip key={attr}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, attribute: attr }))}
                      aria-label={`Filter by ${attr} attribute`}
                      className={`relative w-10 h-10 rounded-md overflow-hidden transition-all ${
                        filters.attribute === attr
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={getAttributeIcon(attr)}
                        alt={attr}
                        fill
                        className="object-contain"
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
          <div>
            <label className="text-sm font-medium mb-2 block">Weapon Type</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.weaponTypes.map((weapon) => (
                <Tooltip key={weapon}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, weaponType: weapon }))}
                      aria-label={`Filter by ${weapon} weapon type`}
                      className={`relative w-10 h-10 rounded-md overflow-hidden transition-all ${
                        filters.weaponType === weapon
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={getWeaponTypeIcon(weapon)}
                        alt={weapon}
                        fill
                        className="object-contain"
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
          <div>
            <label className="text-sm font-medium mb-2 block">Stance</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.stances.map((stance) => (
                <Tooltip key={stance}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, stance: stance }))}
                      aria-label={`Filter by ${stance} stance`}
                      className={`relative w-10 h-10 rounded-md overflow-hidden transition-all ${
                        filters.stance === stance
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={getStanceIcon(stance)}
                        alt={stance}
                        fill
                        className="object-contain"
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
          <div>
            <label className="text-sm font-medium mb-2 block">Rarity</label>
            <div className="flex flex-col gap-2">
              {filterOptions.rarities.map((rarity) => (
                <Button
                  key={rarity}
                  variant={filters.rarity === rarity ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, rarity: rarity }))}
                  className="justify-start"
                >
                  {'⭐'.repeat(parseInt(rarity) || 1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Gender</label>
            <div className="flex flex-col gap-2">
              {filterOptions.genders.map((gender) => (
                <Button
                  key={gender}
                  variant={filters.gender === gender ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, gender: gender }))}
                  className="justify-start"
                >
                  {gender}
                </Button>
              ))}
            </div>
          </div>

          {/* Race Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Race</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.races.map((race) => (
                <Tooltip key={race}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, race: race }))}
                      aria-label={`Filter by ${race} race`}
                      className={`relative w-10 h-10 rounded-md overflow-hidden transition-all ${
                        filters.race === race
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={getRaceIcon(race)}
                        alt={race}
                        fill
                        className="object-contain"
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
      </ScrollArea>
    </>
  ), [filteredCharacters.length, characters.length, language, layout, searchTerm, filters, filterOptions, activeFilterCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex bg-background overflow-hidden" style={{ height: 'calc(100vh - 4rem - 1px)' }}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-80 border-r border-border flex-col">
        {FiltersSidebar}
      </div>

      {/* Mobile Filters Sheet */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" className="w-80 p-0">
          {FiltersSidebar}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header with Hamburger */}
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-2"
          >
            <Menu className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <div className="text-sm text-muted-foreground">
            {filteredCharacters.length} of {characters.length} characters
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No characters found</p>
                {activeFilterCount > 0 && (
                  <Button variant="link" onClick={clearAllFilters} className="mt-2">
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : layout === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {paginatedCharacters.map((char) => (
                <Card
                  key={char.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedCharacter(char)}
                >
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium truncate" title={getCharacterName(char)}>
                      {getCharacterName(char)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground truncate">{getCharacterTitle(char)}</p>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="aspect-square relative bg-muted rounded-md overflow-hidden mb-2 cursor-help">
                          <Image
                            src={getCharacterImage(char.faceCode)}
                            alt={getCharacterName(char)}
                            fill
                            className="object-contain"
                            loading="lazy"
                            unoptimized
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md break-all">
                        <p className="text-xs">{getCharacterImage(char.faceCode)}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="space-y-0.5">
                      <div className="flex gap-1 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{char.attribute}</Badge>
                        <Badge variant="outline" className="text-xs">{char.weaponType}</Badge>
                        <Badge variant="outline" className="text-xs">{'⭐'.repeat(parseInt(char.rarity) || 1)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Stance:</span> {char.stance}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Race:</span> {char.race || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" title={getVoiceActor(char)}>
                        <span className="font-semibold">VA:</span> {getVoiceActor(char)}
                      </p>
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
                    onClick={() => setSelectedCharacter(char)}
                  >
                    <div className="flex gap-4 p-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-20 h-20 shrink-0 relative bg-muted rounded-md overflow-hidden cursor-help">
                            <Image
                              src={getCharacterImage(char.faceCode)}
                              alt={getCharacterName(char)}
                              fill
                              className="object-contain"
                              loading="lazy"
                              unoptimized
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md break-all">
                          <p className="text-xs">{getCharacterImage(char.faceCode)}</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{getCharacterName(char)}</h4>
                        <p className="text-sm text-muted-foreground truncate">{getCharacterTitle(char)}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{char.attribute}</Badge>
                          <Badge variant="outline" className="text-xs">{char.weaponType}</Badge>
                          <Badge variant="outline" className="text-xs">{char.stance}</Badge>
                          <Badge variant="outline" className="text-xs">{'⭐'.repeat(parseInt(char.rarity) || 1)}</Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">ID: {char.id}</p>
                        <p className="text-xs text-muted-foreground mt-1">{char.race}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Fixed Pagination Footer */}
        {totalPages > 1 && (
          <div className="border-t border-border bg-background p-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {/* First page */}
                      {currentPage > 3 && (
                        <>
                          <Button
                            variant={currentPage === 1 ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            className="w-9 h-9 p-0"
                          >
                            1
                          </Button>
                          {currentPage > 4 && <span className="px-1 text-muted-foreground">...</span>}
                        </>
                      )}
                      
                      {/* Page numbers around current page */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          const distance = Math.abs(page - currentPage);
                          return distance <= 2;
                        })
                        .map(page => (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-9 h-9 p-0"
                          >
                            {page}
                          </Button>
                        ))
                      }
                      
                      {/* Last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && <span className="px-1 text-muted-foreground">...</span>}
                          <Button
                            variant={currentPage === totalPages ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-9 h-9 p-0"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <span className="text-xs text-muted-foreground">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredCharacters.length)} of {filteredCharacters.length} characters
                  </span>
            </div>
          </div>
        )}
      </div>

      {/* Character Detail Modal */}
      <Dialog open={!!selectedCharacter} onOpenChange={(open) => !open && setSelectedCharacter(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedCharacter && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>{getCharacterName(selectedCharacter)}</DialogTitle>
                  
                  {/* Language Toggle */}
                  <div className="flex items-center gap-1 border rounded-md p-1">
                    <Button
                      variant={language === 'jp' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setLanguage('jp')}
                      className="h-7 px-3 text-xs"
                    >
                      🇯🇵 JP
                    </Button>
                    <Button
                      variant={language === 'en' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setLanguage('en')}
                      className="h-7 px-3 text-xs"
                    >
                      🇬🇧 EN
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              <ScrollArea className="flex-1">
                <div className="space-y-6">
                  {/* Character Image and Basic Info */}
                  <div className="flex gap-6">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-48 h-48 shrink-0 relative bg-muted rounded-md overflow-hidden cursor-help">
                          <Image
                            src={getCharacterImage(selectedCharacter.faceCode)}
                            alt={getCharacterName(selectedCharacter)}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md break-all">
                        <p className="text-xs">{getCharacterImage(selectedCharacter.faceCode)}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold">{getCharacterName(selectedCharacter)}</h3>
                        <p className="text-sm text-muted-foreground">{getCharacterTitle(selectedCharacter)}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">ID</p>
                          <p className="text-sm font-mono">{selectedCharacter.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Face Code</p>
                          <p className="text-sm font-mono">{selectedCharacter.faceCode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rarity</p>
                          <p className="text-sm">{'⭐'.repeat(parseInt(selectedCharacter.rarity) || 1)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gender</p>
                          <p className="text-sm">{selectedCharacter.gender}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge>{selectedCharacter.attribute}</Badge>
                        <Badge variant="outline">{selectedCharacter.weaponType}</Badge>
                        <Badge variant="outline">{selectedCharacter.stance}</Badge>
                        <Badge variant="secondary">{selectedCharacter.race}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {getCharacterDescription(selectedCharacter) && (
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{getCharacterDescription(selectedCharacter)}</p>
                    </div>
                  )}

                  {/* Skill */}
                  <div>
                    <h4 className="font-semibold mb-2">Skill: {getSkillName(selectedCharacter)}</h4>
                    <p className="text-sm text-muted-foreground">{getSkillDescription(selectedCharacter)}</p>
                  </div>

                  {/* Leader Ability */}
                  {getLeaderAbilityName(selectedCharacter) && getLeaderAbilityName(selectedCharacter) !== '(None)' && (
                    <div>
                      <h4 className="font-semibold mb-2">Leader Ability</h4>
                      <p className="text-sm">{getLeaderAbilityName(selectedCharacter)}</p>
                    </div>
                  )}

                  {/* Voice Actor */}
                  {getVoiceActor(selectedCharacter) && (
                    <div>
                      <h4 className="font-semibold mb-2">Voice Actor</h4>
                      <p className="text-sm">{getVoiceActor(selectedCharacter)}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
