'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  Music,
  Sparkles,
  Swords,
  UserRound,
  Volume2,
} from 'lucide-react';
import AudioPlayer from '@/components/AudioPlayer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

const SECTION_LINKS = [
  { id: 'kit', label: 'Kit', icon: Swords },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'media', label: 'Media', icon: Sparkles },
  { id: 'voice', label: 'Voice', icon: Volume2 },
];

const ATTRIBUTE_STYLES: Record<string, { ring: string; text: string; accent: string }> = {
  Fire: { ring: 'border-red-500/50', text: 'text-red-300', accent: 'bg-red-500' },
  Water: { ring: 'border-cyan-500/50', text: 'text-cyan-300', accent: 'bg-cyan-500' },
  Thunder: { ring: 'border-yellow-400/60', text: 'text-yellow-200', accent: 'bg-yellow-400' },
  Wind: { ring: 'border-emerald-500/50', text: 'text-emerald-300', accent: 'bg-emerald-500' },
  Light: { ring: 'border-zinc-200/60', text: 'text-zinc-100', accent: 'bg-zinc-200' },
  Dark: { ring: 'border-fuchsia-500/50', text: 'text-fuchsia-300', accent: 'bg-fuchsia-500' },
};

const FACT_LABEL_CLASS = 'text-xs font-medium uppercase tracking-normal text-muted-foreground';
const PANEL_CLASS = 'rounded-md border border-border/70 bg-card/70';
const INNER_PANEL_CLASS = 'rounded-md border border-border/70 bg-background/55';

function pickByLanguage(en: string, jp: string, language: 'en' | 'jp' | 'both') {
  if (language === 'jp') return jp || en;
  return en || jp;
}

function toVoiceUrl(faceCode: string, cue: string) {
  const normalizedCue = cue.replace(/^\/+/, '').replace(/\.mp3$/i, '');
  return `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceCode}/voice/${normalizedCue}.mp3`;
}

function toSfxUrl(soundPath: string) {
  const normalizedPath = soundPath.replace(/^\/+/, '').replace(/\.mp3$/i, '');
  return `https://wfjukebox.b-cdn.net/${normalizedPath}.mp3`;
}

function getAttributeIcon(attr: string) {
  const map: Record<string, string> = {
    Fire: 'red',
    Water: 'blue',
    Thunder: 'yellow',
    Wind: 'green',
    Light: 'white',
    Dark: 'black',
  };
  return `/FilterIcons/elements/round_ability_${map[attr] || attr.toLowerCase()}.png`;
}

function getWeaponTypeIcon(type: string) {
  const map: Record<string, string> = {
    Slash: 'fighter',
    Strike: 'knight',
    Thrust: 'special',
    Shot: 'ranged',
    Support: 'supporter',
  };
  return `/FilterIcons/types/type_${map[type] || type.toLowerCase()}_medium.png`;
}

function getStanceIcon(stance: string) {
  const map: Record<string, string> = {
    Supporter: 'buffer',
    Jammer: 'debuffer',
  };
  return `/FilterIcons/stances/stance_${map[stance] || stance.toLowerCase()}_medium.png`;
}

function getRaceIcon(race: string) {
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
}

function getRarityIcon(rarity: number) {
  const rarityMap: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
  };
  return `/FilterIcons/rarity/rarity_${rarityMap[rarity] || 'five'}.png`;
}

function cueLabel(cue: string) {
  return cue.split('/').pop()?.replace(/_/g, ' ') || cue;
}

function fieldValue(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return typeof value === 'number' ? value.toLocaleString() : value;
}

function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className={FACT_LABEL_CLASS}>{eyebrow}</p>}
        <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function IconBadge({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  return (
    <Badge className="h-8 gap-2 rounded-md border border-border/70 bg-background/80 px-2.5 text-sm text-foreground shadow-none">
      <Image src={src} alt="" width={18} height={18} unoptimized />
      {label || '-'}
    </Badge>
  );
}

function StatBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className={cn(INNER_PANEL_CLASS, 'min-h-[78px] p-3')}>
      <p className={FACT_LABEL_CLASS}>{label}</p>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function TextBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(INNER_PANEL_CLASS, 'p-4')}>
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}

function GaugeGrid({
  title,
  gauges,
}: {
  title: string;
  gauges: Record<string, CharacterGauge>;
}) {
  const entries = Object.entries(gauges || {});
  if (!entries.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(([key, gauge]) => (
          <div key={key} className={cn(INNER_PANEL_CLASS, 'p-3 text-sm')}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{key}</p>
              {gauge.IsMain && <Badge variant="outline" className="rounded-md">Main</Badge>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
              <span>Target</span>
              <span className="text-right text-foreground">{gauge.Target || '-'}</span>
              <span>Amount</span>
              <span className="text-right text-foreground">{gauge.Amount ?? '-'}</span>
              {gauge.Every !== undefined && (
                <>
                  <span>Every</span>
                  <span className="text-right text-foreground">{gauge.Every}</span>
                </>
              )}
            </div>
            {gauge.Condition && <p className="mt-2 text-xs text-muted-foreground">{gauge.Condition}</p>}
            {gauge.EveryCond && <p className="mt-1 text-xs text-muted-foreground">{gauge.EveryCond}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CharacterV2DetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ? decodeURIComponent(rawId) : '';

  const [detailData, setDetailData] = useState<CharacterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'jp' | 'both'>('en');
  const [copiedKey, setCopiedKey] = useState('');
  const [brokenArtUrls, setBrokenArtUrls] = useState<Record<string, boolean>>({});
  const [selectedArtUrl, setSelectedArtUrl] = useState('');
  const [brokenPixelUrls, setBrokenPixelUrls] = useState<Record<string, boolean>>({});
  const [selectedPixelUrl, setSelectedPixelUrl] = useState('');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [themes, setThemes] = useState<CharacterTheme[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themeUrls, setThemeUrls] = useState<Record<string, string>>({});
  const [themeUrlIndex, setThemeUrlIndex] = useState<Record<string, number>>({});
  const [battleSampleCues, setBattleSampleCues] = useState<string[]>([]);
  const [battleSamplesLoading, setBattleSamplesLoading] = useState(false);

  const character = detailData?.character ?? null;

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    async function loadCharacterDetail() {
      setLoading(true);
      try {
        const response = await fetch(`/api/character-detail?devnickname=${encodeURIComponent(id)}`);
        if (!response.ok) {
          if (!isCancelled) setDetailData(null);
          return;
        }

        const data = (await response.json()) as CharacterDetailResponse;
        if (isCancelled) return;

        setDetailData(data);
        setBrokenArtUrls({});
        setSelectedArtUrl(data.art.galleryUrls[0] || '');
      } catch (error) {
        console.error('Error loading character detail:', error);
        if (!isCancelled) setDetailData(null);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadCharacterDetail();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    async function loadThemes() {
      setThemesLoading(true);
      try {
        const response = await fetch(`/api/character-theme?devnickname=${encodeURIComponent(id)}`);
        const data = await response.json();
        if (isCancelled) return;

        const themesWithFallback = ((data.themes || []) as CharacterTheme[]).map((theme) => {
          const songName = theme.songName || id;
          return {
            ...theme,
            fallbackUrls: [
              `https://wfjukebox.b-cdn.net/music/character_unique/${id}/${songName}.mp3`,
              `https://raw.githubusercontent.com/Enspiron/WorldFlipperPlayer/main/character_unique/${id}/${songName}.mp3`,
            ],
          };
        });

        const urls: Record<string, string> = {};
        const indexes: Record<string, number> = {};
        themesWithFallback.forEach((theme) => {
          urls[theme.path] = theme.url;
          indexes[theme.path] = 0;
        });

        setThemes(themesWithFallback);
        setThemeUrls(urls);
        setThemeUrlIndex(indexes);
      } catch (error) {
        console.error('Error loading character themes:', error);
        if (!isCancelled) setThemes([]);
      } finally {
        if (!isCancelled) setThemesLoading(false);
      }
    }

    void loadThemes();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!character?.faceCode) {
      setBattleSampleCues([]);
      return;
    }

    let isCancelled = false;
    const faceCode = character.faceCode;

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

        if (!isCancelled) setBattleSampleCues(checks.filter((cue): cue is string => Boolean(cue)));
      } finally {
        if (!isCancelled) setBattleSamplesLoading(false);
      }
    }

    void loadBattleSamples();

    return () => {
      isCancelled = true;
    };
  }, [character?.faceCode]);

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
    return pixelAnimations.filter((entry) => !brokenPixelUrls[entry.url]);
  }, [pixelAnimations, brokenPixelUrls]);

  const growthHighlights = useMemo(() => {
    if (!detailData?.growth?.length) return [];
    const priorityLevels = [1, 10, 80, 100];
    return priorityLevels
      .map((level) => detailData.growth.find((entry) => entry.level === level))
      .filter((entry): entry is GrowthPoint => Boolean(entry));
  }, [detailData?.growth]);

  const filteredSpeechLines = useMemo(() => {
    const lines = detailData?.speechLines ?? [];
    const query = voiceSearch.trim().toLowerCase();
    if (!query) return lines;
    return lines.filter((line) => {
      const haystack = [line.text, line.cue, String(line.index)].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [detailData?.speechLines, voiceSearch]);

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
    setVoiceSearch('');
    setCopiedKey('');
  }, [character?.faceCode]);

  useEffect(() => {
    if (!availablePixelAnimations.length) {
      setSelectedPixelUrl('');
      return;
    }
    if (!selectedPixelUrl || !availablePixelAnimations.some((entry) => entry.url === selectedPixelUrl)) {
      setSelectedPixelUrl(availablePixelAnimations[0].url);
    }
  }, [availablePixelAnimations, selectedPixelUrl]);

  const copyToClipboard = async (value: string, key: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? '' : current));
      }, 1400);
    } catch (error) {
      console.error('Clipboard write failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Character not found.</p>
        <Button onClick={() => router.push('/characters')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Characters
        </Button>
      </div>
    );
  }

  const style = ATTRIBUTE_STYLES[character.attribute] || {
    ring: 'border-primary/50',
    text: 'text-primary',
    accent: 'bg-primary',
  };
  const mainTitle = language === 'both'
    ? `${character.nameEN || character.nameJP} / ${character.nameJP || character.nameEN}`
    : pickByLanguage(character.nameEN, character.nameJP, language);
  const subTitle = language === 'both'
    ? [character.titleEN, character.titleJP].filter(Boolean).join(' / ')
    : pickByLanguage(character.titleEN, character.titleJP, language);
  const description = language === 'both'
    ? ''
    : pickByLanguage(character.descriptionEN, character.descriptionJP, language);
  const skillName = language === 'jp'
    ? character.skillNameJP || character.skillNameEN
    : character.skillNameEN || character.skillNameJP;
  const leaderAbilityName = language === 'jp'
    ? character.leaderAbilityNameJP || character.leaderAbilityNameEN
    : character.leaderAbilityNameEN || character.leaderAbilityNameJP;
  const heroIconUrl = `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${character.faceCode}/ui/square_0.png`;
  const primaryArtUrl = selectedArtUrl || availableArtUrls[0] || heroIconUrl;
  const gaugeCount = Object.keys(character.gauges || {}).length + Object.keys(character.maxGauges || {}).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/65">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Button variant="ghost" onClick={() => router.push('/characters')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Characters
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border bg-background p-1">
              {(['en', 'jp', 'both'] as const).map((entry) => (
                <Button
                  key={entry}
                  size="sm"
                  variant={language === entry ? 'default' : 'ghost'}
                  onClick={() => setLanguage(entry)}
                >
                  {entry === 'both' ? 'EN/JP' : entry.toUpperCase()}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => void copyToClipboard(character.faceCode, 'face')}>
              {copiedKey === 'face' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              Face
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copyToClipboard(character.id, 'id')}>
              {copiedKey === 'id' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              ID
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-6">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
          <div className={cn(PANEL_CLASS, 'relative min-h-[520px] overflow-hidden bg-neutral-950')}>
            <div className={cn('absolute inset-x-0 top-0 h-1', style.accent)} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%)]" />
            {primaryArtUrl ? (
              <Image
                src={primaryArtUrl}
                alt={mainTitle}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain object-bottom p-3 md:p-5"
                priority
                unoptimized
                onError={() => setBrokenArtUrls((current) => ({ ...current, [primaryArtUrl]: true }))}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-10 w-10" />
                <span>No artwork</span>
              </div>
            )}
            {availableArtUrls.length > 1 && (
              <div className="absolute inset-x-3 bottom-3 flex gap-2 overflow-x-auto rounded-md border border-white/15 bg-black/55 p-2 backdrop-blur">
                {availableArtUrls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className={cn(
                      'relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-black/30',
                      selectedArtUrl === url ? 'border-white' : 'border-white/20'
                    )}
                    onClick={() => setSelectedArtUrl(url)}
                    aria-label={`Artwork ${index + 1}`}
                  >
                    <Image
                      src={url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                      onError={() => setBrokenArtUrls((current) => ({ ...current, [url]: true }))}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card className={cn('rounded-md border-border/70 bg-card/70 shadow-none', style.ring)}>
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-background">
                    <Image src={heroIconUrl} alt="" fill sizes="96px" className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn('rounded-md', style.text)}>
                        {character.attribute}
                      </Badge>
                      {character.manaBoard2 && (
                        <Badge variant="outline" className="rounded-md">
                          Mana Board 2
                        </Badge>
                      )}
                      {character.inTaiwan && (
                        <Badge variant="outline" className="rounded-md">
                          TW
                        </Badge>
                      )}
                    </div>
                    <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{mainTitle}</h1>
                    {subTitle && <p className="mt-2 text-base text-muted-foreground">{subTitle}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <IconBadge src={getAttributeIcon(character.attribute)} label={character.attribute} />
                  <IconBadge src={getWeaponTypeIcon(character.weaponType)} label={character.weaponType} />
                  <IconBadge src={getStanceIcon(character.stance)} label={character.stance} />
                  <IconBadge src={getRaceIcon(character.race)} label={character.race} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBlock label="Max HP" value={fieldValue(character.maxHP)} />
                  <StatBlock label="Max ATK" value={fieldValue(character.maxATK)} />
                  <StatBlock label="Skill Wait" value={character.skillWait > 0 ? character.skillWait : '-'} />
                </div>

                <div className={cn(INNER_PANEL_CLASS, 'p-4')}>
                  <div className="flex items-start gap-3">
                    {character.skillIcon && (
                      <div className="relative mt-1 h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-background">
                        <Image src={character.skillIcon} alt="" fill sizes="48px" className="object-contain p-1" unoptimized />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={FACT_LABEL_CLASS}>Skill</p>
                      <h2 className="mt-1 text-lg font-semibold">{skillName || 'Skill'}</h2>
                      <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{character.skill || '-'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="sticky top-0 z-20 -mx-4 border-y bg-background/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:rounded-md md:border md:bg-card/65">
              <div className="grid grid-cols-4 gap-2">
                {SECTION_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a key={link.id} href={`#${link.id}`}>
                      <Button variant="outline" size="sm" className="w-full justify-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{link.label}</span>
                      </Button>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StatBlock label="Dev Nickname" value={<span className="font-mono text-base">{character.faceCode}</span>} />
              <StatBlock label="Character ID" value={<span className="font-mono text-base">{character.id || '-'}</span>} />
              <StatBlock label="Voice Actor" value={character.voiceActor || '-'} />
              <StatBlock
                label="Rarity"
                value={<Image src={getRarityIcon(character.rarity)} alt={`${character.rarity} star`} width={92} height={18} unoptimized />}
              />
            </div>
          </div>
        </section>

        <section id="kit" className="scroll-mt-24 space-y-4">
          <SectionTitle eyebrow="Overview" title="Kit And Identity">
            <Badge variant="outline" className="rounded-md">
              {character.role || 'Role unknown'}
            </Badge>
          </SectionTitle>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-4">
              {(character.descriptionEN || character.descriptionJP) && (
                <TextBlock title="Profile">
                  {language === 'both' ? (
                    <div className="space-y-4">
                      {character.descriptionEN && (
                        <div>
                          <p className={FACT_LABEL_CLASS}>EN</p>
                          <p>{character.descriptionEN}</p>
                        </div>
                      )}
                      {character.descriptionJP && (
                        <div>
                          <p className={FACT_LABEL_CLASS}>JP</p>
                          <p>{character.descriptionJP}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>{description || '-'}</p>
                  )}
                </TextBlock>
              )}

              <div className={cn(PANEL_CLASS, 'grid gap-3 p-4 sm:grid-cols-2')}>
                <StatBlock label="Role" value={character.role || '-'} />
                <StatBlock label="Gender" value={character.gender || '-'} />
                <StatBlock label="Hit Count" value={character.hitCount || '-'} />
                <StatBlock label="Fever Gain" value={character.feverGain || '-'} />
                {character.obtain && <StatBlock label="Obtain" value={character.obtain} />}
                {character.choice && <StatBlock label="Choice" value={character.choice} />}
              </div>

              {character.otherCommonNames && (
                <TextBlock title="Aliases">
                  <p>{character.otherCommonNames}</p>
                </TextBlock>
              )}
            </div>

            <div className={cn(PANEL_CLASS, 'space-y-4 p-4')}>
              <TextBlock title={skillName ? `Skill: ${skillName}` : 'Skill'}>
                <p>{character.skill || '-'}</p>
                {character.skillRange.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {character.skillRange.map((range) => (
                      <Badge key={range} variant="outline" className="rounded-md">
                        {range}
                      </Badge>
                    ))}
                  </div>
                )}
              </TextBlock>

              <TextBlock title={leaderAbilityName ? `Leader: ${leaderAbilityName}` : 'Leader Ability'}>
                <p>{character.leaderBuff || '-'}</p>
              </TextBlock>

              <div className="space-y-3">
                <h3 className="text-base font-semibold">Abilities</h3>
                {character.abilities.length ? (
                  <div className="grid gap-3">
                    {character.abilities.map((ability, index) => (
                      <div key={`${ability}-${index}`} className={cn(INNER_PANEL_CLASS, 'p-3')}>
                        <div className="mb-2 flex items-center gap-2">
                          <Badge className="rounded-md">A{index + 1}</Badge>
                          <p className="text-sm font-semibold">Ability {index + 1}</p>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{ability}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No ability data available.</p>
                )}
              </div>

              {gaugeCount > 0 && (
                <div className="space-y-5 pt-1">
                  <GaugeGrid title="Gauges" gauges={character.gauges} />
                  <GaugeGrid title="Max Gauges" gauges={character.maxGauges} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="stats" className="scroll-mt-24 space-y-4">
          <SectionTitle eyebrow="Numbers" title="Stats And Growth" />

          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className={cn(PANEL_CLASS, 'space-y-3 p-4')}>
              <h3 className="text-base font-semibold">Growth Highlights</h3>
              {growthHighlights.length ? (
                <div className="grid gap-3">
                  {growthHighlights.map((entry) => (
                    <div key={entry.level} className={cn(INNER_PANEL_CLASS, 'grid grid-cols-3 gap-3 p-3 text-sm')}>
                      <div>
                        <p className={FACT_LABEL_CLASS}>Level</p>
                        <p className="font-semibold">{entry.level}</p>
                      </div>
                      <div>
                        <p className={FACT_LABEL_CLASS}>HP</p>
                        <p className="font-semibold">{entry.hp.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className={FACT_LABEL_CLASS}>ATK</p>
                        <p className="font-semibold">{entry.atk.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No growth entries found.</p>
              )}
            </div>

            <div className={cn(PANEL_CLASS, 'p-4')}>
              <h3 className="text-base font-semibold">Stat Curve</h3>
              {detailData?.growth?.length ? (
                <ScrollArea className="mt-3 h-[420px] rounded-md border">
                  <div className="sticky top-0 grid grid-cols-3 gap-2 border-b bg-background/95 p-3 text-sm font-medium text-muted-foreground backdrop-blur">
                    <span>Level</span>
                    <span>HP</span>
                    <span>ATK</span>
                  </div>
                  <div className="space-y-1 p-3">
                    {detailData.growth.map((row) => (
                      <div key={row.level} className="grid grid-cols-3 gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                        <span>Lv {row.level}</span>
                        <span>{row.hp.toLocaleString()}</span>
                        <span>{row.atk.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No growth data available.</p>
              )}
            </div>
          </div>
        </section>

        <section id="media" className="scroll-mt-24 space-y-4">
          <SectionTitle eyebrow="Assets" title="Media" />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className={cn(PANEL_CLASS, 'p-4')}>
              <h3 className="text-base font-semibold">Artwork</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {availableArtUrls.length ? availableArtUrls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className={cn(
                      'group relative aspect-[4/3] overflow-hidden rounded-md border bg-neutral-950',
                      selectedArtUrl === url ? 'border-primary' : 'border-border'
                    )}
                    onClick={() => setSelectedArtUrl(url)}
                  >
                    <Image
                      src={url}
                      alt={`Artwork ${index + 1}`}
                      fill
                      sizes="(min-width: 1280px) 280px, (min-width: 640px) 50vw, 100vw"
                      className="object-contain p-2 transition-transform duration-200 group-hover:scale-[1.03]"
                      unoptimized
                      onError={() => setBrokenArtUrls((current) => ({ ...current, [url]: true }))}
                    />
                  </button>
                )) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-md border text-sm text-muted-foreground">
                    No artwork found.
                  </div>
                )}
              </div>
            </div>

            <div className={cn(PANEL_CLASS, 'space-y-4 p-4')}>
              <h3 className="text-base font-semibold">Pixel Animations</h3>
              <div className="relative aspect-square overflow-hidden rounded-md border bg-background">
                {selectedPixelUrl ? (
                  <Image
                    src={selectedPixelUrl}
                    alt="Pixel animation"
                    fill
                    sizes="360px"
                    className="object-contain p-6"
                    style={{ imageRendering: 'pixelated' }}
                    unoptimized
                    onError={() => setBrokenPixelUrls((current) => ({ ...current, [selectedPixelUrl]: true }))}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No pixel animation.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availablePixelAnimations.map((entry) => (
                  <Button
                    key={entry.url}
                    variant={selectedPixelUrl === entry.url ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setSelectedPixelUrl(entry.url)}
                  >
                    {entry.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="voice" className="scroll-mt-24 space-y-4">
          <SectionTitle eyebrow="Audio" title="Voice, Music, And SFX" />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-4">
              <div className={cn(PANEL_CLASS, 'space-y-3 p-4')}>
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  <h3 className="text-base font-semibold">Music Theme</h3>
                </div>
                {themesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading themes
                  </div>
                ) : themes.length ? (
                  <div className="space-y-4">
                    {themes.map((theme) => {
                      const currentUrl = themeUrls[theme.path] || theme.url;
                      const currentIndex = themeUrlIndex[theme.path] || 0;
                      const handleAudioError = () => {
                        if (!theme.fallbackUrls || currentIndex >= theme.fallbackUrls.length) return;
                        const nextUrl = theme.fallbackUrls[currentIndex];
                        setThemeUrls((current) => ({ ...current, [theme.path]: nextUrl }));
                        setThemeUrlIndex((current) => ({ ...current, [theme.path]: currentIndex + 1 }));
                      };

                      return (
                        <div key={theme.path} className={cn(INNER_PANEL_CLASS, 'p-3')}>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold">{theme.songName || 'Character Theme'}</p>
                              <p className="truncate text-xs text-muted-foreground">{theme.path}</p>
                            </div>
                            <a href={currentUrl} target="_blank" rel="noreferrer">
                              <Button variant="outline" size="sm">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open
                              </Button>
                            </a>
                          </div>
                          <AudioPlayer key={currentUrl} src={currentUrl} onError={handleAudioError} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No character theme found.</p>
                )}
              </div>

              <div className={cn(PANEL_CLASS, 'space-y-3 p-4')}>
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  <h3 className="text-base font-semibold">Battle Samples</h3>
                </div>
                {battleSamplesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking samples
                  </div>
                ) : battleSampleCues.length ? (
                  <div className="grid gap-2">
                    {battleSampleCues.map((cue) => (
                      <div key={cue} className={cn(INNER_PANEL_CLASS, 'flex flex-wrap items-center justify-between gap-3 p-3')}>
                        <div>
                          <p className="text-sm font-semibold">{cueLabel(cue)}</p>
                          <p className="font-mono text-xs text-muted-foreground">{cue}</p>
                        </div>
                        <AudioPlayer src={toVoiceUrl(character.faceCode, cue)} compact />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No battle sample audio found.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className={cn(PANEL_CLASS, 'space-y-3 p-4')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Speech Lines</h3>
                  <Input
                    value={voiceSearch}
                    onChange={(event) => setVoiceSearch(event.target.value)}
                    placeholder="Search text or cue"
                    className="w-full sm:w-64"
                  />
                </div>
                {filteredSpeechLines.length ? (
                  <ScrollArea className="h-[520px] rounded-md border">
                    <div className="space-y-2 p-3">
                      {filteredSpeechLines.map((line) => (
                        <div key={`${line.index}:${line.cue}`} className={cn(INNER_PANEL_CLASS, 'p-3')}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Line {line.index}</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{line.text || '-'}</p>
                              {line.cue && <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{line.cue}</p>}
                            </div>
                            {line.cue && <AudioPlayer src={toVoiceUrl(character.faceCode, line.cue)} compact />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground">No speech lines found.</p>
                )}
              </div>

              {detailData?.gachaSounds?.length ? (
                <div className={cn(PANEL_CLASS, 'space-y-3 p-4')}>
                  <h3 className="text-base font-semibold">SFX References</h3>
                  <ScrollArea className="h-72 rounded-md border">
                    <div className="space-y-2 p-3">
                      {detailData.gachaSounds.map((soundPath) => (
                        <div key={soundPath} className={cn(INNER_PANEL_CLASS, 'flex flex-wrap items-center justify-between gap-3 p-3')}>
                          <p className="min-w-0 break-all font-mono text-xs text-muted-foreground">{soundPath}</p>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => void copyToClipboard(soundPath, soundPath)}>
                              {copiedKey === soundPath ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            <AudioPlayer src={toSfxUrl(soundPath)} compact />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
