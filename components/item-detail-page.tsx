import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Link2, Package, Sparkles, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GoBackButton from '@/components/go-back-button';
import ItemSaveLinkEditor from '@/components/item-save-link-editor';
import type { ItemDetailData } from '@/lib/item-catalog';

type DetailRouteKind = 'item' | 'equipment';

type ItemDetailPageProps = {
  routeKind: DetailRouteKind;
  detail: ItemDetailData;
};

const GROUP_META: Record<
  'drops' | 'shops' | 'usage' | 'enhancement' | 'references',
  { title: string; description: string }
> = {
  drops: {
    title: 'Drop / Reward References',
    description: 'Tables where this ID appears as a reward output.',
  },
  shops: {
    title: 'Shop / Exchange References',
    description: 'Shop entries and exchange lists that include this ID.',
  },
  usage: {
    title: 'Usage References',
    description: 'Data entries where this ID appears as a cost or requirement.',
  },
  enhancement: {
    title: 'Enhancement Metadata',
    description: 'Enhancement tables associated with this equipment.',
  },
  references: {
    title: 'Additional References',
    description: 'Other data-list references to this ID.',
  },
};

const RARITY_ICON_MAP: Record<number, string> = {
  1: '/FilterIcons/rarity/rarity_one.png',
  2: '/FilterIcons/rarity/rarity_two.png',
  3: '/FilterIcons/rarity/rarity_three.png',
  4: '/FilterIcons/rarity/rarity_four.png',
  5: '/FilterIcons/rarity/rarity_five.png',
};

const clampRarity = (value: number) => Math.max(1, Math.min(5, Number.isFinite(value) ? Math.round(value) : 1));

const toShareDataPathHref = (path: string) => {
  const normalized = path.replace(/^\/+/, '');
  return `/share/${normalized}`;
};

const formatMaybeNumber = (value: number | null): string => {
  if (value === null) return '-';
  return new Intl.NumberFormat('en-US').format(value);
};

const toDisplayToken = (token: string): string => {
  const normalized = token.trim();
  if (!normalized) return '';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const toEnhancementLabel = (level: number): string => {
  const stage = level - 1;
  if (stage >= 0 && stage <= 4) return `${stage}/4`;
  return `Lv ${level}`;
};

export default function ItemDetailPage({ routeKind, detail }: ItemDetailPageProps) {
  const rarity = clampRarity(detail.entry.rarity);
  const iconUrl = detail.imageCandidates[0] || '';
  const isEquipmentRoute = routeKind === 'equipment';
  const equipmentCatalogEntry = detail.equipmentCatalogEntry;
  const hasEquipmentMetadata =
    equipmentCatalogEntry !== null ||
    detail.equipmentStats.length > 0 ||
    detail.equipmentAbilityProfile !== null ||
    detail.equipmentAbilities.length > 0;
  const groupedReferences = {
    drops: detail.relationReferences.filter((entry) => entry.group === 'drops'),
    shops: detail.relationReferences.filter((entry) => entry.group === 'shops'),
    usage: detail.relationReferences.filter((entry) => entry.group === 'usage'),
    enhancement: detail.relationReferences.filter((entry) => entry.group === 'enhancement'),
    references: detail.relationReferences.filter((entry) => entry.group === 'references'),
  };

  const hasAnyReferences = Object.values(groupedReferences).some((entries) => entries.length > 0);
  const routeLabel = routeKind === 'equipment' ? 'Equipment' : 'Item';
  const routeIcon = routeKind === 'equipment' ? <Wrench className='h-4 w-4' /> : <Package className='h-4 w-4' />;

  return (
    <div className='min-h-screen bg-gradient-to-b from-background via-background to-muted/20'>
      <div className='mx-auto w-full max-w-7xl space-y-4 p-4 md:space-y-6 md:p-6'>
        <div className='flex flex-wrap items-center gap-2'>
          <GoBackButton fallbackHref='/items' />
          <Button asChild variant='outline' size='sm'>
            <Link href='/items'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back To Items
            </Link>
          </Button>
          <Badge variant='secondary' className='inline-flex h-8 items-center gap-2 px-3'>
            {routeIcon}
            {routeLabel}
          </Badge>
          <Badge variant='outline'>ID {detail.entry.id}</Badge>
          <Badge variant='outline'>{detail.entry.category}</Badge>
        </div>

        <Card className='border-border/70 bg-card/80'>
          <CardContent className='grid gap-4 p-4 md:grid-cols-[120px,minmax(0,1fr)] md:gap-6 md:p-6'>
            <div className='space-y-3'>
              <div className='relative mx-auto h-24 w-24 overflow-hidden rounded-md border border-border/70 bg-background/40 md:mx-0'>
                {iconUrl ? (
                  <Image
                    src={iconUrl}
                    alt={detail.entry.name}
                    fill
                    className='object-contain p-1 [image-rendering:pixelated]'
                    unoptimized
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center text-xs text-muted-foreground'>No image found</div>
                )}
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                <Image
                  src={RARITY_ICON_MAP[rarity]}
                  alt={`${rarity}-star rarity`}
                  width={108}
                  height={24}
                  className='h-[18px] w-auto [image-rendering:pixelated]'
                  unoptimized
                />
                {detail.hasEnhancementData && (
                  <Badge className='inline-flex items-center gap-1'>
                    <Sparkles className='h-3 w-3' />
                    Has Enhancement Data
                  </Badge>
                )}
              </div>

              {detail.enhancementOptions.length > 0 && (
                <div className='rounded-md border border-border/70 bg-muted/20 p-2.5'>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>Enhancement Status IDs</p>
                  <div className='mt-2 flex flex-wrap gap-1.5'>
                    {detail.enhancementOptions.map((option) => (
                      <Badge key={option} variant='secondary'>
                        {option}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className='space-y-4'>
              <div>
                <h1 className='text-2xl font-bold md:text-3xl'>{detail.entry.name}</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Devname: <span className='font-mono text-foreground'>{detail.entry.devname || '(none)'}</span>
                </p>
              </div>

              <div className='rounded-md border border-border/70 bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Description</p>
                <p className='mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90'>
                  {detail.entry.description || 'No description available.'}
                </p>
                {detail.entry.flavorText && (
                  <>
                    <p className='mt-3 text-xs uppercase tracking-wide text-muted-foreground'>Flavor Text</p>
                    <p className='mt-1 whitespace-pre-wrap text-sm italic text-muted-foreground'>{detail.entry.flavorText}</p>
                  </>
                )}
              </div>

              <div className='grid gap-3 text-xs md:grid-cols-2'>
                <div className='rounded-md border border-border/70 bg-card/70 p-2.5'>
                  <p className='uppercase tracking-wide text-muted-foreground'>Icon Path</p>
                  <p className='mt-1 break-all font-mono'>{detail.entry.icon || '(none)'}</p>
                </div>
                <div className='rounded-md border border-border/70 bg-card/70 p-2.5'>
                  <p className='uppercase tracking-wide text-muted-foreground'>Thumbnail Path</p>
                  <p className='mt-1 break-all font-mono'>{detail.entry.thumbnail || '(none)'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ItemSaveLinkEditor
          mode={routeKind === 'equipment' ? 'equipment' : 'item'}
          entityId={detail.entry.id}
          enhancementOptions={detail.enhancementOptions}
        />

        {isEquipmentRoute && (
          <Card className='border-border/70 bg-card/80'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Wrench className='h-4 w-4' />
                Stats & Abilities
              </CardTitle>
              <CardDescription>Equipment growth and ability metadata resolved from `datalist_en`.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {!hasEquipmentMetadata && (
                <div className='rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground'>
                  No equipment stats or ability metadata were found for this equipment ID.
                </div>
              )}

              {equipmentCatalogEntry && (
                <div className='rounded-md border border-border/70 bg-muted/20 p-3'>
                  <p className='text-sm font-semibold'>Equip Master Data</p>
                  <p className='text-xs text-muted-foreground'>Loaded from `public/data/equips.json` by devname match.</p>
                  <div className='mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4'>
                    <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                      <p className='uppercase tracking-wide text-muted-foreground'>Type</p>
                      <p className='mt-1 font-medium'>{equipmentCatalogEntry.categoryHint}</p>
                    </div>
                    <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                      <p className='uppercase tracking-wide text-muted-foreground'>Max HP</p>
                      <p className='mt-1 font-medium'>{formatMaybeNumber(equipmentCatalogEntry.maxHp)}</p>
                    </div>
                    <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                      <p className='uppercase tracking-wide text-muted-foreground'>Max ATK</p>
                      <p className='mt-1 font-medium'>{formatMaybeNumber(equipmentCatalogEntry.maxAtk)}</p>
                    </div>
                    <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                      <p className='uppercase tracking-wide text-muted-foreground'>Rarity (Source)</p>
                      <p className='mt-1 font-medium'>{formatMaybeNumber(equipmentCatalogEntry.rarity)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className='grid gap-4 xl:grid-cols-2'>
                <div className='rounded-md border border-border/70 bg-muted/20 p-3'>
                  <p className='text-sm font-semibold'>Stat Growth</p>
                  <p className='text-xs text-muted-foreground'>Enhancement stage with HP and ATK values.</p>

                  {detail.equipmentStats.length === 0 ? (
                    <p className='mt-2 text-xs text-muted-foreground'>No stat entries found.</p>
                  ) : (
                    <div className='mt-2 overflow-x-auto'>
                      <table className='w-full text-left text-xs'>
                        <thead className='text-muted-foreground'>
                          <tr>
                            <th className='py-1 pr-3 font-medium'>Stage</th>
                            <th className='py-1 pr-3 font-medium'>HP</th>
                            <th className='py-1 font-medium'>ATK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.equipmentStats.map((point) => (
                            <tr key={point.level} className='border-t border-border/50'>
                              <td className='py-1.5 pr-3 font-medium text-foreground'>{toEnhancementLabel(point.level)}</td>
                              <td className='py-1.5 pr-3 text-foreground/90'>{formatMaybeNumber(point.hp)}</td>
                              <td className='py-1.5 text-foreground/90'>{formatMaybeNumber(point.atk)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className='rounded-md border border-border/70 bg-muted/20 p-3'>
                  <p className='text-sm font-semibold'>Ability Profile</p>
                  <p className='text-xs text-muted-foreground'>Primary parsed ability metadata from `ability_soul`.</p>

                  {detail.equipmentAbilityProfile ? (
                    <div className='mt-2 grid gap-2 text-xs md:grid-cols-2'>
                      <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                        <p className='uppercase tracking-wide text-muted-foreground'>Effect</p>
                        <p className='mt-1 font-medium'>{toDisplayToken(detail.equipmentAbilityProfile.effectToken) || '-'}</p>
                      </div>
                      <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                        <p className='uppercase tracking-wide text-muted-foreground'>Effect Variant</p>
                        <p className='mt-1 font-medium'>
                          {toDisplayToken(detail.equipmentAbilityProfile.effectVariantToken) || '-'}
                        </p>
                      </div>
                      <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                        <p className='uppercase tracking-wide text-muted-foreground'>Element</p>
                        <p className='mt-1 font-medium'>{detail.equipmentAbilityProfile.element || '-'}</p>
                      </div>
                      <div className='rounded-md border border-border/60 bg-card/70 p-2'>
                        <p className='uppercase tracking-wide text-muted-foreground'>Value Range</p>
                        <p className='mt-1 font-medium'>
                          {formatMaybeNumber(detail.equipmentAbilityProfile.valueMin)} -{' '}
                          {formatMaybeNumber(detail.equipmentAbilityProfile.valueMax)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className='mt-2 text-xs text-muted-foreground'>No ability profile found.</p>
                  )}
                </div>
              </div>

              <div className='rounded-md border border-border/70 bg-muted/20 p-3'>
                <p className='text-sm font-semibold'>Resolved Abilities</p>
                <p className='text-xs text-muted-foreground'>Linked ability records found in `ability.json`.</p>

                {detail.equipmentAbilities.length === 0 ? (
                  <p className='mt-2 text-xs text-muted-foreground'>No linked abilities were resolved.</p>
                ) : (
                  <div className='mt-2 grid gap-2 md:grid-cols-2'>
                    {detail.equipmentAbilities.map((ability) => (
                      <div
                        key={ability.abilityId}
                        className='rounded-md border border-border/60 bg-card/70 p-2.5 text-xs'
                      >
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <Badge variant='outline'>Ability {ability.abilityId}</Badge>
                          {ability.element && <Badge variant='secondary'>{ability.element}</Badge>}
                        </div>
                        <p className='mt-1 font-medium'>{toDisplayToken(ability.effectToken) || '(no effect token)'}</p>
                        <p className='mt-0.5 break-all font-mono text-[11px] text-muted-foreground'>
                          key: {ability.internalKey || '(none)'}
                        </p>
                        <p className='mt-1 text-muted-foreground'>
                          value: {formatMaybeNumber(ability.valueMin)} - {formatMaybeNumber(ability.valueMax)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className='border-border/70 bg-card/80'>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Link2 className='h-4 w-4' />
              Data Correlation
            </CardTitle>
            <CardDescription>
              Best-effort references from `datalist_en` for drop/use/source context of this ID.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!hasAnyReferences && (
              <div className='rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground'>
                No references found in the indexed relation sources.
              </div>
            )}

            {(Object.keys(groupedReferences) as Array<keyof typeof groupedReferences>).map((groupKey) => {
              const entries = groupedReferences[groupKey];
              if (entries.length === 0) return null;

              return (
                <div key={groupKey} className='space-y-2 rounded-md border border-border/70 bg-muted/20 p-3'>
                  <div className='space-y-1'>
                    <p className='text-sm font-semibold'>{GROUP_META[groupKey].title}</p>
                    <p className='text-xs text-muted-foreground'>{GROUP_META[groupKey].description}</p>
                  </div>

                  <div className='space-y-2'>
                    {entries.map((reference, index) => (
                      <div key={`${groupKey}-${reference.sourcePath}-${reference.entryId}-${index}`} className='rounded-md border border-border/70 bg-card/70 p-2.5'>
                        <div className='flex flex-wrap items-center gap-2 text-xs'>
                          <Badge variant='outline'>{reference.sourceLabel}</Badge>
                          <Badge variant='secondary'>Entry {reference.entryId}</Badge>
                        </div>
                        <p className='mt-1.5 text-xs text-muted-foreground'>{reference.summary}</p>
                        <p className='mt-1 font-mono text-[11px] text-muted-foreground'>path: {reference.matchPath || '(root)'}</p>
                        <Button asChild variant='ghost' size='sm' className='mt-1 h-7 px-2 text-xs'>
                          <Link href={toShareDataPathHref(reference.sourcePath)}>
                            View Source
                            <ExternalLink className='ml-1.5 h-3 w-3' />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
