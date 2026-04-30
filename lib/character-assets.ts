import { ASSET_CDN_ROOT } from '@/lib/asset-url';

export const CHARACTER_ART_BASE_URL = `${ASSET_CDN_ROOT}/wfjukebox/character/character_art`;

const ATTRIBUTE_ICON_NAMES: Record<string, string> = {
  Fire: 'red',
  Water: 'blue',
  Thunder: 'yellow',
  Wind: 'green',
  Light: 'white',
  Dark: 'black',
};

const WEAPON_TYPE_ICON_NAMES: Record<string, string> = {
  Slash: 'fighter',
  Strike: 'knight',
  Thrust: 'special',
  Shot: 'ranged',
  Support: 'supporter',
};

const STANCE_ICON_NAMES: Record<string, string> = {
  Supporter: 'buffer',
  Jammer: 'debuffer',
};

const RACE_ICON_NAMES: Record<string, string> = {
  Mecha: 'machine',
  Sprite: 'element',
  Demon: 'devil',
  Plant: 'plants',
  Plants: 'plants',
  Youkai: 'mystery',
  'Human / Youkai': 'mystery',
};

const RARITY_ICON_NAMES: Record<string, string> = {
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
};

export const characterClassNames = {
  factLabel: 'text-xs font-medium uppercase tracking-normal text-muted-foreground',
  panel: 'rounded-md border border-border/70 bg-card/70',
  innerPanel: 'rounded-md border border-border/70 bg-background/55',
  heroTagBadge:
    'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-border/70 bg-card/80 px-2.5 text-xs font-semibold text-foreground',
  portraitImage: 'object-contain [image-rendering:auto]',
  portraitFallback: 'flex h-full w-full items-center justify-center text-[10px] text-muted-foreground',
} as const;

export const characterAttributeStyles: Record<string, { ring: string; text: string; accent: string }> = {
  Fire: { ring: 'border-red-500/50', text: 'text-red-300', accent: 'bg-red-500' },
  Water: { ring: 'border-cyan-500/50', text: 'text-cyan-300', accent: 'bg-cyan-500' },
  Thunder: { ring: 'border-yellow-400/60', text: 'text-yellow-200', accent: 'bg-yellow-400' },
  Wind: { ring: 'border-emerald-500/50', text: 'text-emerald-300', accent: 'bg-emerald-500' },
  Light: { ring: 'border-zinc-200/60', text: 'text-zinc-100', accent: 'bg-zinc-200' },
  Dark: { ring: 'border-fuchsia-500/50', text: 'text-fuchsia-300', accent: 'bg-fuchsia-500' },
};

export function buildCharacterSquareImageUrl(faceCode: string): string {
  return buildCharacterUiImageUrl(faceCode, 'square_0');
}

export function buildCharacterUiImageUrl(faceCode: string, fileBaseName: string): string {
  return `${CHARACTER_ART_BASE_URL}/${encodeURIComponent(faceCode)}/ui/${fileBaseName}.png`;
}

export function buildCharacterVoiceUrl(faceCode: string, cue: string): string {
  const normalizedCue = cue.replace(/^\/+/, '').replace(/\.mp3$/i, '');
  return `${CHARACTER_ART_BASE_URL}/${encodeURIComponent(faceCode)}/voice/${normalizedCue}.mp3`;
}

export function buildSfxUrl(soundPath: string): string {
  const normalizedPath = soundPath.replace(/^\/+/, '').replace(/\.mp3$/i, '');
  return `${ASSET_CDN_ROOT}/${normalizedPath}.mp3`;
}

export function getCharacterAttributeIcon(attribute: string): string {
  return `/FilterIcons/elements/round_ability_${ATTRIBUTE_ICON_NAMES[attribute] || attribute.toLowerCase()}.png`;
}

export function getCharacterWeaponTypeIcon(weaponType: string): string {
  return `/FilterIcons/types/type_${WEAPON_TYPE_ICON_NAMES[weaponType] || weaponType.toLowerCase()}_medium.png`;
}

export function getCharacterStanceIcon(stance: string): string {
  return `/FilterIcons/stances/stance_${STANCE_ICON_NAMES[stance] || stance.toLowerCase()}_medium.png`;
}

export function getCharacterRaceIcon(race: string): string {
  const primaryRace = race.includes('/') ? race.split('/')[0].trim() : race;
  const iconName = RACE_ICON_NAMES[race] || RACE_ICON_NAMES[primaryRace] || primaryRace.toLowerCase();
  return `/FilterIcons/races/race_${iconName}_medium.png`;
}

export function getCharacterRarityIcon(rarity: number | string): string {
  return `/FilterIcons/rarity/rarity_${RARITY_ICON_NAMES[String(rarity)] || 'five'}.png`;
}

export function getCharacterAttributeAccentClasses(attribute: string): string {
  const map: Record<string, string> = {
    Fire: 'from-rose-500/20 via-orange-500/10 to-transparent',
    Water: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    Thunder: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    Wind: 'from-emerald-500/20 via-lime-500/10 to-transparent',
    Light: 'from-zinc-200/30 via-slate-200/10 to-transparent',
    Dark: 'from-violet-500/20 via-indigo-500/10 to-transparent',
  };
  return map[attribute] || 'from-primary/15 via-primary/5 to-transparent';
}
