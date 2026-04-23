'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpenText,
  Database,
  ExternalLink,
  Film,
  Gamepad2,
  Loader2,
  Search,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
  Volume2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type VoiceDbCharacter = {
  id: string;
  faceCode: string;
  nameEN: string;
  nameJP: string;
  titleEN: string;
  titleJP: string;
  attribute: string;
  role: string;
  race: string;
  rarity: number;
  iconUrl: string;
};

type VoiceDbActor = {
  id: string;
  name: string;
  jpName: string;
  characterCount: number;
  attributes: string[];
  rarities: number[];
  characters: VoiceDbCharacter[];
};

type VoiceDbPayload = {
  generatedAt: string;
  totals: {
    actors: number;
    voicedCharacters: number;
    missingVoiceActors: number;
    characters: number;
  };
  actors: VoiceDbActor[];
  missingVoiceActors: VoiceDbCharacter[];
  source: {
    local: string[];
    external: string[];
  };
};

type ActorCredit = {
  id: string;
  label: string;
  description: string;
  date: string;
  year: number | null;
  roles: string[];
  roleImages: ActorRoleImage[];
  kinds: string[];
  url: string;
  articleUrl: string;
  isVideoGame: boolean;
  isLikelyGacha: boolean;
  isAnimation: boolean;
  sources?: ActorCreditSource[];
};

type ActorRoleImage = {
  id: string;
  label: string;
  url: string;
  image: string;
};

type ActorCreditSource = {
  label: string;
  url: string;
  viaLabel?: string;
  viaUrl?: string;
};

type ActorSourceStatus = {
  label: string;
  url: string;
  viaLabel?: string;
  viaUrl?: string;
  status: 'loaded' | 'no-match' | 'blocked' | 'disabled' | 'error';
  creditCount: number;
  message?: string;
};

type ActorEnrichment = {
  query: string;
  entity: {
    id: string;
    label: string;
    description: string;
    url: string;
  } | null;
  profile: {
    id: string;
    label: string;
    description: string;
    url: string;
    image: string;
    birthDate: string;
    articleUrl: string;
  } | null;
  credits: ActorCredit[];
  gameCredits: ActorCredit[];
  likelyGachaCredits: ActorCredit[];
  animationCredits: ActorCredit[];
  announcementCredits?: ActorCredit[];
  scrapers?: ActorSourceStatus[];
  message?: string;
};

type SortMode = 'count' | 'name' | 'games';
type FilterMode = 'all' | 'multi' | 'five-star';

const PANEL_CLASS = 'rounded-md border border-border/70 bg-card/75';
const INNER_PANEL_CLASS = 'rounded-md border border-border/70 bg-background/55';

function cleanDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return String(date.getUTCFullYear());
}

function starLabel(rarity: number): string {
  if (!rarity) return 'unknown';
  return `${rarity} star`;
}

function CharacterIcon({
  character,
  size = 'md',
}: {
  character: VoiceDbCharacter;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const dimensions = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';

  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-md border bg-muted/40', dimensions)}>
      {!failed ? (
        <Image
          src={character.iconUrl}
          alt={character.nameEN || character.nameJP || character.faceCode}
          fill
          sizes={size === 'lg' ? '64px' : size === 'sm' ? '36px' : '48px'}
          className="object-contain p-0.5"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
          {character.nameEN?.slice(0, 2) || 'WF'}
        </div>
      )}
    </div>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className={cn(PANEL_CLASS, 'p-4')}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function getInitials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function RolePortrait({
  role,
  fallbackLabel,
  compact = false,
}: {
  role?: ActorRoleImage;
  fallbackLabel: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const label = role?.label || fallbackLabel;
  const showImage = role?.image && !failed;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-md border bg-muted/40',
        compact ? 'h-7 w-7' : 'h-14 w-14'
      )}
      title={label}
    >
      {showImage ? (
        <Image
          src={role.image}
          alt={label}
          fill
          sizes={compact ? '28px' : '56px'}
          className="object-cover"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-background/60 text-[10px] font-semibold text-muted-foreground">
          {getInitials(label)}
        </div>
      )}
    </div>
  );
}

function RoleImageStack({
  roles,
  fallbackLabel,
}: {
  roles: ActorRoleImage[];
  fallbackLabel: string;
}) {
  const visibleRoles = roles.slice(0, 3);

  if (visibleRoles.length <= 1) {
    return <RolePortrait role={visibleRoles[0]} fallbackLabel={fallbackLabel} />;
  }

  return (
    <div className="relative h-14 w-16 shrink-0">
      {visibleRoles.map((role, index) => (
        <div
          key={role.id || `${role.label}-${index}`}
          className="absolute"
          style={{
            left: `${index * 13}px`,
            top: `${index * 5}px`,
            zIndex: visibleRoles.length - index,
          }}
        >
          <RolePortrait role={role} fallbackLabel={fallbackLabel} compact />
        </div>
      ))}
      {roles.length > visibleRoles.length && (
        <div className="absolute bottom-0 right-0 rounded-md border bg-background px-1 text-[10px] font-semibold">
          +{roles.length - visibleRoles.length}
        </div>
      )}
    </div>
  );
}

function sourceLabel(source: ActorCreditSource): string {
  return source.viaLabel ? `${source.label} via ${source.viaLabel}` : source.label;
}

function CreditList({
  title,
  icon: Icon,
  credits,
  empty,
  limit = 10,
}: {
  title: string;
  icon: typeof Gamepad2;
  credits: ActorCredit[];
  empty: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? credits : credits.slice(0, limit);

  return (
    <div className={cn(PANEL_CLASS, 'p-4')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="secondary" className="rounded-md">{credits.length}</Badge>
        </div>
        {credits.length > limit && (
          <Button variant="outline" size="sm" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Show Less' : `Show ${credits.length}`}
          </Button>
        )}
      </div>

      {credits.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((credit) => (
            <a
              key={credit.id}
              href={credit.articleUrl || credit.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                INNER_PANEL_CLASS,
                'block p-3 transition hover:border-primary/60 hover:bg-accent/25'
              )}
            >
              <div className="flex items-start gap-3">
                <RoleImageStack roles={credit.roleImages || []} fallbackLabel={credit.roles[0] || credit.label} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{credit.label}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {credit.roles.length ? `as ${credit.roles.join(', ')}` : credit.description || 'Voice credit'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {credit.year && <Badge variant="outline" className="rounded-md">{cleanDate(credit.date)}</Badge>}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(credit.sources || []).slice(0, 3).map((source) => (
                      <Badge key={`${source.label}-${source.url}-${source.viaLabel || ''}`} variant="secondary" className="rounded-md">
                        {sourceLabel(source)}
                      </Badge>
                    ))}
                    {credit.isLikelyGacha && (
                      <Badge className="rounded-md border-emerald-500/40 bg-emerald-500/10 text-emerald-600 shadow-none">
                        likely gacha
                      </Badge>
                    )}
                    {credit.kinds.slice(0, 3).map((kind) => (
                      <Badge key={kind} variant="outline" className="rounded-md">{kind}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ActorListItem({
  actor,
  selected,
  onSelect,
}: {
  actor: VoiceDbActor;
  selected: boolean;
  onSelect: () => void;
}) {
  const preview = actor.characters.slice(0, 4);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border p-3 text-left transition',
        selected ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/45 hover:border-primary/50 hover:bg-accent/35'
      )}
    >
      <div className="flex gap-3">
        <div className="flex w-20 shrink-0 -space-x-4">
          {preview.map((character) => (
            <CharacterIcon key={character.faceCode} character={character} size="sm" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{actor.name}</p>
              {actor.jpName && <p className="truncate text-xs text-muted-foreground">{actor.jpName}</p>}
            </div>
            <Badge variant={selected ? 'default' : 'secondary'} className="rounded-md">
              {actor.characterCount}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actor.attributes.slice(0, 4).map((attribute) => (
              <Badge key={attribute} variant="outline" className="rounded-md">{attribute}</Badge>
            ))}
            {actor.rarities[0] && <Badge variant="outline" className="rounded-md">{starLabel(actor.rarities[0])}</Badge>}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function VoiceDbPage() {
  const [payload, setPayload] = useState<VoiceDbPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState('');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('count');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [enrichment, setEnrichment] = useState<ActorEnrichment | null>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVoiceDb() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/voicedb', { cache: 'force-cache' });
        if (!response.ok) throw new Error(`VoiceDB request failed (${response.status})`);
        const data = (await response.json()) as VoiceDbPayload;
        if (cancelled) return;
        setPayload(data);
        setSelectedActorId((current) => current || data.actors[0]?.id || '');
      } catch (loadError) {
        console.error('Failed to load VoiceDB:', loadError);
        if (!cancelled) setError('Failed to load voice actor data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadVoiceDb();

    return () => {
      cancelled = true;
    };
  }, []);

  const actors = useMemo(() => payload?.actors ?? [], [payload]);

  const filteredActors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = actors.filter((actor) => {
      if (filterMode === 'multi' && actor.characterCount < 2) return false;
      if (filterMode === 'five-star' && !actor.rarities.includes(5)) return false;
      if (!normalizedQuery) return true;

      const characterText = actor.characters
        .map((character) => `${character.nameEN} ${character.nameJP} ${character.faceCode}`)
        .join(' ');
      const haystack = `${actor.name} ${actor.jpName} ${characterText}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'games') {
        const fiveStarDiff = (b.rarities.includes(5) ? 1 : 0) - (a.rarities.includes(5) ? 1 : 0);
        if (fiveStarDiff !== 0) return fiveStarDiff;
      }
      return b.characterCount - a.characterCount || a.name.localeCompare(b.name);
    });
  }, [actors, filterMode, query, sortMode]);

  const selectedActor = useMemo(() => {
    return actors.find((actor) => actor.id === selectedActorId) || filteredActors[0] || actors[0] || null;
  }, [actors, filteredActors, selectedActorId]);

  useEffect(() => {
    if (!selectedActor) return;

    const controller = new AbortController();
    setEnrichment(null);
    setEnrichmentError(null);
    setEnrichmentLoading(true);

    async function loadActorEnrichment() {
      try {
        const params = new URLSearchParams({ name: selectedActor.name });
        if (selectedActor.jpName) params.set('jpName', selectedActor.jpName);
        const response = await fetch(`/api/voicedb/actor?${params.toString()}`, {
          signal: controller.signal,
          cache: 'force-cache',
        });
        if (!response.ok) throw new Error(`Actor lookup failed (${response.status})`);
        const data = (await response.json()) as ActorEnrichment;
        setEnrichment(data);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Failed to load actor enrichment:', loadError);
        setEnrichmentError('External credits could not be loaded right now.');
      } finally {
        if (!controller.signal.aborted) setEnrichmentLoading(false);
      }
    }

    void loadActorEnrichment();

    return () => controller.abort();
  }, [selectedActor]);

  const featuredActors = useMemo(() => actors.slice(0, 6), [actors]);
  const selectedCharacters = selectedActor?.characters || [];
  const selectedFiveStars = selectedCharacters.filter((character) => character.rarity === 5).length;
  const actorImage = enrichment?.profile?.image || '';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className={cn(PANEL_CLASS, 'max-w-md p-6 text-center')}>
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-3 text-xl font-semibold">VoiceDB did not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'No voice data was returned.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/65">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-4 py-5 md:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              Character voice credits
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">VoiceDB</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              World Flipper voice actors, their in-game roles, and attributed external credits for games and animation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-md">local character JSON</Badge>
            <Badge variant="outline" className="rounded-md">Wikidata</Badge>
            <Badge variant="outline" className="rounded-md">MAL via Jikan</Badge>
            <Badge variant="outline" className="rounded-md">ANN</Badge>
            <Badge variant="outline" className="rounded-md">X guarded</Badge>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 md:px-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricBlock
            icon={UsersRound}
            label="Actors"
            value={payload.totals.actors.toLocaleString()}
            detail="Unique actor names from character_text.json"
          />
          <MetricBlock
            icon={UserRound}
            label="Voiced Roles"
            value={payload.totals.voicedCharacters.toLocaleString()}
            detail={`${payload.totals.characters.toLocaleString()} total character rows scanned`}
          />
          <MetricBlock
            icon={Star}
            label="Missing"
            value={payload.totals.missingVoiceActors.toLocaleString()}
            detail="Characters without a mapped actor name"
          />
          <MetricBlock
            icon={Database}
            label="Sources"
            value={payload.source.local.length.toLocaleString()}
            detail="Local datalist files merged for this view"
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-md border-border/70 bg-card/85 shadow-none">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">Actors</CardTitle>
              <CardDescription>{filteredActors.length.toLocaleString()} matches</CardDescription>
              <div className="relative pt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search actors, characters, face codes..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'multi', 'five-star'] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={filterMode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterMode(mode)}
                  >
                    {mode === 'all' ? 'All' : mode === 'multi' ? 'Multi-role' : '5 star'}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['count', 'name', 'games'] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={sortMode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortMode(mode)}
                  >
                    {mode === 'count' ? 'Most roles' : mode === 'name' ? 'Name' : '5 star first'}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <ScrollArea className="h-[calc(100dvh-24rem)] min-h-[420px] pr-2">
                <div className="space-y-2">
                  {filteredActors.map((actor) => (
                    <ActorListItem
                      key={actor.id}
                      actor={actor}
                      selected={selectedActor?.id === actor.id}
                      onSelect={() => setSelectedActorId(actor.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {selectedActor && (
              <Card className="overflow-hidden rounded-md border-border/70 bg-card/85 shadow-none">
                <CardContent className="p-0">
                  <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="p-5 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-md">selected actor</Badge>
                            {enrichment?.entity && (
                              <a href={enrichment.entity.url} target="_blank" rel="noreferrer">
                                <Badge variant="secondary" className="rounded-md">
                                  {enrichment.entity.id}
                                  <ExternalLink className="ml-1 h-3 w-3" />
                                </Badge>
                              </a>
                            )}
                          </div>
                          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{selectedActor.name}</h2>
                          {selectedActor.jpName && <p className="mt-1 text-sm text-muted-foreground">{selectedActor.jpName}</p>}
                          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {enrichment?.profile?.description || 'World Flipper role data is loaded locally. External credits load from Wikidata when available.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-md">{selectedActor.characterCount} WF roles</Badge>
                          <Badge variant="outline" className="rounded-md">{selectedFiveStars} 5 star</Badge>
                          {enrichment?.gameCredits && (
                            <Badge variant="outline" className="rounded-md">{enrichment.gameCredits.length} games</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className={cn(INNER_PANEL_CLASS, 'p-3')}>
                          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">World Flipper</p>
                          <p className="mt-1 text-xl font-semibold">{selectedActor.characterCount}</p>
                        </div>
                        <div className={cn(INNER_PANEL_CLASS, 'p-3')}>
                          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Video Games</p>
                          <p className="mt-1 text-xl font-semibold">
                            {enrichmentLoading ? '-' : (enrichment?.gameCredits.length || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className={cn(INNER_PANEL_CLASS, 'p-3')}>
                          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Likely Gacha</p>
                          <p className="mt-1 text-xl font-semibold">
                            {enrichmentLoading ? '-' : (enrichment?.likelyGachaCredits.length || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t bg-background/45 p-5 xl:border-l xl:border-t-0">
                      <div className="relative mx-auto aspect-square max-w-[260px] overflow-hidden rounded-md border bg-muted/30">
                        {actorImage ? (
                          <Image
                            src={actorImage}
                            alt={selectedActor.name}
                            fill
                            sizes="260px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="grid h-full grid-cols-2 gap-2 p-4">
                            {selectedCharacters.slice(0, 4).map((character) => (
                              <CharacterIcon key={character.faceCode} character={character} size="lg" />
                            ))}
                          </div>
                        )}
                      </div>
                      {enrichment?.profile?.articleUrl && (
                        <a href={enrichment.profile.articleUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="mt-3 w-full">
                            <BookOpenText className="h-4 w-4" />
                            Wikipedia
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedActor && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className={cn(PANEL_CLASS, 'p-4')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <h3 className="font-semibold">World Flipper Roles</h3>
                    </div>
                    <Badge variant="secondary" className="rounded-md">{selectedCharacters.length}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {selectedCharacters.map((character) => (
                      <Link
                        key={`${character.id}-${character.faceCode}`}
                        href={`/charactersv2/${encodeURIComponent(character.faceCode)}`}
                        className={cn(
                          INNER_PANEL_CLASS,
                          'flex items-center gap-3 p-3 transition hover:border-primary/60 hover:bg-accent/25'
                        )}
                      >
                        <CharacterIcon character={character} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{character.nameEN || character.nameJP}</p>
                          <p className="truncate text-xs text-muted-foreground">{character.titleEN || character.faceCode}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {character.attribute && <Badge variant="outline" className="rounded-md">{character.attribute}</Badge>}
                            {character.rarity > 0 && <Badge variant="outline" className="rounded-md">{starLabel(character.rarity)}</Badge>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className={cn(PANEL_CLASS, 'p-4')}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <h3 className="font-semibold">External Lookup</h3>
                      </div>
                      {enrichmentLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>

                    {enrichmentError ? (
                      <p className="mt-3 text-sm text-destructive">{enrichmentError}</p>
                    ) : enrichmentLoading ? (
                      <p className="mt-3 text-sm text-muted-foreground">Checking Wikidata credits...</p>
                    ) : enrichment?.message ? (
                      <p className="mt-3 text-sm text-muted-foreground">{enrichment.message}</p>
                    ) : enrichment?.entity ? (
                      <div className="mt-3 text-sm text-muted-foreground">
                        Matched <span className="font-medium text-foreground">{enrichment.entity.label}</span>. External credits are only as complete as the Wikidata voice actor statements.
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Select an actor to fetch external credits.</p>
                    )}

                    {enrichment?.scrapers && enrichment.scrapers.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {enrichment.scrapers.map((source) => (
                          <Badge
                            key={`${source.label}-${source.url}`}
                            variant={source.status === 'loaded' ? 'secondary' : 'outline'}
                            className="rounded-md"
                            title={source.message}
                          >
                            {source.viaLabel ? `${source.label} via ${source.viaLabel}` : source.label}
                            {source.status === 'loaded' ? ` ${source.creditCount}` : ` ${source.status}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <CreditList
                    title="Recent X Voice Announcements"
                    icon={Volume2}
                    credits={enrichment?.announcementCredits || []}
                    empty="No recent X announcement evidence is loaded for this actor."
                  />

                  <CreditList
                    title="Likely Gacha And Mobile-adjacent Games"
                    icon={Sparkles}
                    credits={enrichment?.likelyGachaCredits || []}
                    empty="No likely gacha credits were detected from the Wikidata game list."
                  />
                </div>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
              <CreditList
                title="Video Game Credits"
                icon={Gamepad2}
                credits={enrichment?.gameCredits || []}
                empty="No video game credits found for this actor in Wikidata."
                limit={12}
              />
              <CreditList
                title="Animation Credits"
                icon={Film}
                credits={enrichment?.animationCredits || []}
                empty="No animation credits found through the voice actor property."
                limit={12}
              />
            </div>

            <div className={cn(PANEL_CLASS, 'p-4')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">High-role Actors</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Fast picks from the local roster.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {featuredActors.map((actor) => (
                  <Button
                    key={actor.id}
                    variant={selectedActor?.id === actor.id ? 'default' : 'outline'}
                    className="h-auto justify-start px-3 py-2 text-left"
                    onClick={() => setSelectedActorId(actor.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{actor.name}</span>
                      <span className="block text-xs opacity-80">{actor.characterCount} roles</span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
