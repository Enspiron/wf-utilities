'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  Sparkles,
  Swords,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import AudioPlayer from '@/components/AudioPlayer';

interface CharacterTheme {
  path: string;
  songName: string;
  url: string;
  fallbackUrls?: string[];
}

interface CharacterGauge {
  Target?: string;
  Condition?: string;
  Every?: number;
  EveryCond?: string;
  IsMain?: boolean;
  Amount?: string | number;
}

interface CharacterDetail {
  id: string;
  faceCode: string;
  nameEN: string;
  nameJP: string;
  titleEN: string;
  titleJP: string;
  descriptionEN: string;
  descriptionJP: string;
  skillNameEN: string;
  skillNameJP: string;
  leaderAbilityNameEN: string;
  leaderAbilityNameJP: string;
  voiceActor: string;
  attribute: string;
  role: string;
  weaponType: string;
  race: string;
  gender: string;
  stance: string;
  rarity: number;
  maxHP: number;
  maxATK: number;
  skillWait: number;
  skillIcon: string;
  skillRange: string[];
  skill: string;
  leaderBuff: string;
  abilities: string[];
  hitCount: number;
  feverGain: number;
  gauges: Record<string, CharacterGauge>;
  maxGauges: Record<string, CharacterGauge>;
  manaBoard2: boolean;
  inTaiwan: boolean;
  obtain: string;
  choice: string;
  otherCommonNames: string;
  songs: string[];
}

interface GrowthPoint {
  level: number;
  hp: number;
  atk: number;
}

interface SpeechLine {
  index: number;
  text: string;
  cue: string;
}

interface CharacterDetailResponse {
  character: CharacterDetail;
  growth: GrowthPoint[];
  speechLines: SpeechLine[];
  gachaSounds: string[];
  art: {
    galleryUrls: string[];
    fullShotAttributes: Record<string, unknown>;
  };
}

type DetailTab = 'overview' | 'combat' | 'stats' | 'voice';

const DEFAULT_BATTLE_SAMPLE_CUES = [
  'battle/power_flip_1',
  'battle/skill_1',
  'battle/start_1',
  'battle/win_1',
  'battle/down_1',
];

const PIXEL_ANIMATION_FILES = [
  { key: 'special', label: 'Special', file: 'special.gif' },
  { key: 'skillReady', label: 'Skill Ready', file: 'skill_ready.gif' },
  { key: 'victory', label: 'Kachidoki', file: 'kachidoki.gif' },
  { key: 'walkFront', label: 'Walk Front', file: 'walk_front.gif' },
  { key: 'walkBack', label: 'Walk Back', file: 'walk_back.gif' },
];

const TAB_ITEMS: Array<{ key: DetailTab; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: 'Overview', icon: BookOpen },
  { key: 'combat', label: 'Combat Kit', icon: Swords },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'voice', label: 'Voice & SFX', icon: Volume2 },
];

const toVoiceUrl = (faceCode: string, cue: string) => {
  const normalizedCue = cue.replace(/^\/+/, '').replace(/\.mp3$/i, '');
  return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceCode}/voice/${normalizedCue}.mp3`;
};

const toSfxUrl = (soundPath: string) => {
  const normalizedPath = soundPath.replace(/^\/+/, '').replace(/\.mp3$/i, '');
  return `https://wfjukebox.b-cdn.net/${normalizedPath}.mp3`;
};

const cueLabel = (cue: string) => cue.split('/').pop() || cue;

const getAttributeIcon = (attr: string) => {
  const map: Record<string, string> = {
    Fire: 'red',
    Water: 'blue',
    Thunder: 'yellow',
    Wind: 'green',
    Light: 'white',
    Dark: 'black',
  };
  return `/FilterIcons/elements/element_${map[attr] || attr.toLowerCase()}_medium.png`;
};

const getWeaponTypeIcon = (type: string) => {
  const map: Record<string, string> = {
    Slash: 'fighter',
    Strike: 'knight',
    Thrust: 'special',
    Shot: 'ranged',
    Support: 'supporter',
  };
  return `/FilterIcons/types/type_${map[type] || type.toLowerCase()}_medium.png`;
};

const getStanceIcon = (stance: string) => {
  const map: Record<string, string> = {
    Supporter: 'buffer',
    Jammer: 'debuffer',
  };
  return `/FilterIcons/stances/stance_${map[stance] || stance.toLowerCase()}_medium.png`;
};

const getRaceIcon = (race: string) => {
  const map: Record<string, string> = {
    Mecha: 'machine',
    Sprite: 'element',
    Demon: 'devil',
    Plant: 'plants',
    Youkai: 'mystery',
  };

  const primaryRace = race.includes('/') ? race.split('/')[0].trim() : race;
  const normalizedRace = primaryRace === 'Plants' ? 'Plant' : primaryRace;
  return `/FilterIcons/races/race_${map[normalizedRace] || normalizedRace.toLowerCase()}_medium.png`;
};

const getRarityIcon = (rarity: number) => {
  const rarityMap: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
  };
  return `/FilterIcons/rarity/rarity_${rarityMap[rarity] || 'five'}.png`;
};

const getAttributeAccentClasses = (attribute: string) => {
  const map: Record<string, string> = {
    Fire: 'from-rose-500/20 via-orange-500/10 to-transparent',
    Water: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    Thunder: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    Wind: 'from-emerald-500/20 via-lime-500/10 to-transparent',
    Light: 'from-zinc-200/30 via-slate-200/10 to-transparent',
    Dark: 'from-violet-500/20 via-indigo-500/10 to-transparent',
  };
  return map[attribute] || 'from-primary/15 via-primary/5 to-transparent';
};

const HERO_TAG_BADGE_CLASS =
  'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-border/70 bg-card/80 px-2.5 text-xs font-semibold text-foreground';

const pickByLanguage = (en: string, jp: string, language: 'en' | 'jp') => {
  if (language === 'jp') return jp || en;
  return en || jp;
};

export default function CharacterDetailPage() {
  const params = useParams<{ devnickname: string }>();
  const router = useRouter();
  const devnickname = Array.isArray(params.devnickname) ? params.devnickname[0] : params.devnickname;

  const [detailData, setDetailData] = useState<CharacterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'jp' | 'both'>('en');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string>('');

  const [themes, setThemes] = useState<CharacterTheme[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themeUrls, setThemeUrls] = useState<Record<string, string>>({});
  const [themeUrlIndex, setThemeUrlIndex] = useState<Record<string, number>>({});
  const [battleSampleCues, setBattleSampleCues] = useState<string[]>([]);
  const [battleSamplesLoading, setBattleSamplesLoading] = useState(false);

  const [brokenArtUrls, setBrokenArtUrls] = useState<Record<string, boolean>>({});
  const [selectedArtUrl, setSelectedArtUrl] = useState('');
  const [brokenPixelUrls, setBrokenPixelUrls] = useState<Record<string, boolean>>({});
  const [selectedPixelUrl, setSelectedPixelUrl] = useState('');
  const character = detailData?.character ?? null;

  useEffect(() => {
    if (!devnickname) return;

    let isCancelled = false;

    async function loadCharacterDetail() {
      setLoading(true);
      try {
        const response = await fetch(`/api/character-detail?devnickname=${encodeURIComponent(devnickname)}`);
        if (!response.ok) {
          if (!isCancelled) setDetailData(null);
          return;
        }
        const data = (await response.json()) as CharacterDetailResponse;
        if (isCancelled) return;

        setDetailData(data);
        setBrokenArtUrls({});
        const firstArt = data.art.galleryUrls[0] || '';
        setSelectedArtUrl(firstArt);
      } catch (error) {
        console.error('Error loading character detail:', error);
        if (!isCancelled) setDetailData(null);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadCharacterDetail();

    return () => {
      isCancelled = true;
    };
  }, [devnickname]);

  useEffect(() => {
    if (!character?.faceCode) {
      setBattleSampleCues([]);
      return;
    }
    const faceCode = character.faceCode;

    let isCancelled = false;

    async function loadBattleSamples() {
      setBattleSamplesLoading(true);

      try {
        const checks = await Promise.all(
          DEFAULT_BATTLE_SAMPLE_CUES.map(async (cue) => {
            const url = toVoiceUrl(faceCode, cue);
            try {
              const response = await fetch(`/api/assets/probe?url=${encodeURIComponent(url)}`);
              if (!response.ok) return null;
              const result = (await response.json()) as { ok?: boolean };
              return result.ok ? cue : null;
            } catch {
              return null;
            }
          })
        );

        if (isCancelled) return;
        setBattleSampleCues(checks.filter((cue): cue is string => Boolean(cue)));
      } finally {
        if (!isCancelled) setBattleSamplesLoading(false);
      }
    }

    loadBattleSamples();

    return () => {
      isCancelled = true;
    };
  }, [character?.faceCode]);

  useEffect(() => {
    if (!devnickname) return;

    let isCancelled = false;

    async function loadThemes() {
      setThemesLoading(true);
      try {
        const response = await fetch(`/api/character-theme?devnickname=${encodeURIComponent(devnickname)}`);
        const data = await response.json();
        if (isCancelled) return;

        const themesWithFallback = (data.themes || []).map((theme: CharacterTheme) => {
          const songName = theme.songName || devnickname;
          return {
            ...theme,
            fallbackUrls: [
              `https://wfjukebox.b-cdn.net/music/character_unique/${devnickname}/${songName}.mp3`,
              `https://raw.githubusercontent.com/Enspiron/WorldFlipperPlayer/main/character_unique/${devnickname}/${songName}.mp3`,
            ],
          };
        });

        setThemes(themesWithFallback);

        const urls: Record<string, string> = {};
        const indexes: Record<string, number> = {};
        themesWithFallback.forEach((theme: CharacterTheme) => {
          urls[theme.path] = theme.url;
          indexes[theme.path] = 0;
        });
        setThemeUrls(urls);
        setThemeUrlIndex(indexes);
      } catch (error) {
        console.error('Error loading character themes:', error);
        if (!isCancelled) setThemes([]);
      } finally {
        if (!isCancelled) setThemesLoading(false);
      }
    }

    loadThemes();

    return () => {
      isCancelled = true;
    };
  }, [devnickname]);

  const availableArtUrls = useMemo(() => {
    if (!detailData) return [];
    return detailData.art.galleryUrls.filter((url) => !brokenArtUrls[url]);
  }, [detailData, brokenArtUrls]);

  const pixelAnimations = useMemo(() => {
    if (!character?.faceCode) return [];
    return PIXEL_ANIMATION_FILES.map((entry) => ({
      ...entry,
      url: `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${character.faceCode}/pixelart/animated/${entry.file}`,
    }));
  }, [character?.faceCode]);

  const availablePixelAnimations = useMemo(() => {
    if (!pixelAnimations.length) return [];
    return pixelAnimations.filter((entry) => !brokenPixelUrls[entry.url]);
  }, [pixelAnimations, brokenPixelUrls]);

  useEffect(() => {
    if (!availableArtUrls.length) {
      setSelectedArtUrl('');
      return;
    }
    if (!selectedArtUrl || !availableArtUrls.includes(selectedArtUrl)) {
      setSelectedArtUrl(availableArtUrls[0]);
    }
  }, [availableArtUrls, selectedArtUrl]);

  useEffect(() => {
    setBrokenPixelUrls({});
  }, [character?.faceCode]);

  useEffect(() => {
    setVoiceSearch('');
    setCopiedKey('');
  }, [character?.faceCode]);

  useEffect(() => {
    if (!availablePixelAnimations.length) {
      setSelectedPixelUrl('');
      return;
    }

    const selectedStillAvailable = availablePixelAnimations.some((entry) => entry.url === selectedPixelUrl);
    if (!selectedPixelUrl || !selectedStillAvailable) {
      setSelectedPixelUrl(availablePixelAnimations[0].url);
    }
  }, [availablePixelAnimations, selectedPixelUrl]);

  const growthHighlights = useMemo(() => {
    if (!detailData?.growth?.length) return [];
    const priorityLevels = [1, 10, 80, 100];
    const picks: GrowthPoint[] = [];
    for (const level of priorityLevels) {
      const found = detailData.growth.find((entry) => entry.level === level);
      if (found) picks.push(found);
    }
    return picks;
  }, [detailData]);

  const mainTitle = useMemo(() => {
    if (!character) return '';
    if (language === 'both') return `${character.nameEN || character.nameJP} / ${character.nameJP || character.nameEN}`;
    return pickByLanguage(character.nameEN, character.nameJP, language);
  }, [character, language]);

  const subTitle = useMemo(() => {
    if (!character) return '';
    if (language === 'both') {
      const en = character.titleEN || '';
      const jp = character.titleJP || '';
      if (en && jp && en !== jp) return `${en} / ${jp}`;
      return en || jp;
    }
    return pickByLanguage(character.titleEN, character.titleJP, language);
  }, [character, language]);

  const descriptionEN = character?.descriptionEN || '';
  const descriptionJP = character?.descriptionJP || '';
  const attributeAccentClasses = getAttributeAccentClasses(character?.attribute || '');
  const heroIconUrl = character?.faceCode
    ? `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${character.faceCode}/ui/square_0.png`
    : '';
  const skillName = character
    ? language === 'jp'
      ? character.skillNameJP || character.skillNameEN
      : character.skillNameEN || character.skillNameJP
    : '';
  const leaderAbilityName = character
    ? language === 'jp'
      ? character.leaderAbilityNameJP || character.leaderAbilityNameEN
      : character.leaderAbilityNameEN || character.leaderAbilityNameJP
    : '';

  const activeArtIndex = selectedArtUrl ? availableArtUrls.indexOf(selectedArtUrl) : -1;

  const handleArtError = (url: string) => {
    setBrokenArtUrls((prev) => ({ ...prev, [url]: true }));
  };

  const handlePixelError = (url: string) => {
    setBrokenPixelUrls((prev) => ({ ...prev, [url]: true }));
  };

  const filteredSpeechLines = useMemo(() => {
    const lines = detailData?.speechLines ?? [];
    const query = voiceSearch.trim().toLowerCase();
    if (!query) return lines;
    return lines.filter((line) => {
      const haystack = [line.text, line.cue, String(line.index)].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [detailData?.speechLines, voiceSearch]);

  const copyToClipboard = async (value: string, key: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? '' : prev));
      }, 1400);
    } catch (error) {
      console.error('Clipboard write failed:', error);
    }
  };

  const showPrevArt = () => {
    if (!availableArtUrls.length || activeArtIndex <= 0) return;
    setSelectedArtUrl(availableArtUrls[activeArtIndex - 1]);
  };

  const showNextArt = () => {
    if (!availableArtUrls.length || activeArtIndex < 0 || activeArtIndex >= availableArtUrls.length - 1) return;
    setSelectedArtUrl(availableArtUrls[activeArtIndex + 1]);
  };

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (!character) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4'>
        <p className='text-muted-foreground'>Character not found.</p>
        <Button onClick={() => router.push('/characters')}>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Characters
        </Button>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-background via-background to-muted/20'>
      <div className='container mx-auto max-w-7xl space-y-6 p-4 md:p-6'>
        <Card className='overflow-hidden border-border/70 bg-card/70 backdrop-blur'>
          <CardContent className='p-0'>
            <div className={`bg-gradient-to-br ${attributeAccentClasses}`}>
              <div className='space-y-5 p-4 md:p-6'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <Button variant='ghost' onClick={() => router.push('/characters')}>
                    <ArrowLeft className='mr-2 h-4 w-4' />
                    Back to Characters
                  </Button>
                  <div className='inline-flex rounded-md border bg-card/90 p-1 shadow-sm'>
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
                    <Button
                      size='sm'
                      variant={language === 'both' ? 'default' : 'ghost'}
                      onClick={() => setLanguage('both')}
                    >
                      EN/JP
                    </Button>
                  </div>
                </div>

                <div className='grid items-start gap-4 md:grid-cols-[112px_minmax(0,1fr)] xl:grid-cols-[112px_minmax(0,1fr)_auto]'>
                  <div className='relative mx-auto h-28 w-28 overflow-hidden rounded-xl border bg-background/50 shadow-sm md:mx-0'>
                    <Image src={heroIconUrl} alt={`${mainTitle} icon`} fill className='object-cover' unoptimized />
                  </div>

                  <div className='space-y-2'>
                    <h1 className='text-center text-2xl font-bold md:text-left md:text-3xl'>{mainTitle}</h1>
                    {subTitle && <p className='text-center text-muted-foreground md:text-left'>{subTitle}</p>}
                    <div className='flex flex-wrap items-center justify-center gap-2 md:justify-start'>
                      <Badge className={HERO_TAG_BADGE_CLASS}>
                        <Image src={getAttributeIcon(character.attribute)} alt={character.attribute} width={14} height={14} unoptimized />
                        {character.attribute}
                      </Badge>
                      <Badge className={HERO_TAG_BADGE_CLASS}>
                        <Image
                          src={getWeaponTypeIcon(character.weaponType)}
                          alt={character.weaponType}
                          width={14}
                          height={14}
                          unoptimized
                        />
                        {character.weaponType}
                      </Badge>
                      <Badge className={HERO_TAG_BADGE_CLASS}>
                        <Image src={getStanceIcon(character.stance)} alt={character.stance} width={14} height={14} unoptimized />
                        {character.stance}
                      </Badge>
                      <Badge className={HERO_TAG_BADGE_CLASS}>
                        <Image src={getRaceIcon(character.race)} alt={character.race} width={14} height={14} unoptimized />
                        {character.race}
                      </Badge>
                      {character.manaBoard2 && (
                        <Badge className={HERO_TAG_BADGE_CLASS}>
                          <Sparkles className='h-3.5 w-3.5' />
                          MB2
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className='flex flex-wrap justify-center gap-2 xl:justify-end'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => void copyToClipboard(character.faceCode, 'face-code')}
                    >
                      {copiedKey === 'face-code' ? <Check className='mr-2 h-4 w-4' /> : <Copy className='mr-2 h-4 w-4' />}
                      Face Code
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => void copyToClipboard(character.id, 'character-id')}>
                      {copiedKey === 'character-id' ? <Check className='mr-2 h-4 w-4' /> : <Copy className='mr-2 h-4 w-4' />}
                      Character ID
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        window.open(heroIconUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <ExternalLink className='mr-2 h-4 w-4' />
                      Open Icon
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3 border-t bg-card/80 p-4 sm:grid-cols-3 lg:grid-cols-6'>
              <div className='rounded-md border bg-background/80 p-3'>
                <p className='text-xs text-muted-foreground'>Dev Nickname</p>
                <p className='font-mono text-sm'>{character.faceCode}</p>
              </div>
              <div className='rounded-md border bg-background/80 p-3'>
                <p className='text-xs text-muted-foreground'>Character ID</p>
                <p className='font-mono text-sm'>{character.id || '-'}</p>
              </div>
              <div className='rounded-md border bg-background/80 p-3'>
                <p className='text-xs text-muted-foreground'>Rarity</p>
                <Image
                  src={getRarityIcon(character.rarity)}
                  alt={`${character.rarity} star`}
                  width={80}
                  height={16}
                  unoptimized
                  className='mt-1 object-contain'
                />
              </div>
              <div className='rounded-md border bg-background/80 p-3'>
                <p className='text-xs text-muted-foreground'>Max HP</p>
                <p className='text-sm font-medium'>{character.maxHP ? character.maxHP.toLocaleString() : '-'}</p>
              </div>
              <div className='rounded-md border bg-background/80 p-3'>
                <p className='text-xs text-muted-foreground'>Max ATK</p>
                <p className='text-sm font-medium'>{character.maxATK ? character.maxATK.toLocaleString() : '-'}</p>
              </div>
              <div className='rounded-md border bg-background/80 p-3'>
                <p className='text-xs text-muted-foreground'>Skill Wait</p>
                <p className='text-sm font-medium'>{character.skillWait > 0 ? character.skillWait : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]'>
          <aside className='min-w-0 space-y-6 lg:sticky lg:top-20 lg:self-start'>
            <Card className='border-border/70 bg-card/70 backdrop-blur'>
              <CardContent className='space-y-4 p-4'>
                <h2 className='text-lg font-semibold'>Artwork Gallery</h2>
                <div className='relative overflow-hidden rounded-lg border bg-muted/30'>
                  {selectedArtUrl ? (
                    <div className='relative aspect-[4/3] w-full'>
                      <Image
                        src={selectedArtUrl}
                        alt={character.faceCode}
                        fill
                        className='object-contain'
                        unoptimized
                        onError={() => handleArtError(selectedArtUrl)}
                      />
                    </div>
                  ) : (
                    <div className='flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-muted-foreground'>
                      <ImageOff className='h-8 w-8' />
                      <p className='text-xs'>No available artwork</p>
                    </div>
                  )}

                  {availableArtUrls.length > 1 && (
                    <div className='absolute inset-x-2 bottom-2 flex justify-between'>
                      <Button size='icon' variant='secondary' className='h-8 w-8' onClick={showPrevArt}>
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <Button size='icon' variant='secondary' className='h-8 w-8' onClick={showNextArt}>
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  )}
                </div>

                {availableArtUrls.length > 1 && (
                  <ScrollArea className='w-full whitespace-nowrap rounded-md border'>
                    <div className='flex gap-2 p-2'>
                      {availableArtUrls.map((url) => (
                        <button
                          key={url}
                          type='button'
                          className={`relative h-16 w-24 shrink-0 overflow-hidden rounded border ${
                            selectedArtUrl === url ? 'border-primary' : 'border-border'
                          }`}
                          onClick={() => setSelectedArtUrl(url)}
                        >
                          <Image
                            src={url}
                            alt='Character artwork preview'
                            fill
                            className='object-cover'
                            unoptimized
                            onError={() => handleArtError(url)}
                          />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className='border-border/70 bg-card/70 backdrop-blur'>
              <CardContent className='space-y-4 p-4'>
                <h2 className='text-lg font-semibold'>Pixel Art Animations</h2>
                {availablePixelAnimations.length > 0 ? (
                  <>
                    <div className='relative overflow-hidden rounded-lg border bg-muted/20'>
                      {selectedPixelUrl ? (
                        <div className='relative aspect-square w-full'>
                          <Image
                            src={selectedPixelUrl}
                            alt='Character pixel animation'
                            fill
                            className='object-contain p-4'
                            style={{ imageRendering: 'pixelated' }}
                            unoptimized
                            onError={() => handlePixelError(selectedPixelUrl)}
                          />
                        </div>
                      ) : (
                        <div className='flex aspect-square w-full items-center justify-center text-sm text-muted-foreground'>
                          No animation preview
                        </div>
                      )}
                    </div>

                    <div className='grid grid-cols-2 gap-2'>
                      {availablePixelAnimations.map((entry) => (
                        <Button
                          key={entry.url}
                          variant={selectedPixelUrl === entry.url ? 'default' : 'outline'}
                          size='sm'
                          className='justify-start'
                          onClick={() => setSelectedPixelUrl(entry.url)}
                        >
                          {entry.label}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className='text-sm text-muted-foreground'>No animated pixel art found for this character.</p>
                )}
              </CardContent>
            </Card>

            <Card className='border-border/70 bg-card/70 backdrop-blur'>
              <CardContent className='space-y-4 p-4'>
                <h2 className='text-lg font-semibold'>Profile Data</h2>

                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div>
                    <p className='text-xs text-muted-foreground'>Role</p>
                    <p>{character.role || '-'}</p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Hit Count</p>
                    <p>{character.hitCount || '-'}</p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Fever Gain</p>
                    <p>{character.feverGain || '-'}</p>
                  </div>
                  <div>
                    <p className='text-xs text-muted-foreground'>Voice Actor</p>
                    <p className='truncate'>{character.voiceActor || '-'}</p>
                  </div>
                </div>

                {character.obtain && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Obtain</p>
                    <p className='text-sm'>{character.obtain}</p>
                  </div>
                )}

                {character.otherCommonNames && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Aliases</p>
                    <p className='text-sm'>{character.otherCommonNames}</p>
                  </div>
                )}

                <div className='flex flex-wrap gap-2'>
                  {character.manaBoard2 && <Badge variant='outline'>Mana Board 2</Badge>}
                  {character.inTaiwan && <Badge variant='outline'>TW Available</Badge>}
                  {character.choice && <Badge variant='outline'>{character.choice}</Badge>}
                </div>
              </CardContent>
            </Card>

            <Card className='border-border/70 bg-card/70 backdrop-blur'>
              <CardContent className='space-y-3 p-4'>
                <h2 className='text-lg font-semibold'>Growth Highlights</h2>
                {growthHighlights.length ? (
                  <div className='grid grid-cols-2 gap-2 text-sm'>
                    {growthHighlights.map((entry) => (
                      <div key={entry.level} className='rounded-md border p-2'>
                        <p className='text-xs text-muted-foreground'>Lv {entry.level}</p>
                        <p>HP {entry.hp.toLocaleString()}</p>
                        <p>ATK {entry.atk.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground'>No growth entries found.</p>
                )}
              </CardContent>
            </Card>
          </aside>

          <section className='min-w-0 space-y-6'>
            <Card className='border-border/70 bg-card/70 backdrop-blur'>
              <CardContent className='space-y-4 p-4'>
                <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
                  {TAB_ITEMS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Button
                        key={tab.key}
                        size='sm'
                        variant={activeTab === tab.key ? 'default' : 'outline'}
                        onClick={() => setActiveTab(tab.key)}
                        className='justify-start gap-2'
                      >
                        <Icon className='h-4 w-4' />
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>

                {activeTab === 'overview' && (
                  <div className='space-y-4'>
                    {(descriptionEN || descriptionJP) ? (
                      <div className='space-y-4 rounded-md border bg-background/60 p-4'>
                        <h2 className='text-lg font-semibold'>Description</h2>
                        {language === 'both' ? (
                          <>
                            {descriptionEN && (
                              <div>
                                <p className='text-xs font-medium text-muted-foreground'>EN</p>
                                <p className='leading-relaxed'>{descriptionEN}</p>
                              </div>
                            )}
                            {descriptionJP && (
                              <div>
                                <p className='text-xs font-medium text-muted-foreground'>JP</p>
                                <p className='leading-relaxed'>{descriptionJP}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className='leading-relaxed'>{pickByLanguage(descriptionEN, descriptionJP, language)}</p>
                        )}
                      </div>
                    ) : (
                      <p className='rounded-md border bg-background/60 p-4 text-sm text-muted-foreground'>No description available.</p>
                    )}
                  </div>
                )}

                {activeTab === 'combat' && (
                  <div className='space-y-4'>
                    <div className='space-y-4 rounded-md border bg-background/60 p-4'>
                      <h2 className='text-lg font-semibold'>Combat Kit</h2>

                      <div className='space-y-2 rounded-md border bg-card p-3'>
                        <p className='text-sm font-medium'>
                          Skill{skillName ? `: ${skillName}` : ''}
                          {character.skillWait > 0 ? ` (Wait: ${character.skillWait})` : ''}
                        </p>
                        <p className='text-sm text-muted-foreground'>{character.skill || '-'}</p>
                      </div>

                      <div className='space-y-2 rounded-md border bg-card p-3'>
                        <p className='text-sm font-medium'>
                          Leader Ability{leaderAbilityName ? `: ${leaderAbilityName}` : ''}
                        </p>
                        <p className='text-sm text-muted-foreground'>{character.leaderBuff || '-'}</p>
                      </div>

                      <div className='space-y-2'>
                        <p className='text-sm font-medium'>Abilities</p>
                        {character.abilities.length ? (
                          <div className='space-y-2'>
                            {character.abilities.map((ability, index) => (
                              <div
                                key={`${ability}-${index}`}
                                className='rounded-md border bg-card p-3 text-sm text-muted-foreground'
                              >
                                <span className='font-medium text-foreground'>Ability {index + 1}:</span> {ability}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className='text-sm text-muted-foreground'>No ability data available.</p>
                        )}
                      </div>
                    </div>

                    {(Object.keys(character.gauges).length > 0 || Object.keys(character.maxGauges).length > 0) && (
                      <div className='space-y-4 rounded-md border bg-background/60 p-4'>
                        <h2 className='text-lg font-semibold'>Gauge Data</h2>

                        {Object.keys(character.gauges).length > 0 && (
                          <div className='space-y-2'>
                            <p className='text-sm font-medium'>Gauges</p>
                            <div className='grid gap-2 md:grid-cols-2'>
                              {Object.entries(character.gauges).map(([key, gauge]) => (
                                <div key={key} className='rounded-md border bg-card p-3 text-sm'>
                                  <p className='font-medium'>{key}</p>
                                  <p className='text-muted-foreground'>Target: {gauge.Target || '-'}</p>
                                  <p className='text-muted-foreground'>Amount: {gauge.Amount ?? '-'}</p>
                                  {gauge.Condition && (
                                    <p className='text-muted-foreground'>Condition: {gauge.Condition}</p>
                                  )}
                                  {typeof gauge.Every === 'number' && gauge.Every > 0 && (
                                    <p className='text-muted-foreground'>Every: {gauge.Every}</p>
                                  )}
                                  {gauge.EveryCond && <p className='text-muted-foreground'>Every Cond: {gauge.EveryCond}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Object.keys(character.maxGauges).length > 0 && (
                          <div className='space-y-2'>
                            <p className='text-sm font-medium'>Max Gauges</p>
                            <div className='grid gap-2 md:grid-cols-2'>
                              {Object.entries(character.maxGauges).map(([key, gauge]) => (
                                <div key={key} className='rounded-md border bg-card p-3 text-sm'>
                                  <p className='font-medium'>{key}</p>
                                  <p className='text-muted-foreground'>Target: {gauge.Target || '-'}</p>
                                  <p className='text-muted-foreground'>Amount: {gauge.Amount ?? '-'}</p>
                                  {gauge.Condition && (
                                    <p className='text-muted-foreground'>Condition: {gauge.Condition}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'stats' && (
                  <div className='space-y-4 rounded-md border bg-background/60 p-4'>
                    <h2 className='text-lg font-semibold'>Stat Curve</h2>
                    {detailData?.growth?.length ? (
                      <ScrollArea className='h-[540px] rounded-md border bg-card/60'>
                        <div className='sticky top-0 grid grid-cols-3 gap-2 border-b bg-background/90 p-3 text-sm font-medium text-muted-foreground backdrop-blur'>
                          <span>Level</span>
                          <span>HP</span>
                          <span>ATK</span>
                        </div>
                        <div className='space-y-1 p-3 pt-0'>
                          {detailData.growth.map((row) => (
                            <div key={row.level} className='grid grid-cols-3 gap-2 rounded border bg-card px-2 py-1 text-sm'>
                              <span>Lv {row.level}</span>
                              <span>{row.hp.toLocaleString()}</span>
                              <span>{row.atk.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className='text-sm text-muted-foreground'>No growth data available.</p>
                    )}
                  </div>
                )}

                {activeTab === 'voice' && (
                  <div className='space-y-4'>
                    <div className='space-y-3 rounded-md border bg-background/60 p-4'>
                      <h2 className='text-lg font-semibold'>Music Theme</h2>
                      {themesLoading ? (
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <Loader2 className='h-4 w-4 animate-spin' />
                          <span>Loading themes...</span>
                        </div>
                      ) : themes.length > 0 ? (
                        <div className='space-y-4'>
                          {themes.map((theme) => {
                            const currentUrl = themeUrls[theme.path] || theme.url;
                            const currentIndex = themeUrlIndex[theme.path] || 0;

                            const handleAudioError = () => {
                              if (!theme.fallbackUrls) return;
                              if (currentIndex >= theme.fallbackUrls.length) return;

                              const nextUrl = theme.fallbackUrls[currentIndex];
                              setThemeUrls((prev) => ({
                                ...prev,
                                [theme.path]: nextUrl,
                              }));
                              setThemeUrlIndex((prev) => ({
                                ...prev,
                                [theme.path]: currentIndex + 1,
                              }));
                            };

                            return (
                              <div key={theme.path} className='space-y-2 rounded-md border bg-card p-3'>
                                <div>
                                  <p className='text-sm font-medium'>{theme.songName}</p>
                                  <a
                                    href={currentUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='block max-w-full break-all text-xs text-muted-foreground hover:underline'
                                  >
                                    {currentUrl}
                                  </a>
                                </div>
                                <AudioPlayer key={currentUrl} src={currentUrl} onError={handleAudioError} />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className='text-sm text-muted-foreground'>No theme music available for this character.</p>
                      )}

                      {character.songs.length > 0 && (
                        <div className='space-y-2'>
                          <p className='text-sm font-medium'>Song IDs</p>
                          <div className='flex flex-wrap gap-2'>
                            {character.songs.map((song) => (
                              <Badge key={song} variant='secondary'>
                                {song}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className='space-y-3 rounded-md border bg-background/60 p-4'>
                      <h2 className='text-lg font-semibold'>Voice Lines</h2>
                      <Input
                        value={voiceSearch}
                        onChange={(event) => setVoiceSearch(event.target.value)}
                        placeholder='Filter by line text, cue, or line number...'
                      />
                      <p className='text-xs text-muted-foreground'>
                        Showing {filteredSpeechLines.length}
                        {voiceSearch ? ` of ${detailData?.speechLines?.length ?? 0}` : ''} voice lines
                      </p>
                      {filteredSpeechLines.length ? (
                        <ScrollArea className='h-80 rounded-md border bg-card/60'>
                          <div className='space-y-2 p-3'>
                            {filteredSpeechLines.map((line) => (
                              <div key={`${line.index}-${line.cue}`} className='rounded-md border bg-card p-3 text-sm'>
                                <div className='flex items-center justify-between gap-2'>
                                  <p className='text-xs font-medium text-muted-foreground'>Line {line.index}</p>
                                  {line.cue && (
                                    <Button
                                      size='sm'
                                      variant='ghost'
                                      onClick={() => void copyToClipboard(line.cue, `cue-${line.cue}`)}
                                    >
                                      {copiedKey === `cue-${line.cue}` ? (
                                        <Check className='mr-1 h-3 w-3' />
                                      ) : (
                                        <Copy className='mr-1 h-3 w-3' />
                                      )}
                                      Cue
                                    </Button>
                                  )}
                                </div>
                                {line.text && <p className='whitespace-pre-wrap'>{line.text}</p>}
                                {line.cue && (
                                  <div className='mt-2 space-y-2'>
                                    <p className='font-mono text-xs text-muted-foreground'>{line.cue}</p>
                                    <AudioPlayer src={toVoiceUrl(character.faceCode, line.cue)} compact />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className='text-sm text-muted-foreground'>No voice lines found.</p>
                      )}
                    </div>

                    <div className='space-y-3 rounded-md border bg-background/60 p-4'>
                      <h2 className='text-lg font-semibold'>Battle Voice Samples</h2>
                      {battleSamplesLoading ? (
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <Loader2 className='h-4 w-4 animate-spin' />
                          <span>Scanning available battle clips...</span>
                        </div>
                      ) : battleSampleCues.length ? (
                        <div className='space-y-2'>
                          {battleSampleCues.map((cue) => (
                            <div key={cue} className='rounded-md border bg-card p-3'>
                              <div className='flex flex-wrap items-center justify-between gap-3'>
                                <div className='min-w-0'>
                                  <p className='text-sm font-medium'>{cueLabel(cue)}</p>
                                  <p className='font-mono text-xs text-muted-foreground'>{cue}</p>
                                </div>
                                <AudioPlayer src={toVoiceUrl(character.faceCode, cue)} compact />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className='text-sm text-muted-foreground'>No battle voice samples found for this character.</p>
                      )}
                    </div>

                    <div className='space-y-3 rounded-md border bg-background/60 p-4'>
                      <h2 className='text-lg font-semibold'>SFX References</h2>
                      {detailData?.gachaSounds?.length ? (
                        <ScrollArea className='h-72 rounded-md border bg-card/60'>
                          <div className='space-y-2 p-3'>
                            {detailData.gachaSounds.map((soundPath) => (
                              <div key={soundPath} className='rounded-md border bg-card p-3'>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                  <p className='min-w-0 break-all font-mono text-xs text-muted-foreground'>{soundPath}</p>
                                  <div className='flex items-center gap-2'>
                                    <Button
                                      size='sm'
                                      variant='ghost'
                                      onClick={() => void copyToClipboard(soundPath, `sfx-${soundPath}`)}
                                    >
                                      {copiedKey === `sfx-${soundPath}` ? (
                                        <Check className='mr-1 h-3 w-3' />
                                      ) : (
                                        <Copy className='mr-1 h-3 w-3' />
                                      )}
                                      Copy
                                    </Button>
                                    <AudioPlayer src={toSfxUrl(soundPath)} compact />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className='text-sm text-muted-foreground'>No SFX references found.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
