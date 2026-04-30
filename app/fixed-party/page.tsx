'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Music2, Package, Search, Shield, Sparkles, Swords, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type FixedPartyCharacter = {
  id: string;
  faceCode: string;
  nameEN: string;
  nameJP: string;
  titleEN: string;
  titleJP: string;
  attribute: string;
  rarity: string;
  weaponType: string;
};

type FixedPartyItem = {
  id: string;
  type: 'item' | 'equipment';
  name: string;
  icon: string;
  thumbnail?: string;
  category: string;
};

type FixedPartyUnit = {
  position: number;
  characterId: number;
  level: number;
  uncapTier: number;
  rawState: number;
  rawVariant: number;
  note: string;
  manaNodeIds: number[];
  manaNodeCount: number;
  character: FixedPartyCharacter | null;
};

type FixedPartyEquipment = {
  position: number;
  equipmentId: number;
  tier: number;
  item: FixedPartyItem | null;
};

type FixedPartySoul = {
  position: number;
  soulId: number;
  item: FixedPartyItem | null;
};

type FixedPartySlot = {
  index: number;
  main: FixedPartyUnit | null;
  unison: FixedPartyUnit | null;
  equipment: FixedPartyEquipment | null;
  soul: FixedPartySoul | null;
};

type FixedPartyEntry = {
  id: string;
  slug: string;
  label: string;
  slots: FixedPartySlot[];
  activeUnitCount: number;
  equipmentCount: number;
  soulCount: number;
};

type FixedPartyPayload = {
  generatedAt: string;
  count: number;
  entries: FixedPartyEntry[];
};

type CharacterDetailResponse = {
  character: {
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
    skill: string;
    leaderBuff: string;
    abilities: string[];
    hitCount: number;
    feverGain: number;
    manaBoard2: boolean;
    obtain: string;
    otherCommonNames: string;
    songs: string[];
  };
  growth: Array<{ level: number; hp: number; atk: number }>;
  speechLines: Array<{ index: number; text: string; cue: string }>;
  gachaSounds: string[];
  art: {
    galleryUrls: string[];
    fullShotAttributes: Record<string, unknown>;
  };
  themes?: Array<{ path: string; songName: string; url: string }>;
};

type ItemRelationReference = {
  sourcePath: string;
  sourceLabel: string;
  group: 'drops' | 'shops' | 'usage' | 'enhancement' | 'references';
  entryId: string;
  matchPath: string;
  summary: string;
};

type ItemDetailResponse = {
  entry: {
    id: string;
    devname: string;
    name: string;
    description: string;
    icon: string;
    rarity: number;
    category: string;
    type: 'item' | 'equipment';
    flavorText?: string;
    thumbnail?: string;
  };
  imageCandidates: string[];
  enhancementOptions: number[];
  hasEnhancementData: boolean;
  relationReferences: ItemRelationReference[];
  equipmentStats: Array<{ level: number; hp: number; atk: number }>;
  equipmentAbilityProfile: {
    internalKey: string;
    effectToken: string;
    effectVariantToken: string;
    linkedAbilityIds: string[];
    element: string;
    valueMin: number | null;
    valueMax: number | null;
  } | null;
  equipmentAbilities: Array<{
    abilityId: string;
    internalKey: string;
    effectToken: string;
    element: string;
    valueMin: number | null;
    valueMax: number | null;
  }>;
  equipmentCatalogEntry: {
    devNickname: string;
    rarity: number | null;
    maxHp: number | null;
    maxAtk: number | null;
    categoryHint: string;
    jpName: string;
  } | null;
  equipmentSheetEntry: {
    sourceTab: string;
    devNickname: string;
    enName: string;
    jpName: string;
    rarity: string;
    attribute: string;
    maxHp: number | null;
    maxAtk: number | null;
    weaponSkill: string;
    abilitySoul: string;
    awakenLv3: string;
    awakenLv5: string;
    enhanceLv1: string;
    enhanceLv70: string;
    enhanceLv99: string;
    enhanceLv100: string;
    enhanceLv120: string;
    obtain: string;
    otherCommonNames: string;
    notes: string;
    boss: string;
  } | null;
};

type CharacterLink = {
  faceCode: string;
  label: string;
  count: number;
};

type ItemLink = {
  key: string;
  id: string;
  label: string;
  count: number;
  type: 'item' | 'equipment';
};

type CharacterConnectionSummary = {
  presetIds: string[];
  mainCount: number;
  unisonCount: number;
  pairings: CharacterLink[];
  weapons: ItemLink[];
  souls: ItemLink[];
};

type ItemConnectionSummary = {
  presetIds: string[];
  weaponCount: number;
  soulCount: number;
  companions: CharacterLink[];
};

type DetailTarget =
  | {
      kind: 'character';
      faceCode: string;
      summary: FixedPartyCharacter | null;
      context?: {
        presetId: string;
        presetSlug: string;
        slotIndex: number;
        role: 'main' | 'unison';
        level: number;
        uncapTier: number;
        manaNodeCount: number;
      };
    }
  | {
      kind: 'item';
      id: string;
      itemType: 'item' | 'equipment';
      label: 'Weapon' | 'Soul';
      summary: FixedPartyItem | null;
      context?: {
        presetId: string;
        presetSlug: string;
        slotIndex: number;
        tier?: number;
      };
    };

const PANEL = 'rounded-md border border-border/70 bg-card/80';
const INNER = 'rounded-md border border-border/70 bg-background/50';
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const ATTRIBUTE_ACCENTS: Record<string, { border: string; tint: string; badge: string }> = {
  Fire: {
    border: 'border-rose-500/35',
    tint: 'from-rose-500/20 via-rose-500/5 to-transparent',
    badge: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  },
  Water: {
    border: 'border-sky-500/35',
    tint: 'from-sky-500/20 via-sky-500/5 to-transparent',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  },
  Wind: {
    border: 'border-emerald-500/35',
    tint: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  },
  Thunder: {
    border: 'border-amber-400/35',
    tint: 'from-amber-400/20 via-amber-400/5 to-transparent',
    badge: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  },
  Light: {
    border: 'border-slate-300/30',
    tint: 'from-slate-200/15 via-violet-200/5 to-transparent',
    badge: 'border-slate-200/30 bg-slate-200/10 text-slate-100',
  },
  Dark: {
    border: 'border-fuchsia-500/30',
    tint: 'from-fuchsia-500/18 via-fuchsia-500/5 to-transparent',
    badge: 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-200',
  },
};

const RELATION_GROUP_META: Record<
  ItemRelationReference['group'],
  { title: string; icon: typeof Package; empty: string }
> = {
  drops: {
    title: 'Drops / Rewards',
    icon: Package,
    empty: 'No drop or reward references were found.',
  },
  shops: {
    title: 'Shops / Exchanges',
    icon: Package,
    empty: 'No shop references were found.',
  },
  usage: {
    title: 'Usage / Costs',
    icon: Link2,
    empty: 'No usage references were found.',
  },
  enhancement: {
    title: 'Enhancement Links',
    icon: Sparkles,
    empty: 'No enhancement metadata was found.',
  },
  references: {
    title: 'Other Data Links',
    icon: Link2,
    empty: 'No additional references were found.',
  },
};

function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(value);
}

function toCdnAssetUrl(value?: string): string {
  const token = (value || '').trim();
  if (!token) return '';
  if (token.startsWith('http://') || token.startsWith('https://')) return token;
  const normalized = token.replace(/^\/+/, '');
  if (!normalized) return '';
  return `${CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
}

function buildCharacterThumbUrls(faceCode: string, kind: 'main' | 'unison'): string[] {
  if (!faceCode) return [];
  const encoded = encodeURIComponent(faceCode);
  const base = `${CDN_ROOT}/wfjukebox/character/character_art`;
  const prefix = kind === 'main' ? 'thumb_party_main' : 'thumb_party_unison';
  return Array.from(
    new Set([
      `${base}/${faceCode}/ui/${prefix}_0.png`,
      `${base}/${faceCode}/ui/${prefix}_1.png`,
      `${base}/${encoded}/ui/${prefix}_0.png`,
      `${base}/${encoded}/ui/${prefix}_1.png`,
      `${base}/${faceCode}/ui/square_0.png`,
      `${base}/${faceCode}/ui/square_1.png`,
      `${base}/${encoded}/ui/square_0.png`,
      `${base}/${encoded}/ui/square_1.png`,
    ])
  );
}

function buildCharacterGalleryUrls(faceCode: string, detail?: CharacterDetailResponse | null): string[] {
  const base = `${CDN_ROOT}/wfjukebox/character/character_art/${encodeURIComponent(faceCode)}/ui`;
  return Array.from(
    new Set([
      ...(detail?.art.galleryUrls || []),
      `${base}/full_shot_1440_1920_0.png`,
      `${base}/battle_member_status_0.png`,
      `${base}/square_0.png`,
      `${base}/square_1.png`,
    ].filter(Boolean))
  );
}

function buildItemThumbUrls(item: FixedPartyItem | null): string[] {
  if (!item) return [];
  return Array.from(new Set([toCdnAssetUrl(item.thumbnail), toCdnAssetUrl(item.icon)].filter(Boolean)));
}

function displayCharacterName(character: FixedPartyCharacter | null, fallbackId: number): string {
  return character?.nameEN || character?.nameJP || (fallbackId > 0 ? `Character ${fallbackId}` : 'Empty');
}

function displayItemName(item: FixedPartyItem | null, fallbackId: number, label: string): string {
  return item?.name || (fallbackId > 0 ? `${label} ${fallbackId}` : `No ${label.toLowerCase()}`);
}

function displayCharacterTitle(character: FixedPartyCharacter | null): string {
  return character?.titleEN || character?.titleJP || '';
}

function getAttributeAccent(attribute?: string) {
  return ATTRIBUTE_ACCENTS[attribute || ''] || {
    border: 'border-border/70',
    tint: 'from-muted/25 via-transparent to-transparent',
    badge: 'border-border/70 bg-background/70 text-foreground',
  };
}

function buildMetaLine(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' | ');
}

function formatMaybeNumber(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return '-';
  return new Intl.NumberFormat('en-US').format(value as number);
}

function toDisplayToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) return '';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function toShareDataPathHref(path: string) {
  return `/share/${path.replace(/^\/+/, '')}`;
}

function sortByCount<T extends { count: number; label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function useImageCandidate(urls: string[]) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const active = urls.find((url) => !failed.has(url)) || '';

  return {
    active,
    markFailed: () =>
      setFailed((current) => {
        if (!active || current.has(active)) return current;
        const next = new Set(current);
        next.add(active);
        return next;
      }),
  };
}

function AssetThumb({
  urls,
  alt,
  size,
  pixelated = false,
}: {
  urls: string[];
  alt: string;
  size: number;
  pixelated?: boolean;
}) {
  const { active, markFailed } = useImageCandidate(urls);

  return (
    <div
      className='relative shrink-0 overflow-hidden rounded-md border border-border/60 bg-background/80'
      style={{ width: size, height: size }}
      title={alt}
    >
      {active ? (
        <Image
          src={active}
          alt={alt}
          fill
          sizes={`${size}px`}
          className='object-contain'
          style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
          unoptimized
          onError={markFailed}
        />
      ) : (
        <div className='flex h-full w-full items-center justify-center text-[10px] text-muted-foreground'>No Image</div>
      )}
    </div>
  );
}

function AssetPreview({
  urls,
  alt,
  className,
  imageClassName = 'object-contain p-4',
  pixelated = false,
}: {
  urls: string[];
  alt: string;
  className?: string;
  imageClassName?: string;
  pixelated?: boolean;
}) {
  const { active, markFailed } = useImageCandidate(urls);

  return (
    <div className={cn('relative overflow-hidden rounded-md border border-border/70 bg-background/60', className)}>
      {active ? (
        <Image
          src={active}
          alt={alt}
          fill
          sizes='(max-width: 768px) 100vw, 40vw'
          className={imageClassName}
          style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
          unoptimized
          onError={markFailed}
        />
      ) : (
        <div className='flex h-full min-h-[220px] w-full items-center justify-center text-sm text-muted-foreground'>No image found</div>
      )}
    </div>
  );
}

function DetailChip({
  label,
  count,
  onClick,
}: {
  label: string;
  count?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className='truncate'>{label}</span>
      {typeof count === 'number' ? <span className='text-[10px] text-muted-foreground'>{count}</span> : null}
    </>
  );

  if (!onClick) {
    return <span className='inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-xs'>{content}</span>;
  }

  return (
    <button
      type='button'
      onClick={onClick}
      className='inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-left text-xs transition hover:border-primary/50 hover:bg-accent/40'
    >
      {content}
    </button>
  );
}

function KeyMetric({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: string | number | boolean;
  subtle?: boolean;
}) {
  return (
    <div className={cn('rounded-md border border-border/70 p-3', subtle ? 'bg-background/45' : 'bg-card/70')}>
      <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>{label}</p>
      <p className='mt-1 text-sm font-medium'>{String(value)}</p>
    </div>
  );
}

function SlotUnitCard({
  unit,
  kind,
  compact = false,
  onSelect,
}: {
  unit: FixedPartyUnit | null;
  kind: 'main' | 'unison';
  compact?: boolean;
  onSelect?: () => void;
}) {
  const size = compact ? 60 : 96;
  const name = unit ? displayCharacterName(unit.character, unit.characterId) : `No ${kind}`;
  const interactive = Boolean(unit && onSelect);

  const content = (
    <div
      className={cn(
        INNER,
        compact ? 'p-2' : 'p-3',
        interactive ? 'transition hover:border-primary/50 hover:bg-accent/35' : ''
      )}
    >
      <div className='flex items-center gap-3'>
        <AssetThumb
          urls={unit?.character?.faceCode ? buildCharacterThumbUrls(unit.character.faceCode, kind) : []}
          alt={name}
          size={size}
        />
        <div className='min-w-0 flex-1'>
          <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>{kind === 'main' ? 'Main' : 'Unison'}</p>
          <p className='truncate text-sm font-semibold'>{name}</p>
          {unit ? (
            <>
              <p className='truncate text-[11px] text-muted-foreground'>{displayCharacterTitle(unit.character)}</p>
              <div className='mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground'>
                {unit.level > 0 && <span>Lv {unit.level}</span>}
                {unit.uncapTier > 0 && <span>Tier {unit.uncapTier}</span>}
                {unit.manaNodeCount > 0 && <span>{unit.manaNodeCount} nodes</span>}
              </div>
            </>
          ) : (
            <p className='mt-1 text-[11px] text-muted-foreground'>Empty slot</p>
          )}
        </div>
      </div>
    </div>
  );

  if (!interactive) return content;

  return (
    <button type='button' onClick={onSelect} className='w-full text-left'>
      {content}
    </button>
  );
}

function SlotItemCard({
  label,
  item,
  itemId,
  tier,
  compact = false,
  onSelect,
}: {
  label: 'Weapon' | 'Soul';
  item: FixedPartyItem | null;
  itemId: number;
  tier?: number;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const name = displayItemName(item, itemId, label);
  const size = compact ? 36 : 42;
  const metaLine = buildMetaLine([tier && tier > 0 ? `Tier ${tier}` : '', item?.category || '']);
  const interactive = Boolean(itemId > 0 && onSelect);

  const content = (
    <div
      className={cn(
        INNER,
        compact ? 'p-2.5' : 'p-2',
        interactive ? 'transition hover:border-primary/50 hover:bg-accent/35' : ''
      )}
    >
      <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>{label}</p>
      <div className='mt-1 flex items-center gap-2'>
        <AssetThumb urls={buildItemThumbUrls(item)} alt={name} size={size} pixelated={label === 'Weapon'} />
        <div className='min-w-0 flex-1'>
          <p className={cn('truncate font-medium', compact ? 'text-xs' : 'text-sm')}>{name}</p>
          {metaLine ? <p className='truncate text-[11px] text-muted-foreground'>{metaLine}</p> : null}
        </div>
      </div>
    </div>
  );

  if (!interactive) return content;

  return (
    <button type='button' onClick={onSelect} className='w-full text-left'>
      {content}
    </button>
  );
}

function SlotPreview({
  entry,
  slot,
  onCharacterSelect,
  onItemSelect,
}: {
  entry: FixedPartyEntry;
  slot: FixedPartySlot;
  onCharacterSelect: (unit: FixedPartyUnit, role: 'main' | 'unison', slotIndex: number, preset: FixedPartyEntry) => void;
  onItemSelect: (itemType: 'item' | 'equipment', itemId: number, label: 'Weapon' | 'Soul', summary: FixedPartyItem | null, slotIndex: number, preset: FixedPartyEntry, tier?: number) => void;
}) {
  const mainName = displayCharacterName(slot.main?.character || null, slot.main?.characterId || 0);
  const unisonName = displayCharacterName(slot.unison?.character || null, slot.unison?.characterId || 0);
  const accent = getAttributeAccent(slot.main?.character?.attribute || slot.unison?.character?.attribute);
  const attributeLabel = slot.main?.character?.attribute || slot.unison?.character?.attribute || 'Neutral';
  const weaponSelect = slot.equipment
    ? (() => {
        const equipment = slot.equipment;
        return () =>
          onItemSelect(
            equipment.item?.type || 'equipment',
            equipment.equipmentId,
            'Weapon',
            equipment.item,
            slot.index,
            entry,
            equipment.tier
          );
      })()
    : undefined;
  const soulSelect = slot.soul
    ? (() => {
        const soul = slot.soul;
        return () =>
          onItemSelect(
            soul.item?.type || 'item',
            soul.soulId,
            'Soul',
            soul.item,
            slot.index,
            entry
          );
      })()
    : undefined;
  const mainMeta = slot.main
    ? buildMetaLine([
        slot.main.level > 0 ? `Lv ${slot.main.level}` : '',
        slot.main.uncapTier > 0 ? `Tier ${slot.main.uncapTier}` : '',
        slot.main.manaNodeCount > 0 ? `${slot.main.manaNodeCount} nodes` : '',
      ])
    : 'Empty slot';
  const unisonMeta = slot.unison
    ? buildMetaLine([
        slot.unison.level > 0 ? `Lv ${slot.unison.level}` : '',
        slot.unison.uncapTier > 0 ? `Tier ${slot.unison.uncapTier}` : '',
        slot.unison.manaNodeCount > 0 ? `${slot.unison.manaNodeCount} nodes` : '',
      ])
    : 'No unison';

  return (
    <div className={cn(PANEL, 'overflow-hidden')}>
      <div className='flex items-center justify-between border-b border-border/60 px-3 py-3'>
        <div className='flex items-center gap-2'>
          <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Slot {slot.index + 1}</p>
          <Badge variant='outline' className={cn('rounded-md', accent.badge)}>
            {attributeLabel}
          </Badge>
        </div>
        {slot.index === 0 && <Badge variant='secondary' className='rounded-md'>Leader</Badge>}
      </div>

      <div className='space-y-3 p-3'>
        <div className={cn(INNER, accent.border, 'relative overflow-hidden p-3')}>
          <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', accent.tint)} />
          <div className='relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]'>
            <div className='relative min-h-[178px] rounded-md border border-border/60 bg-background/70 p-3'>
              <div className='max-w-[calc(100%-7.5rem)] space-y-3 pr-2'>
                <div>
                  <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Main Unit</p>
                  <p className='mt-1 line-clamp-2 text-base font-semibold'>{mainName}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>{mainMeta}</p>
                </div>
                <div>
                  <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Unison</p>
                  <p className='mt-1 line-clamp-2 text-sm font-medium'>{unisonName}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>{unisonMeta}</p>
                </div>
              </div>

              <div className='absolute right-3 top-3'>
                <AssetThumb
                  urls={slot.main?.character?.faceCode ? buildCharacterThumbUrls(slot.main.character.faceCode, 'main') : []}
                  alt={mainName}
                  size={108}
                />
              </div>
              <div className='absolute bottom-2 right-2 z-10'>
                <AssetThumb
                  urls={slot.unison?.character?.faceCode ? buildCharacterThumbUrls(slot.unison.character.faceCode, 'unison') : []}
                  alt={unisonName}
                  size={64}
                />
              </div>
            </div>

            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-1'>
              <SlotItemCard
                label='Weapon'
                item={slot.equipment?.item || null}
                itemId={slot.equipment?.equipmentId || 0}
                tier={slot.equipment?.tier}
                compact
                onSelect={weaponSelect}
              />
              <SlotItemCard
                label='Soul'
                item={slot.soul?.item || null}
                itemId={slot.soul?.soulId || 0}
                compact
                onSelect={soulSelect}
              />
            </div>
          </div>
        </div>

        <div className='grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
          <SlotUnitCard
            unit={slot.main}
            kind='main'
            onSelect={slot.main ? () => onCharacterSelect(slot.main as FixedPartyUnit, 'main', slot.index, entry) : undefined}
          />
          <SlotUnitCard
            unit={slot.unison}
            kind='unison'
            compact
            onSelect={slot.unison ? () => onCharacterSelect(slot.unison as FixedPartyUnit, 'unison', slot.index, entry) : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function EntryListItem({
  entry,
  selected,
  onSelect,
}: {
  entry: FixedPartyEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const previewUnits = entry.slots.map((slot) => slot.main).filter(Boolean).slice(0, 3) as FixedPartyUnit[];

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border p-3 text-left transition',
        selected ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/45 hover:border-primary/50 hover:bg-accent/35'
      )}
    >
      <div className='flex items-start gap-3'>
        <div className='flex shrink-0 -space-x-3'>
          {previewUnits.length > 0 ? (
            previewUnits.map((unit, index) => (
              <div key={`${entry.id}-${unit.characterId}-${index}`} className='rounded-md bg-background/70 p-0.5'>
                <AssetThumb
                  urls={unit.character?.faceCode ? buildCharacterThumbUrls(unit.character.faceCode, 'main') : []}
                  alt={displayCharacterName(unit.character, unit.characterId)}
                  size={42}
                />
              </div>
            ))
          ) : (
            <div className='rounded-md bg-background/70 p-0.5'>
              <AssetThumb urls={[]} alt='No party units' size={42} />
            </div>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-2'>
            <div className='min-w-0'>
              <p className='truncate font-semibold'>{entry.slug}</p>
              <p className='truncate text-xs text-muted-foreground'>{entry.label}</p>
            </div>
            <Badge variant={selected ? 'default' : 'secondary'} className='rounded-md'>
              {entry.activeUnitCount}
            </Badge>
          </div>
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {entry.equipmentCount > 0 && (
              <Badge variant='outline' className='rounded-md'>
                {entry.equipmentCount} weapons
              </Badge>
            )}
            {entry.soulCount > 0 && (
              <Badge variant='outline' className='rounded-md'>
                {entry.soulCount} souls
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function FixedPartyPage() {
  const [payload, setPayload] = useState<FixedPartyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [characterDetailCache, setCharacterDetailCache] = useState<Record<string, CharacterDetailResponse>>({});
  const [itemDetailCache, setItemDetailCache] = useState<Record<string, ItemDetailResponse>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/fixed-party', { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Fixed party request failed (${response.status})`);
        const data = (await response.json()) as FixedPartyPayload;
        if (cancelled) return;
        setPayload(data);
        setSelectedId((current) => current || data.entries[0]?.id || '');
      } catch (loadError) {
        console.error('Failed to load fixed party data:', loadError);
        if (!cancelled) setError('Failed to load fixed party presets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(() => payload?.entries || [], [payload]);

  const entryById = useMemo(() => {
    const next: Record<string, FixedPartyEntry> = {};
    for (const entry of entries) next[entry.id] = entry;
    return next;
  }, [entries]);

  const characterSummaryByFaceCode = useMemo(() => {
    const next: Record<string, FixedPartyCharacter> = {};
    for (const entry of entries) {
      for (const slot of entry.slots) {
        for (const unit of [slot.main, slot.unison]) {
          const faceCode = unit?.character?.faceCode || '';
          if (!faceCode || next[faceCode]) continue;
          next[faceCode] = unit?.character as FixedPartyCharacter;
        }
      }
    }
    return next;
  }, [entries]);

  const itemSummaryByKey = useMemo(() => {
    const next: Record<string, FixedPartyItem> = {};
    for (const entry of entries) {
      for (const slot of entry.slots) {
        if (slot.equipment?.equipmentId && slot.equipment.item) {
          next[`equipment:${slot.equipment.equipmentId}`] = slot.equipment.item;
        }
        if (slot.soul?.soulId && slot.soul.item) {
          next[`${slot.soul.item.type}:${slot.soul.soulId}`] = slot.soul.item;
        }
      }
    }
    return next;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const token = query.trim().toLowerCase();
    if (!token) return entries;

    return entries.filter((entry) => {
      const unitNames = entry.slots
        .flatMap((slot) => [
          displayCharacterName(slot.main?.character || null, slot.main?.characterId || 0),
          displayCharacterName(slot.unison?.character || null, slot.unison?.characterId || 0),
          displayItemName(slot.equipment?.item || null, slot.equipment?.equipmentId || 0, 'Weapon'),
          displayItemName(slot.soul?.item || null, slot.soul?.soulId || 0, 'Soul'),
        ])
        .join(' ');

      return `${entry.slug} ${entry.label} ${unitNames}`.toLowerCase().includes(token);
    });
  }, [entries, query]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) || filteredEntries[0] || entries[0] || null,
    [entries, filteredEntries, selectedId]
  );

  useEffect(() => {
    if (!selectedEntry) return;
    if (filteredEntries.some((entry) => entry.id === selectedEntry.id)) return;
    setSelectedId(filteredEntries[0]?.id || entries[0]?.id || '');
  }, [entries, filteredEntries, selectedEntry]);

  const connectionSummary = useMemo(() => {
    const characterBuckets = new Map<
      string,
      {
        label: string;
        presetIds: Set<string>;
        mainCount: number;
        unisonCount: number;
        pairings: Map<string, CharacterLink>;
        weapons: Map<string, ItemLink>;
        souls: Map<string, ItemLink>;
      }
    >();
    const itemBuckets = new Map<
      string,
      {
        label: string;
        type: 'item' | 'equipment';
        id: string;
        presetIds: Set<string>;
        weaponCount: number;
        soulCount: number;
        companions: Map<string, CharacterLink>;
      }
    >();

    const ensureCharacterBucket = (faceCode: string, label: string) => {
      let bucket = characterBuckets.get(faceCode);
      if (!bucket) {
        bucket = {
          label,
          presetIds: new Set<string>(),
          mainCount: 0,
          unisonCount: 0,
          pairings: new Map<string, CharacterLink>(),
          weapons: new Map<string, ItemLink>(),
          souls: new Map<string, ItemLink>(),
        };
        characterBuckets.set(faceCode, bucket);
      }
      return bucket;
    };

    const ensureItemBucket = (key: string, id: string, label: string, type: 'item' | 'equipment') => {
      let bucket = itemBuckets.get(key);
      if (!bucket) {
        bucket = {
          label,
          type,
          id,
          presetIds: new Set<string>(),
          weaponCount: 0,
          soulCount: 0,
          companions: new Map<string, CharacterLink>(),
        };
        itemBuckets.set(key, bucket);
      }
      return bucket;
    };

    for (const entry of entries) {
      const presetUnits = entry.slots
        .flatMap((slot) => [slot.main, slot.unison])
        .filter((unit): unit is FixedPartyUnit => Boolean(unit?.character?.faceCode))
        .map((unit) => ({
          faceCode: unit.character?.faceCode || '',
          label: displayCharacterName(unit.character, unit.characterId),
        }));

      for (const slot of entry.slots) {
        for (const [role, unit] of [
          ['main', slot.main],
          ['unison', slot.unison],
        ] as const) {
          if (!unit?.character?.faceCode) continue;
          const faceCode = unit.character.faceCode;

          const bucket = ensureCharacterBucket(faceCode, displayCharacterName(unit.character, unit.characterId));
          bucket.presetIds.add(entry.id);
          if (role === 'main') bucket.mainCount += 1;
          else bucket.unisonCount += 1;

          for (const partner of presetUnits) {
            if (!partner.faceCode || partner.faceCode === faceCode) continue;
            const current = bucket.pairings.get(partner.faceCode);
            if (current) current.count += 1;
            else bucket.pairings.set(partner.faceCode, { faceCode: partner.faceCode, label: partner.label, count: 1 });
          }

          if (slot.equipment?.equipmentId) {
            const key = `${slot.equipment.item?.type || 'equipment'}:${slot.equipment.equipmentId}`;
            const label = displayItemName(slot.equipment.item, slot.equipment.equipmentId, 'Weapon');
            const current = bucket.weapons.get(key);
            if (current) current.count += 1;
            else {
              bucket.weapons.set(key, {
                key,
                id: String(slot.equipment.equipmentId),
                label,
                count: 1,
                type: slot.equipment.item?.type || 'equipment',
              });
            }
          }

          if (slot.soul?.soulId) {
            const key = `${slot.soul.item?.type || 'item'}:${slot.soul.soulId}`;
            const label = displayItemName(slot.soul.item, slot.soul.soulId, 'Soul');
            const current = bucket.souls.get(key);
            if (current) current.count += 1;
            else {
              bucket.souls.set(key, {
                key,
                id: String(slot.soul.soulId),
                label,
                count: 1,
                type: slot.soul.item?.type || 'item',
              });
            }
          }
        }

        if (slot.equipment?.equipmentId) {
          const key = `${slot.equipment.item?.type || 'equipment'}:${slot.equipment.equipmentId}`;
          const itemBucket = ensureItemBucket(
            key,
            String(slot.equipment.equipmentId),
            displayItemName(slot.equipment.item, slot.equipment.equipmentId, 'Weapon'),
            slot.equipment.item?.type || 'equipment'
          );
          itemBucket.presetIds.add(entry.id);
          itemBucket.weaponCount += 1;
          for (const unit of [slot.main, slot.unison]) {
            const faceCode = unit?.character?.faceCode || '';
            if (!faceCode) continue;
            const current = itemBucket.companions.get(faceCode);
            if (current) current.count += 1;
            else {
              itemBucket.companions.set(faceCode, {
                faceCode,
                label: displayCharacterName(unit?.character || null, unit?.characterId || 0),
                count: 1,
              });
            }
          }
        }

        if (slot.soul?.soulId) {
          const key = `${slot.soul.item?.type || 'item'}:${slot.soul.soulId}`;
          const itemBucket = ensureItemBucket(
            key,
            String(slot.soul.soulId),
            displayItemName(slot.soul.item, slot.soul.soulId, 'Soul'),
            slot.soul.item?.type || 'item'
          );
          itemBucket.presetIds.add(entry.id);
          itemBucket.soulCount += 1;
          for (const unit of [slot.main, slot.unison]) {
            const faceCode = unit?.character?.faceCode || '';
            if (!faceCode) continue;
            const current = itemBucket.companions.get(faceCode);
            if (current) current.count += 1;
            else {
              itemBucket.companions.set(faceCode, {
                faceCode,
                label: displayCharacterName(unit?.character || null, unit?.characterId || 0),
                count: 1,
              });
            }
          }
        }
      }
    }

    const characterUsageByFaceCode: Record<string, CharacterConnectionSummary> = {};
    for (const [faceCode, bucket] of characterBuckets.entries()) {
      characterUsageByFaceCode[faceCode] = {
        presetIds: Array.from(bucket.presetIds).sort((a, b) => Number(a) - Number(b)),
        mainCount: bucket.mainCount,
        unisonCount: bucket.unisonCount,
        pairings: sortByCount(Array.from(bucket.pairings.values())),
        weapons: sortByCount(Array.from(bucket.weapons.values())),
        souls: sortByCount(Array.from(bucket.souls.values())),
      };
    }

    const itemUsageByKey: Record<string, ItemConnectionSummary> = {};
    for (const [key, bucket] of itemBuckets.entries()) {
      itemUsageByKey[key] = {
        presetIds: Array.from(bucket.presetIds).sort((a, b) => Number(a) - Number(b)),
        weaponCount: bucket.weaponCount,
        soulCount: bucket.soulCount,
        companions: sortByCount(Array.from(bucket.companions.values())),
      };
    }

    return { characterUsageByFaceCode, itemUsageByKey };
  }, [entries]);

  const activeCharacterDetail =
    detailTarget?.kind === 'character' ? characterDetailCache[detailTarget.faceCode] || null : null;
  const activeItemDetail =
    detailTarget?.kind === 'item' ? itemDetailCache[`${detailTarget.itemType}:${detailTarget.id}`] || null : null;

  useEffect(() => {
    if (!detailTarget) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    if (detailTarget.kind === 'character' && characterDetailCache[detailTarget.faceCode]) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    if (detailTarget.kind === 'item' && itemDetailCache[`${detailTarget.itemType}:${detailTarget.id}`]) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    const target = detailTarget;

    async function loadDetail() {
      try {
        if (target.kind === 'character') {
          const response = await fetch(
            `/api/character-detail?devnickname=${encodeURIComponent(target.faceCode)}&include=theme`,
            { cache: 'force-cache' }
          );
          if (!response.ok) throw new Error(`Character detail request failed (${response.status})`);
          const payload = (await response.json()) as CharacterDetailResponse;
          if (cancelled) return;
          setCharacterDetailCache((current) => ({ ...current, [target.faceCode]: payload }));
        } else {
          const cacheKey = `${target.itemType}:${target.id}`;
          const response = await fetch(
            `/api/item-detail?type=${encodeURIComponent(target.itemType)}&id=${encodeURIComponent(target.id)}`,
            { cache: 'force-cache' }
          );
          if (!response.ok) throw new Error(`Item detail request failed (${response.status})`);
          const payload = (await response.json()) as ItemDetailResponse;
          if (cancelled) return;
          setItemDetailCache((current) => ({ ...current, [cacheKey]: payload }));
        }
      } catch (loadError) {
        console.error('Failed to load fixed party detail modal data:', loadError);
        if (!cancelled) setDetailError('Could not load detail data for this entry.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [characterDetailCache, detailTarget, itemDetailCache]);

  const openCharacterDetail = useCallback(
    (unit: FixedPartyUnit, role: 'main' | 'unison', slotIndex: number, preset: FixedPartyEntry) => {
      if (!unit.character?.faceCode) return;
      setDetailTarget({
        kind: 'character',
        faceCode: unit.character.faceCode,
        summary: unit.character,
        context: {
          presetId: preset.id,
          presetSlug: preset.slug,
          slotIndex,
          role,
          level: unit.level,
          uncapTier: unit.uncapTier,
          manaNodeCount: unit.manaNodeCount,
        },
      });
    },
    []
  );

  const openItemDetail = useCallback(
    (
      itemType: 'item' | 'equipment',
      itemId: number,
      label: 'Weapon' | 'Soul',
      summary: FixedPartyItem | null,
      slotIndex: number,
      preset: FixedPartyEntry,
      tier?: number
    ) => {
      if (!itemId) return;
      setDetailTarget({
        kind: 'item',
        id: String(itemId),
        itemType,
        label,
        summary,
        context: {
          presetId: preset.id,
          presetSlug: preset.slug,
          slotIndex,
          tier,
        },
      });
    },
    []
  );

  const jumpToPreset = useCallback((presetId: string) => {
    setSelectedId(presetId);
    setDetailTarget(null);
    setDetailError(null);
    setDetailLoading(false);
  }, []);

  const characterConnections =
    detailTarget?.kind === 'character'
      ? connectionSummary.characterUsageByFaceCode[detailTarget.faceCode] || null
      : null;
  const itemConnections =
    detailTarget?.kind === 'item'
      ? connectionSummary.itemUsageByKey[`${detailTarget.itemType}:${detailTarget.id}`] || null
      : null;

  const characterTitle =
    activeCharacterDetail?.character.titleEN ||
    activeCharacterDetail?.character.titleJP ||
    displayCharacterTitle(detailTarget?.kind === 'character' ? detailTarget.summary : null);

  const characterName =
    activeCharacterDetail?.character.nameEN ||
    activeCharacterDetail?.character.nameJP ||
    (detailTarget?.kind === 'character'
      ? detailTarget.summary?.nameEN || detailTarget.summary?.nameJP || detailTarget.faceCode
      : '');

  const itemName =
    activeItemDetail?.entry.name ||
    (detailTarget?.kind === 'item'
      ? detailTarget.summary?.name || `${detailTarget.label} ${detailTarget.id}`
      : '');

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className='flex min-h-screen items-center justify-center px-4'>
        <div className={cn(PANEL, 'max-w-md p-6 text-center')}>
          <Shield className='mx-auto h-8 w-8 text-destructive' />
          <h1 className='mt-3 text-xl font-semibold'>Fixed Party did not load</h1>
          <p className='mt-2 text-sm text-muted-foreground'>{error || 'No fixed party data was returned.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className='min-h-screen bg-background'>
        <div className='border-b bg-card/65'>
          <div className='mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-4 py-5 md:px-6'>
            <div>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Shield className='h-4 w-4' />
                Preset team data
              </div>
              <h1 className='mt-1 text-3xl font-semibold tracking-tight'>Fixed Party</h1>
              <p className='mt-2 max-w-3xl text-sm leading-6 text-muted-foreground'>
                Story and event preset parties with party thumbnails, equipment, souls, and quick in-page detail modals.
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline' className='rounded-md'>
                fixed_party.json
              </Badge>
              <Badge variant='outline' className='rounded-md'>
                {payload.count} presets
              </Badge>
            </div>
          </div>
        </div>

        <main className='mx-auto max-w-[1600px] space-y-5 px-4 py-5 md:px-6'>
          <section className='grid gap-3 sm:grid-cols-3'>
            <Card className='rounded-md border-border/70 bg-card/85 shadow-none'>
              <CardContent className='flex items-center gap-3 p-4'>
                <Users className='h-5 w-5 text-muted-foreground' />
                <div>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>Presets</p>
                  <p className='text-2xl font-semibold'>{payload.count}</p>
                </div>
              </CardContent>
            </Card>
            <Card className='rounded-md border-border/70 bg-card/85 shadow-none'>
              <CardContent className='flex items-center gap-3 p-4'>
                <Swords className='h-5 w-5 text-muted-foreground' />
                <div>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>Filtered</p>
                  <p className='text-2xl font-semibold'>{filteredEntries.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className='rounded-md border-border/70 bg-card/85 shadow-none'>
              <CardContent className='flex items-center gap-3 p-4'>
                <Link2 className='h-5 w-5 text-muted-foreground' />
                <div>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>Modal Links</p>
                  <p className='text-2xl font-semibold'>Connected</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className='grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]'>
            <Card className='rounded-md border-border/70 bg-card/85 shadow-none'>
              <CardHeader className='border-b pb-4'>
                <CardTitle className='text-base'>Presets</CardTitle>
                <CardDescription>{filteredEntries.length.toLocaleString()} matches</CardDescription>
                <div className='relative pt-2'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 text-muted-foreground' />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder='Search slug, label, character, weapon...'
                    className='pl-9'
                  />
                </div>
              </CardHeader>
              <CardContent className='p-3'>
                <ScrollArea className='h-[calc(100dvh-22rem)] min-h-[420px] pr-2'>
                  <div className='space-y-2'>
                    {filteredEntries.map((entry) => (
                      <EntryListItem
                        key={entry.id}
                        entry={entry}
                        selected={selectedEntry?.id === entry.id}
                        onSelect={() => setSelectedId(entry.id)}
                      />
                    ))}
                    {filteredEntries.length === 0 && (
                      <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                        No fixed party presets matched that search.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {selectedEntry ? (
              <div className='space-y-5'>
                <Card className='rounded-md border-border/70 bg-card/85 shadow-none'>
                  <CardContent className='p-5 md:p-6'>
                    <div className='flex flex-wrap items-start justify-between gap-4'>
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge variant='outline' className='rounded-md'>
                            preset {selectedEntry.id}
                          </Badge>
                          <Badge variant='secondary' className='rounded-md'>
                            {selectedEntry.label}
                          </Badge>
                        </div>
                        <h2 className='mt-3 text-3xl font-semibold tracking-tight'>{selectedEntry.slug}</h2>
                        <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                          Tap any character, weapon, or soul card to inspect it without leaving the preset.
                        </p>
                      </div>

                      <div className='flex flex-wrap gap-2'>
                        <Badge variant='outline' className='rounded-md'>
                          {selectedEntry.activeUnitCount} units
                        </Badge>
                        <Badge variant='outline' className='rounded-md'>
                          {selectedEntry.equipmentCount} weapons
                        </Badge>
                        <Badge variant='outline' className='rounded-md'>
                          {selectedEntry.soulCount} souls
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className='grid gap-4 xl:grid-cols-3'>
                  {selectedEntry.slots.map((slot) => (
                    <SlotPreview
                      key={slot.index}
                      entry={selectedEntry}
                      slot={slot}
                      onCharacterSelect={openCharacterDetail}
                      onItemSelect={openItemDetail}
                    />
                  ))}
                </div>

                <Card className='rounded-md border-border/70 bg-card/85 shadow-none'>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Raw Progress Checks</CardTitle>
                    <CardDescription>Sanity view for levels, tiers, and mana board fill.</CardDescription>
                  </CardHeader>
                  <CardContent className='grid gap-3 md:grid-cols-3'>
                    {selectedEntry.slots.map((slot) => (
                      <div key={`meta-${slot.index}`} className={cn(INNER, 'p-3')}>
                        <p className='text-xs font-medium uppercase tracking-normal text-muted-foreground'>Slot {slot.index + 1}</p>
                        <div className='mt-2 space-y-2 text-sm'>
                          <div>
                            <p className='font-medium'>Main</p>
                            <p className='text-muted-foreground'>
                              {slot.main
                                ? buildMetaLine([
                                    displayCharacterName(slot.main.character, slot.main.characterId),
                                    `Lv ${slot.main.level}`,
                                    `Tier ${slot.main.uncapTier}`,
                                    `${slot.main.manaNodeCount} nodes`,
                                  ])
                                : 'Empty'}
                            </p>
                          </div>
                          <div>
                            <p className='font-medium'>Unison</p>
                            <p className='text-muted-foreground'>
                              {slot.unison
                                ? buildMetaLine([
                                    displayCharacterName(slot.unison.character, slot.unison.characterId),
                                    `Lv ${slot.unison.level}`,
                                    `Tier ${slot.unison.uncapTier}`,
                                    `${slot.unison.manaNodeCount} nodes`,
                                  ])
                                : 'Empty'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </section>
        </main>
      </div>

      <Dialog
        open={Boolean(detailTarget)}
        onOpenChange={(open) => {
          if (open) return;
          setDetailTarget(null);
          setDetailError(null);
          setDetailLoading(false);
        }}
      >
        <DialogContent className='max-h-[90vh] max-w-6xl overflow-hidden border-border/70 p-0'>
          <DialogHeader className='border-b border-border/70 px-6 py-4'>
            <DialogTitle>
              {detailTarget?.kind === 'character' ? characterName || 'Character Detail' : itemName || 'Item Detail'}
            </DialogTitle>
            <DialogDescription>
              {detailTarget?.kind === 'character'
                ? 'Character info, preset usage, and linked party connections.'
                : 'Item detail, data-list references, and related preset connections.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className='max-h-[calc(90vh-5.5rem)]'>
            <div className='space-y-5 p-6'>
              {detailLoading ? (
                <div className='flex min-h-[320px] items-center justify-center rounded-md border border-dashed border-border/70 bg-background/40'>
                  <div className='flex items-center gap-3 text-sm text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Loading detail data...
                  </div>
                </div>
              ) : detailError ? (
                <div className='rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive'>
                  {detailError}
                </div>
              ) : detailTarget?.kind === 'character' ? (
                <div className='space-y-5'>
                  <div className='grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]'>
                    <AssetPreview
                      urls={buildCharacterGalleryUrls(detailTarget.faceCode, activeCharacterDetail)}
                      alt={characterName || detailTarget.faceCode}
                      className='min-h-[340px]'
                      imageClassName='object-contain p-5'
                    />

                    <div className='space-y-4'>
                      <div className='flex flex-wrap items-center gap-2'>
                        {activeCharacterDetail?.character.attribute && (
                          <Badge variant='outline' className={cn('rounded-md', getAttributeAccent(activeCharacterDetail.character.attribute).badge)}>
                            {activeCharacterDetail.character.attribute}
                          </Badge>
                        )}
                        {activeCharacterDetail?.character.weaponType && (
                          <Badge variant='outline' className='rounded-md'>
                            {activeCharacterDetail.character.weaponType}
                          </Badge>
                        )}
                        {activeCharacterDetail?.character.stance && (
                          <Badge variant='outline' className='rounded-md'>
                            {activeCharacterDetail.character.stance}
                          </Badge>
                        )}
                        {activeCharacterDetail?.character.rarity ? (
                          <Badge variant='outline' className='rounded-md'>
                            {activeCharacterDetail.character.rarity}-star
                          </Badge>
                        ) : null}
                      </div>

                      <div>
                        {characterTitle ? <p className='text-sm text-muted-foreground'>{characterTitle}</p> : null}
                        <p className='mt-1 text-3xl font-semibold tracking-tight'>{characterName}</p>
                        <p className='mt-2 text-sm text-muted-foreground'>
                          {activeCharacterDetail?.character.descriptionEN ||
                            activeCharacterDetail?.character.descriptionJP ||
                            'No character description was found.'}
                        </p>
                      </div>

                      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                        <KeyMetric label='Max HP' value={formatMaybeNumber(activeCharacterDetail?.character.maxHP)} />
                        <KeyMetric label='Max ATK' value={formatMaybeNumber(activeCharacterDetail?.character.maxATK)} />
                        <KeyMetric label='Skill Wait' value={activeCharacterDetail?.character.skillWait || '-'} />
                        <KeyMetric label='Hit Count' value={activeCharacterDetail?.character.hitCount || '-'} subtle />
                        <KeyMetric label='Fever Gain' value={activeCharacterDetail?.character.feverGain || '-'} subtle />
                        <KeyMetric label='Mana Board 2' value={activeCharacterDetail?.character.manaBoard2 ? 'Yes' : 'No'} subtle />
                      </div>

                      <div className='grid gap-3 xl:grid-cols-2'>
                        <div className={cn(INNER, 'p-3')}>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Skill</p>
                          <p className='mt-1 font-medium'>
                            {activeCharacterDetail?.character.skillNameEN || activeCharacterDetail?.character.skillNameJP || 'Unnamed skill'}
                          </p>
                          <p className='mt-2 whitespace-pre-wrap text-sm text-muted-foreground'>
                            {activeCharacterDetail?.character.skill || 'No skill text found.'}
                          </p>
                        </div>
                        <div className={cn(INNER, 'p-3')}>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Leader Ability</p>
                          <p className='mt-1 font-medium'>
                            {activeCharacterDetail?.character.leaderAbilityNameEN ||
                              activeCharacterDetail?.character.leaderAbilityNameJP ||
                              'Unnamed leader ability'}
                          </p>
                          <p className='mt-2 whitespace-pre-wrap text-sm text-muted-foreground'>
                            {activeCharacterDetail?.character.leaderBuff || 'No leader ability text found.'}
                          </p>
                        </div>
                      </div>

                      <div className='grid gap-3 xl:grid-cols-2'>
                        <div className={cn(INNER, 'p-3')}>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Voice Actor</p>
                          <p className='mt-1 text-sm font-medium'>{activeCharacterDetail?.character.voiceActor || 'Unknown'}</p>
                          {activeCharacterDetail?.character.obtain ? (
                            <>
                              <p className='mt-3 text-xs uppercase tracking-wide text-muted-foreground'>Obtain</p>
                              <p className='mt-1 text-sm text-muted-foreground'>{activeCharacterDetail.character.obtain}</p>
                            </>
                          ) : null}
                        </div>
                        <div className={cn(INNER, 'p-3')}>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Extra Links</p>
                          <div className='mt-2 flex flex-wrap gap-2'>
                            <Button asChild size='sm' variant='outline' className='rounded-md'>
                              <Link href={`/charactersv2/${encodeURIComponent(detailTarget.faceCode)}`}>Open full page</Link>
                            </Button>
                            {activeCharacterDetail?.character.voiceActor ? (
                              <Button asChild size='sm' variant='outline' className='rounded-md'>
                                <Link href={`/voicedb?q=${encodeURIComponent(activeCharacterDetail.character.voiceActor)}`}>Search VoiceDB</Link>
                              </Button>
                            ) : null}
                          </div>
                          {detailTarget.context ? (
                            <p className='mt-3 text-xs text-muted-foreground'>
                              Opened from {detailTarget.context.presetSlug} slot {detailTarget.context.slotIndex + 1} as{' '}
                              {detailTarget.context.role}, level {detailTarget.context.level}, tier {detailTarget.context.uncapTier}.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
                    <Card className='rounded-md border-border/70 bg-card/75 shadow-none'>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Fixed Party Connections</CardTitle>
                        <CardDescription>Who they pair with, what they carry, and where else they show up.</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <div className='grid gap-3 md:grid-cols-3'>
                          <KeyMetric label='Preset Appearances' value={characterConnections?.presetIds.length || 0} />
                          <KeyMetric label='Main Uses' value={characterConnections?.mainCount || 0} subtle />
                          <KeyMetric label='Unison Uses' value={characterConnections?.unisonCount || 0} subtle />
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Frequent Partners</p>
                          <div className='flex flex-wrap gap-2'>
                            {characterConnections?.pairings.slice(0, 10).map((partner) => (
                              <DetailChip
                                key={partner.faceCode}
                                label={partner.label}
                                count={partner.count}
                                onClick={() =>
                                  setDetailTarget({
                                    kind: 'character',
                                    faceCode: partner.faceCode,
                                    summary: characterSummaryByFaceCode[partner.faceCode] || null,
                                  })
                                }
                              />
                            ))}
                            {!characterConnections?.pairings.length ? (
                              <span className='text-sm text-muted-foreground'>No partner data found.</span>
                            ) : null}
                          </div>
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Shared Weapons</p>
                          <div className='flex flex-wrap gap-2'>
                            {characterConnections?.weapons.slice(0, 8).map((weapon) => (
                              <DetailChip
                                key={weapon.key}
                                label={weapon.label}
                                count={weapon.count}
                                onClick={() =>
                                  setDetailTarget({
                                    kind: 'item',
                                    id: weapon.id,
                                    itemType: weapon.type,
                                    label: 'Weapon',
                                    summary: itemSummaryByKey[weapon.key] || null,
                                  })
                                }
                              />
                            ))}
                            {!characterConnections?.weapons.length ? (
                              <span className='text-sm text-muted-foreground'>No linked weapons found.</span>
                            ) : null}
                          </div>
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Shared Souls</p>
                          <div className='flex flex-wrap gap-2'>
                            {characterConnections?.souls.slice(0, 8).map((soul) => (
                              <DetailChip
                                key={soul.key}
                                label={soul.label}
                                count={soul.count}
                                onClick={() =>
                                  setDetailTarget({
                                    kind: 'item',
                                    id: soul.id,
                                    itemType: soul.type,
                                    label: 'Soul',
                                    summary: itemSummaryByKey[soul.key] || null,
                                  })
                                }
                              />
                            ))}
                            {!characterConnections?.souls.length ? (
                              <span className='text-sm text-muted-foreground'>No linked souls found.</span>
                            ) : null}
                          </div>
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Appears In Presets</p>
                          <div className='flex flex-wrap gap-2'>
                            {characterConnections?.presetIds.slice(0, 12).map((presetId) => (
                              <DetailChip
                                key={presetId}
                                label={entryById[presetId]?.slug || `Preset ${presetId}`}
                                onClick={() => jumpToPreset(presetId)}
                              />
                            ))}
                            {!characterConnections?.presetIds.length ? (
                              <span className='text-sm text-muted-foreground'>No preset links found.</span>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className='rounded-md border-border/70 bg-card/75 shadow-none'>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Other Data Hooks</CardTitle>
                        <CardDescription>Theme tracks, sample lines, and profile metadata already tied to this face code.</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        {activeCharacterDetail?.themes?.length ? (
                          <div className='space-y-2'>
                            <p className='text-xs uppercase tracking-wide text-muted-foreground'>Theme Tracks</p>
                            <div className='flex flex-wrap gap-2'>
                              {activeCharacterDetail.themes.slice(0, 6).map((theme) => (
                                <Button key={theme.path} asChild size='sm' variant='outline' className='rounded-md'>
                                  <a href={theme.url} target='_blank' rel='noreferrer'>
                                    <Music2 className='mr-1 h-3 w-3' />
                                    {theme.songName}
                                  </a>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {activeCharacterDetail?.speechLines.length ? (
                          <div className={cn(INNER, 'p-3')}>
                            <p className='text-xs uppercase tracking-wide text-muted-foreground'>Sample Speech</p>
                            <p className='mt-2 text-sm'>
                              {activeCharacterDetail.speechLines[0]?.text || activeCharacterDetail.speechLines[0]?.cue || 'No speech text found.'}
                            </p>
                            <p className='mt-2 text-xs text-muted-foreground'>
                              {activeCharacterDetail.speechLines.length} speech lines indexed
                            </p>
                          </div>
                        ) : null}

                        {activeCharacterDetail?.character.abilities.length ? (
                          <div className='space-y-2'>
                            <p className='text-xs uppercase tracking-wide text-muted-foreground'>Ability Tokens</p>
                            <div className='flex flex-wrap gap-2'>
                              {activeCharacterDetail.character.abilities.slice(0, 6).map((ability) => (
                                <DetailChip key={ability} label={toDisplayToken(ability)} />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className='grid gap-3 sm:grid-cols-2'>
                          <KeyMetric label='Alt Names' value={activeCharacterDetail?.character.otherCommonNames || '-'} subtle />
                          <KeyMetric label='Songs Listed' value={activeCharacterDetail?.character.songs.length || 0} subtle />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : detailTarget?.kind === 'item' ? (
                <div className='space-y-5'>
                  <div className='grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]'>
                    <AssetPreview
                      urls={activeItemDetail?.imageCandidates || buildItemThumbUrls(detailTarget.summary)}
                      alt={itemName}
                      className='min-h-[280px]'
                      imageClassName='object-contain p-6'
                      pixelated={detailTarget.label === 'Weapon'}
                    />

                    <div className='space-y-4'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant='outline' className='rounded-md'>
                          {detailTarget.label}
                        </Badge>
                        <Badge variant='outline' className='rounded-md'>
                          {activeItemDetail?.entry.category || detailTarget.summary?.category || 'Unknown'}
                        </Badge>
                        {activeItemDetail?.hasEnhancementData ? (
                          <Badge variant='outline' className='rounded-md'>
                            Enhancement data
                          </Badge>
                        ) : null}
                      </div>

                      <div>
                        <p className='text-3xl font-semibold tracking-tight'>{itemName}</p>
                        <p className='mt-2 text-sm text-muted-foreground'>
                          {activeItemDetail?.entry.description || activeItemDetail?.entry.flavorText || 'No description was found.'}
                        </p>
                      </div>

                      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                        <KeyMetric label='ID' value={detailTarget.id} />
                        <KeyMetric label='Type' value={activeItemDetail?.entry.type || detailTarget.itemType} subtle />
                        <KeyMetric label='Rarity' value={activeItemDetail?.entry.rarity || '-'} subtle />
                        <KeyMetric label='Enhance IDs' value={activeItemDetail?.enhancementOptions.length || 0} subtle />
                        <KeyMetric label='Weapon Uses' value={itemConnections?.weaponCount || 0} subtle />
                        <KeyMetric label='Soul Uses' value={itemConnections?.soulCount || 0} subtle />
                      </div>

                      <div className='grid gap-3 xl:grid-cols-2'>
                        <div className={cn(INNER, 'p-3')}>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Catalog Paths</p>
                          <p className='mt-2 break-all text-xs text-muted-foreground'>{activeItemDetail?.entry.icon || detailTarget.summary?.icon || '(none)'}</p>
                          <p className='mt-2 break-all text-xs text-muted-foreground'>
                            {activeItemDetail?.entry.thumbnail || detailTarget.summary?.thumbnail || '(no thumbnail path)'}
                          </p>
                        </div>
                        <div className={cn(INNER, 'p-3')}>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Current Preset Context</p>
                          <p className='mt-2 text-sm text-muted-foreground'>
                            {detailTarget.context
                              ? `${detailTarget.context.presetSlug} slot ${detailTarget.context.slotIndex + 1}${detailTarget.context.tier ? ` | Tier ${detailTarget.context.tier}` : ''}`
                              : 'Opened from a related connection.'}
                          </p>
                          <div className='mt-3 flex flex-wrap gap-2'>
                            <Button
                              asChild
                              size='sm'
                              variant='outline'
                              className='rounded-md'
                            >
                              <Link href={`/${detailTarget.itemType === 'equipment' ? 'equip' : 'item'}/${encodeURIComponent(detailTarget.id)}`}>
                                Open full page
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {activeItemDetail?.entry.type === 'equipment' ? (
                    <Card className='rounded-md border-border/70 bg-card/75 shadow-none'>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Equipment Metadata</CardTitle>
                        <CardDescription>Resolved stats, enhancement metadata, and linked ability tokens.</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-5'>
                          <KeyMetric label='Catalog Max HP' value={formatMaybeNumber(activeItemDetail.equipmentCatalogEntry?.maxHp)} />
                          <KeyMetric label='Catalog Max ATK' value={formatMaybeNumber(activeItemDetail.equipmentCatalogEntry?.maxAtk)} />
                          <KeyMetric label='Sheet Attribute' value={activeItemDetail.equipmentSheetEntry?.attribute || '-'} subtle />
                          <KeyMetric label='Sheet Obtain' value={activeItemDetail.equipmentSheetEntry?.obtain || '-'} subtle />
                          <KeyMetric label='Growth Points' value={activeItemDetail.equipmentStats.length} subtle />
                        </div>

                        {activeItemDetail.equipmentStats.length ? (
                          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                            <KeyMetric label='Level 1' value={`HP ${formatMaybeNumber(activeItemDetail.equipmentStats[0]?.hp)} | ATK ${formatMaybeNumber(activeItemDetail.equipmentStats[0]?.atk)}`} subtle />
                            <KeyMetric label='Max Level' value={activeItemDetail.equipmentStats[activeItemDetail.equipmentStats.length - 1]?.level || '-'} subtle />
                            <KeyMetric
                              label='Max Stats'
                              value={`HP ${formatMaybeNumber(activeItemDetail.equipmentStats[activeItemDetail.equipmentStats.length - 1]?.hp)} | ATK ${formatMaybeNumber(activeItemDetail.equipmentStats[activeItemDetail.equipmentStats.length - 1]?.atk)}`}
                              subtle
                            />
                          </div>
                        ) : null}

                        {activeItemDetail.equipmentAbilityProfile ? (
                          <div className={cn(INNER, 'p-3')}>
                            <p className='text-xs uppercase tracking-wide text-muted-foreground'>Ability Profile</p>
                            <div className='mt-2 flex flex-wrap gap-2'>
                              <DetailChip label={toDisplayToken(activeItemDetail.equipmentAbilityProfile.effectToken)} />
                              {activeItemDetail.equipmentAbilityProfile.effectVariantToken ? (
                                <DetailChip label={toDisplayToken(activeItemDetail.equipmentAbilityProfile.effectVariantToken)} />
                              ) : null}
                              {activeItemDetail.equipmentAbilityProfile.element ? (
                                <DetailChip label={activeItemDetail.equipmentAbilityProfile.element} />
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {activeItemDetail.equipmentAbilities.length ? (
                          <div className='space-y-2'>
                            <p className='text-xs uppercase tracking-wide text-muted-foreground'>Ability Links</p>
                            <div className='flex flex-wrap gap-2'>
                              {activeItemDetail.equipmentAbilities.slice(0, 8).map((ability) => (
                                <DetailChip
                                  key={`${ability.abilityId}-${ability.internalKey}`}
                                  label={toDisplayToken(ability.effectToken || ability.internalKey || ability.abilityId)}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className='grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'>
                    <Card className='rounded-md border-border/70 bg-card/75 shadow-none'>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Fixed Party Connections</CardTitle>
                        <CardDescription>Who carries this and which presets it links together.</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Seen With Characters</p>
                          <div className='flex flex-wrap gap-2'>
                            {itemConnections?.companions.slice(0, 12).map((character) => (
                              <DetailChip
                                key={character.faceCode}
                                label={character.label}
                                count={character.count}
                                onClick={() =>
                                  setDetailTarget({
                                    kind: 'character',
                                    faceCode: character.faceCode,
                                    summary: characterSummaryByFaceCode[character.faceCode] || null,
                                  })
                                }
                              />
                            ))}
                            {!itemConnections?.companions.length ? (
                              <span className='text-sm text-muted-foreground'>No character connections found.</span>
                            ) : null}
                          </div>
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>Appears In Presets</p>
                          <div className='flex flex-wrap gap-2'>
                            {itemConnections?.presetIds.slice(0, 12).map((presetId) => (
                              <DetailChip
                                key={presetId}
                                label={entryById[presetId]?.slug || `Preset ${presetId}`}
                                onClick={() => jumpToPreset(presetId)}
                              />
                            ))}
                            {!itemConnections?.presetIds.length ? (
                              <span className='text-sm text-muted-foreground'>No preset links found.</span>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className='rounded-md border-border/70 bg-card/75 shadow-none'>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Data List References</CardTitle>
                        <CardDescription>Other files that point at this ID, grouped by how they use it.</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        {(Object.keys(RELATION_GROUP_META) as Array<ItemRelationReference['group']>).map((group) => {
                          const meta = RELATION_GROUP_META[group];
                          const entriesInGroup = activeItemDetail?.relationReferences.filter((entry) => entry.group === group) || [];
                          const Icon = meta.icon;

                          if (!entriesInGroup.length) return null;

                          return (
                            <div key={group} className={cn(INNER, 'p-3')}>
                              <div className='flex items-center gap-2'>
                                <Icon className='h-4 w-4 text-muted-foreground' />
                                <p className='text-sm font-medium'>{meta.title}</p>
                              </div>
                              <div className='mt-3 space-y-2'>
                                {entriesInGroup.slice(0, 6).map((reference, index) => (
                                  <div key={`${reference.sourcePath}-${reference.matchPath}-${index}`} className='rounded-md border border-border/60 bg-background/60 p-2.5'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                      <Badge variant='outline' className='rounded-md'>
                                        {reference.sourceLabel}
                                      </Badge>
                                      <Button asChild size='sm' variant='ghost' className='h-6 rounded-md px-2 text-xs'>
                                        <Link href={toShareDataPathHref(reference.sourcePath)}>Open data</Link>
                                      </Button>
                                    </div>
                                    <p className='mt-2 text-sm'>{reference.summary}</p>
                                    <p className='mt-1 text-xs text-muted-foreground'>{reference.matchPath}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                        {!activeItemDetail?.relationReferences.length ? (
                          <div className='rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground'>
                            No additional data-list references were found for this ID.
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
