'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Character } from '@/lib/character-parser';
import AudioPlayer from '@/components/AudioPlayer';

interface CharacterTheme {
  path: string;
  songName: string;
  url: string;
}



// Helper functions
const getCharacterImage = (faceCode: string) => {
  return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceCode}/ui/square_0.png`;
};

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
  };
  const iconName = map[race] || race.toLowerCase();
  return `/FilterIcons/races/race_${iconName}_medium.png`;
};

const getCharacterName = (char: Character) => {
  return char.nameEN || char.nameJP || 'Unknown';
};

const getCharacterTitle = (char: Character) => {
  return char.titleEN || char.titleJP || '';
};

const getCharacterDescription = (char: Character) => {
  return char.descriptionEN || char.descriptionJP || '';
};

const getSkillName = (char: Character) => {
  return char.skillNameEN || char.skillNameJP || '';
};

const getSkillDescription = (char: Character) => {
  return char.skillDescriptionEN || char.skillDescriptionJP || '';
};

const getLeaderAbilityName = (char: Character) => {
  return char.leaderAbilityNameEN || char.leaderAbilityNameJP || '';
};

const getVoiceActor = (char: Character) => {
  return char.voiceActor || '';
};

export default function CharacterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [themes, setThemes] = useState<CharacterTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [themesLoading, setThemesLoading] = useState(false);

  useEffect(() => {
    async function loadCharacter() {
      setLoading(true);
      try {
        const response = await fetch('/api/characters?lang=both');
        const data = await response.json();
        const chars = data.characters || [];
        const foundChar = chars.find((c: Character) => c.faceCode === params.devnickname);
        setCharacter(foundChar || null);
      } catch (error) {
        console.error('Error loading character:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCharacter();
  }, [params.devnickname]);

  useEffect(() => {
    async function loadThemes() {
      if (!params.devnickname) return;
      setThemesLoading(true);
      try {
        const response = await fetch(`/api/character-theme?devnickname=${params.devnickname}`);
        const data = await response.json();
        setThemes(data.themes || []);
      } catch (error) {
        console.error('Error loading character themes:', error);
      } finally {
        setThemesLoading(false);
      }
    }
    loadThemes();
  }, [params.devnickname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Character not found</p>
        <Button onClick={() => router.push('/characters')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Characters
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push('/characters')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Characters
          </Button>
          <h1 className="text-3xl font-bold">{getCharacterName(character)}</h1>
          {getCharacterTitle(character) && (
            <p className="text-lg text-muted-foreground mt-1">{getCharacterTitle(character)}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Character Image and Basic Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="w-full aspect-square relative bg-muted rounded-md overflow-hidden mb-4">
                  <Image
                    src={getCharacterImage(character.faceCode)}
                    alt={getCharacterName(character)}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="flex items-center gap-1">
                      <Image
                        src={getAttributeIcon(character.attribute)}
                        alt={character.attribute}
                        width={16}
                        height={16}
                        unoptimized
                      />
                      {character.attribute}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Image
                        src={getWeaponTypeIcon(character.weaponType)}
                        alt={character.weaponType}
                        width={16}
                        height={16}
                        unoptimized
                      />
                      {character.weaponType}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Image
                        src={getStanceIcon(character.stance)}
                        alt={character.stance}
                        width={16}
                        height={16}
                        unoptimized
                      />
                      {character.stance}
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Image
                        src={getRaceIcon(character.race)}
                        alt={character.race}
                        width={16}
                        height={16}
                        unoptimized
                      />
                      {character.race}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Dev Nickname</p>
                      <p className="text-sm font-mono">{character.faceCode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ID</p>
                      <p className="text-sm font-mono">{character.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rarity</p>
                      <p className="text-sm">{'⭐'.repeat(parseInt(character.rarity) || 1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gender</p>
                      <p className="text-sm">{character.gender}</p>
                    </div>
                  </div>

                  {getVoiceActor(character) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Voice Actor</p>
                      <p className="text-sm">{getVoiceActor(character)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Detailed Information */}
          <div className="lg:col-span-2 space-y-6">
            {getCharacterDescription(character) && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-3">Description</h2>
                  <p className="text-muted-foreground leading-relaxed">{getCharacterDescription(character)}</p>
                </CardContent>
              </Card>
            )}

            {getSkillDescription(character) && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-3">
                    Skill{getSkillName(character) ? `: ${getSkillName(character)}` : ''}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">{getSkillDescription(character)}</p>
                </CardContent>
              </Card>
            )}

            {getLeaderAbilityName(character) && getLeaderAbilityName(character) !== '(None)' && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-3">Leader Ability</h2>
                  <p className="leading-relaxed">{getLeaderAbilityName(character)}</p>
                </CardContent>
              </Card>
            )}

            {/* Placeholder sections for future features */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-3">Character Arts</h2>
                <p className="text-muted-foreground text-sm">Coming soon...</p>
              </CardContent>
            </Card>

            {/* Music Theme */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-3">Music Theme</h2>
                {themesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading themes...</span>
                  </div>
                ) : themes.length > 0 ? (
                  <div className="space-y-4">
                    {themes.map((theme) => (
                      <div key={theme.path} className="space-y-2">
                        <div>
                          <p className="text-sm font-medium">{theme.songName}</p>
                          <a 
                            href={theme.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {theme.url}
                          </a>
                        </div>
                        <AudioPlayer 
                          src={theme.url}
                          onError={() => console.error('Failed to load audio:', theme.url)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No theme music available for this character.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
