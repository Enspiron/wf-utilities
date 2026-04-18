'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type TeamDetail = {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  publish_status: string;
  visibility: string;
  boss_label: string | null;
  content_targets?: { label?: string } | null;
  tags?: string[];
  team_builds?: {
    main_unit_ids: number[];
    unison_unit_ids: number[];
    equipment_ids: number[];
    soul_ids: number[];
    slot_meta?: Record<string, unknown>;
  } | null;
  raw_snapshot?: Record<string, unknown>;
  moderationEvents?: Array<{ action: string; note: string | null; created_at: string }>;
};

type CharacterCatalogRow = {
  id: string;
  faceCode: string;
  nameEN?: string;
  nameJP?: string;
};

type ItemCatalogRow = {
  id: string;
  type: 'item' | 'equipment';
  name: string;
  icon: string;
  thumbnail?: string;
};

type CharacterLookup = Record<string, CharacterCatalogRow>;
type ItemLookup = Record<string, ItemCatalogRow>;

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const hasImageExtension = (value: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(value);

const toCdnAssetUrl = (value: string): string => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const normalized = value.replace(/^\/+/, '');
  if (!normalized) return '';
  return `${CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
};

const toCharacterImageUrl = (faceCode: string) =>
  `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${faceCode}/ui/square_0.png`;

function CommunityDetailSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-7 w-2/3' />
        <Skeleton className='h-4 w-1/2' />
      </CardHeader>
      <CardContent className='space-y-3'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
        <div className='flex flex-wrap gap-1'>
          <Skeleton className='h-5 w-12' />
          <Skeleton className='h-5 w-16' />
          <Skeleton className='h-5 w-14' />
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <Card className='border-border/70'>
            <CardHeader className='pb-1'>
              <Skeleton className='h-4 w-20' />
            </CardHeader>
            <CardContent className='space-y-2'>
              <Skeleton className='h-3 w-full' />
              <Skeleton className='h-3 w-11/12' />
              <Skeleton className='h-3 w-10/12' />
              <Skeleton className='h-3 w-9/12' />
            </CardContent>
          </Card>

          <Card className='border-border/70'>
            <CardHeader className='pb-1'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-48 w-full' />
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetTile({
  name,
  imageCandidates,
  pixelated,
  href,
}: {
  name: string;
  imageCandidates: string[];
  pixelated: boolean;
  href?: string;
}) {
  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const activeSource = imageCandidates.find((candidate) => !failedSources.has(candidate)) || '';
  const content = (
    <div
      className='flex h-11 w-full items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/85 p-1'
      title={name}
    >
      {activeSource ? (
        <Image
          src={activeSource}
          alt={name}
          width={44}
          height={44}
          className={pixelated ? 'h-full w-auto object-contain [image-rendering:pixelated]' : 'h-full w-auto object-contain'}
          unoptimized
          onError={() =>
            setFailedSources((current) => {
              if (current.has(activeSource)) return current;
              const next = new Set(current);
              next.add(activeSource);
              return next;
            })
          }
        />
      ) : (
        <span className='text-[10px] text-muted-foreground'>Empty</span>
      )}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className='block'>
      {content}
    </Link>
  );
}

export default function CommunityTeamDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [characterLookup, setCharacterLookup] = useState<CharacterLookup>({});
  const [itemLookup, setItemLookup] = useState<ItemLookup>({});

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const [teamResponse, characterResponse, itemResponse] = await Promise.all([
          fetch(`/api/community/teams/${params.id}`, { cache: 'no-store' }),
          fetch('/api/characters?lang=both', { cache: 'force-cache' }),
          fetch('/api/items', { cache: 'force-cache' }),
        ]);

        const teamPayload = (await teamResponse.json()) as { ok?: boolean; error?: string; team?: TeamDetail };
        if (!teamResponse.ok || !teamPayload.ok || !teamPayload.team) {
          setError(teamPayload.error || 'Failed to load team.');
          return;
        }

        setTeam(teamPayload.team);

        if (characterResponse.ok) {
          const characterPayload = (await characterResponse.json()) as { characters?: CharacterCatalogRow[] };
          if (Array.isArray(characterPayload.characters)) {
            const nextCharacterLookup: CharacterLookup = {};
            for (const character of characterPayload.characters) {
              const key = String(character.id);
              if (!key) continue;
              nextCharacterLookup[key] = character;
            }
            setCharacterLookup(nextCharacterLookup);
          }
        }

        if (itemResponse.ok) {
          const itemPayload = (await itemResponse.json()) as { items?: ItemCatalogRow[] };
          if (Array.isArray(itemPayload.items)) {
            const nextItemLookup: ItemLookup = {};
            for (const item of itemPayload.items) {
              const key = String(item.id);
              if (!key) continue;
              nextItemLookup[key] = item;
            }
            setItemLookup(nextItemLookup);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team.');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      void run();
    }
  }, [params.id]);

  const partySlots = useMemo(() => {
    const mainIds = team?.team_builds?.main_unit_ids || [];
    const unisonIds = team?.team_builds?.unison_unit_ids || [];
    const equipmentIds = team?.team_builds?.equipment_ids || [];
    const soulIds = team?.team_builds?.soul_ids || [];

    return [0, 1, 2].map((index) => {
      const mainId = Number(mainIds[index] || 0);
      const unisonId = Number(unisonIds[index] || 0);
      const equipmentId = Number(equipmentIds[index] || 0);
      const soulId = Number(soulIds[index] || 0);

      const mainCharacter = mainId > 0 ? characterLookup[String(mainId)] : undefined;
      const unisonCharacter = unisonId > 0 ? characterLookup[String(unisonId)] : undefined;
      const equipmentItem = equipmentId > 0 ? itemLookup[String(equipmentId)] : undefined;
      const soulItem = soulId > 0 ? itemLookup[String(soulId)] : undefined;

      return {
        index,
        fields: [
          {
            key: 'main',
            label: 'Main',
            name: mainCharacter?.nameEN || mainCharacter?.nameJP || (mainId > 0 ? `Character ${mainId}` : 'Empty'),
            imageCandidates: mainCharacter?.faceCode ? [toCharacterImageUrl(mainCharacter.faceCode)] : [],
            pixelated: false,
            href: mainCharacter?.faceCode ? `/characters/${mainCharacter.faceCode}` : undefined,
          },
          {
            key: 'unison',
            label: 'Unison',
            name: unisonCharacter?.nameEN || unisonCharacter?.nameJP || (unisonId > 0 ? `Character ${unisonId}` : 'Empty'),
            imageCandidates: unisonCharacter?.faceCode ? [toCharacterImageUrl(unisonCharacter.faceCode)] : [],
            pixelated: false,
            href: unisonCharacter?.faceCode ? `/characters/${unisonCharacter.faceCode}` : undefined,
          },
          {
            key: 'equipment',
            label: 'Equipment',
            name: equipmentItem?.name || (equipmentId > 0 ? `Equipment ${equipmentId}` : 'Empty'),
            imageCandidates: [toCdnAssetUrl(equipmentItem?.thumbnail || ''), toCdnAssetUrl(equipmentItem?.icon || '')].filter(Boolean),
            pixelated: true,
            href: equipmentId > 0 ? `/${equipmentItem?.type === 'item' ? 'item' : 'equip'}/${equipmentId}` : undefined,
          },
          {
            key: 'soul',
            label: 'Soul',
            name: soulItem?.name || (soulId > 0 ? `Soul ${soulId}` : 'Empty'),
            imageCandidates: [toCdnAssetUrl(soulItem?.thumbnail || ''), toCdnAssetUrl(soulItem?.icon || '')].filter(Boolean),
            pixelated: true,
            href: soulId > 0 ? `/${soulItem?.type === 'item' ? 'item' : 'equip'}/${soulId}` : undefined,
          },
        ] as const,
      };
    });
  }, [characterLookup, itemLookup, team?.team_builds?.equipment_ids, team?.team_builds?.main_unit_ids, team?.team_builds?.soul_ids, team?.team_builds?.unison_unit_ids]);

  return (
    <div className='mx-auto w-full max-w-4xl space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <Link href='/community'>
          <Button variant='outline'>Back to Community</Button>
        </Link>
        <Link href='/community/new'>
          <Button>Submit Team</Button>
        </Link>
      </div>

      {loading ? <CommunityDetailSkeleton /> : null}
      {error ? <p className='text-sm text-destructive'>{error}</p> : null}

      {team ? (
        <Card>
          <CardHeader>
            <CardTitle>{team.title}</CardTitle>
            <CardDescription>
              {(team.content_targets?.label || team.boss_label || 'No target')} - {team.source_type} - {team.publish_status}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {team.description ? <p className='text-sm text-muted-foreground'>{team.description}</p> : null}
            <div className='flex flex-wrap gap-1'>
              {(team.tags || []).map((tag) => (
                <span key={tag} className='rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                  {tag}
                </span>
              ))}
            </div>

            <Card className='border-border/70'>
              <CardHeader className='pb-1'>
                <CardTitle className='text-sm'>Party Preview</CardTitle>
                <CardDescription className='text-xs'>Main / Unison / Equipment / Soul (click any icon to open details).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-2 sm:grid-cols-3'>
                  {partySlots.map((slot) => (
                    <div key={slot.index} className='rounded-lg border border-border/70 bg-background/60 p-2'>
                      <p className='mb-2 text-[10px] uppercase text-muted-foreground'>Slot {slot.index + 1}</p>
                      <div className='space-y-1.5'>
                        {slot.fields.map((field) => (
                          <div key={field.key} className='space-y-1'>
                            <p className='text-[10px] uppercase text-muted-foreground'>{field.label}</p>
                            <AssetTile
                              name={field.name}
                              imageCandidates={field.imageCandidates}
                              pixelated={field.pixelated}
                              href={field.href}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className='grid gap-3 sm:grid-cols-2'>
              <Card className='border-border/70'>
                <CardHeader className='pb-1'>
                  <CardTitle className='text-sm'>Build</CardTitle>
                </CardHeader>
                <CardContent className='space-y-1 text-xs text-muted-foreground'>
                  <p>Main: {(team.team_builds?.main_unit_ids || []).join(', ') || 'none'}</p>
                  <p>Unison: {(team.team_builds?.unison_unit_ids || []).join(', ') || 'none'}</p>
                  <p>Equipment: {(team.team_builds?.equipment_ids || []).join(', ') || 'none'}</p>
                  <p>Souls: {(team.team_builds?.soul_ids || []).join(', ') || 'none'}</p>
                </CardContent>
              </Card>

              <Card className='border-border/70'>
                <CardHeader className='pb-1'>
                  <CardTitle className='text-sm'>Raw Snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className='max-h-48 overflow-auto rounded border bg-muted/20 p-2 text-[11px]'>
                    {JSON.stringify(team.raw_snapshot || {}, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>

            {Array.isArray(team.moderationEvents) && team.moderationEvents.length > 0 ? (
              <Card className='border-border/70'>
                <CardHeader className='pb-1'>
                  <CardTitle className='text-sm'>Moderation Events</CardTitle>
                </CardHeader>
                <CardContent className='space-y-1 text-xs text-muted-foreground'>
                  {team.moderationEvents.map((event, index) => (
                    <p key={`${event.action}-${event.created_at}-${index}`}>
                      {event.action} - {new Date(event.created_at).toLocaleString()} {event.note ? `- ${event.note}` : ''}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
