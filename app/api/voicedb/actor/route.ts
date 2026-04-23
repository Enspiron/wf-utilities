import { NextRequest, NextResponse } from 'next/server';
import {
  scrapeActorCreditSources,
  type ExternalActorCredit,
  type ExternalCreditSource,
} from '@/lib/voicedb/external-scrapers';

type WikidataSearchResult = {
  id?: string;
  label?: string;
  description?: string;
  url?: string;
};

type WikidataSearchResponse = {
  search?: WikidataSearchResult[];
};

type SparqlBindingValue = {
  type?: string;
  value?: string;
  datatype?: string;
  'xml:lang'?: string;
};

type SparqlBinding = Record<string, SparqlBindingValue | undefined>;

type SparqlResponse = {
  results?: {
    bindings?: SparqlBinding[];
  };
};

type ActorEntity = {
  id: string;
  label: string;
  description: string;
  url: string;
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
  sources: ExternalCreditSource[];
};

type ActorRoleImage = {
  id: string;
  label: string;
  url: string;
  image: string;
  fandomIds: string[];
};

type FandomPageImageResponse = {
  query?: {
    pages?: Record<string, {
      thumbnail?: {
        source?: string;
      };
    }>;
  };
};

export const dynamic = 'force-dynamic';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'WorldFlipperToolsVoiceDB/1.0 (https://utils.wfjukebox.com/voicedb)';
const REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

const PERSON_HINTS = [
  'voice actor',
  'voice actress',
  'actor',
  'actress',
  'singer',
  'seiyu',
  'seiyū',
];

const GACHA_HINTS = [
  'another eden',
  'alchemy stars',
  'arknights',
  'azur lane',
  'bang dream',
  'blue archive',
  'dragalia',
  'fate/grand order',
  'fire emblem heroes',
  'girls\' frontline',
  'granblue',
  'heaven burns red',
  'honkai',
  'idolmaster',
  'love live',
  'nikke',
  'project sekai',
  'punishing',
  'princess connect',
  'sinoalice',
  'star rail',
  'touhou lostword',
  'umamusume',
  'wuthering waves',
  'genshin',
  'world flipper',
];

const ANIMATION_HINTS = [
  'anime',
  'animated',
  'animation',
  'film',
  'ova',
  'television',
  'tv series',
];

const IGNORED_FANDOM_PREFIXES = new Set([
  'deathbattlefanon',
  'future-foundation',
  'hero',
  'mudae',
  'shipping',
  'vsbattles',
  'yuripedia',
]);

function getBinding(row: SparqlBinding, key: string): string {
  return row[key]?.value || '';
}

function getEntityIdFromUri(value: string): string {
  return value.split('/').pop() || value;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitAggregated(value: string): string[] {
  return value
    .split('|')
    .map((part) => normalizeWhitespace(part))
    .filter((part, index, all) => part && all.indexOf(part) === index);
}

function splitRoleImages(value: string): ActorRoleImage[] {
  const byId = new Map<string, ActorRoleImage>();

  for (const part of value
    .split(' || ')
    .map((part) => part.trim())
    .filter(Boolean)) {
    const [rawUrl, rawLabel, rawImage, rawFandomId] = part.split('\t');
    const id = getEntityIdFromUri(rawUrl || '');
    if (!id) continue;

    const current = byId.get(id);
    const fandomIds = rawFandomId ? [rawFandomId] : [];
    if (!current) {
      byId.set(id, {
        id,
        label: normalizeWhitespace(rawLabel || id),
        url: rawUrl || '',
        image: (rawImage || '').replace(/^http:/, 'https:'),
        fandomIds,
      });
      continue;
    }

    byId.set(id, {
      ...current,
      image: current.image || (rawImage || '').replace(/^http:/, 'https:'),
      fandomIds: [...new Set([...current.fandomIds, ...fandomIds])],
    });
  }

  return [...byId.values()].filter((role) => role.label);
}

function yearFromDate(value: string): number | null {
  const match = value.match(/^(-?\d{1,6})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function isTruthyBinding(row: SparqlBinding, key: string): boolean {
  return getBinding(row, key).toLowerCase() === 'true';
}

function looksLikeLikelyGacha(label: string, description: string): boolean {
  const haystack = `${label} ${description}`.toLowerCase();
  return GACHA_HINTS.some((hint) => haystack.includes(hint));
}

function looksLikeAnimation(label: string, description: string, kinds: string[]): boolean {
  const haystack = `${label} ${description} ${kinds.join(' ')}`.toLowerCase();
  return ANIMATION_HINTS.some((hint) => haystack.includes(hint));
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitFandomId(value: string): { prefix: string; page: string } | null {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex <= 0) return null;
  const prefix = value.slice(0, separatorIndex).trim();
  const page = value.slice(separatorIndex + 1).trim();
  if (!prefix || !page) return null;
  return { prefix, page };
}

function sourceKey(source: ExternalCreditSource): string {
  return `${source.label}|${source.url}|${source.viaLabel || ''}`;
}

function mergeSources(sources: ExternalCreditSource[]): ExternalCreditSource[] {
  const byKey = new Map<string, ExternalCreditSource>();
  for (const source of sources) {
    if (!source.label || !source.url) continue;
    byKey.set(sourceKey(source), source);
  }
  return [...byKey.values()];
}

function creditDedupeKey(credit: ActorCredit): string {
  const mediaBucket = credit.isVideoGame ? 'game' : credit.isAnimation ? 'animation' : 'other';
  return `${slugKey(credit.label) || credit.id}:${mediaBucket}`;
}

function isXAnnouncementCredit(credit: ActorCredit): boolean {
  return credit.sources.some((source) => source.label === 'X');
}

function scoreFandomId(fandomId: string, workLabel: string): number {
  const parsed = splitFandomId(fandomId);
  if (!parsed) return -1000;

  const prefix = parsed.prefix.toLowerCase();
  const basePrefix = prefix.replace(/^[a-z]{2}\./, '');
  if (IGNORED_FANDOM_PREFIXES.has(basePrefix)) return -1000;

  const workSlug = slugKey(workLabel);
  const workCompact = compactKey(workLabel);
  const prefixCompact = compactKey(basePrefix);
  const workTokens = workSlug.split('-').filter((token) => token.length > 2);
  let score = 0;

  if (basePrefix === workSlug) score += 40;
  if (prefixCompact === workCompact) score += 34;
  if (prefixCompact.includes(workCompact) || workCompact.includes(prefixCompact)) score += 24;
  score += workTokens.filter((token) => basePrefix.includes(token)).length * 6;
  if (/^[a-z]{2}\./.test(prefix)) score -= 4;
  return score;
}

function getFandomCandidates(role: ActorRoleImage, workLabel: string): string[] {
  return [...role.fandomIds]
    .sort((a, b) => scoreFandomId(b, workLabel) - scoreFandomId(a, workLabel))
    .filter((fandomId) => scoreFandomId(fandomId, workLabel) > -1000)
    .slice(0, 4);
}

function scoreSearchResult(result: WikidataSearchResult, query: string): number {
  const label = (result.label || '').toLowerCase();
  const description = (result.description || '').toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;

  if (label === normalizedQuery) score += 20;
  if (label.includes(normalizedQuery)) score += 8;
  if (description.includes('voice actor') || description.includes('voice actress')) score += 12;
  if (PERSON_HINTS.some((hint) => description.includes(hint))) score += 5;
  if (description.includes('japanese')) score += 2;
  return score;
}

async function fetchJson<T>(url: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  headers.set('User-Agent', USER_AGENT);

  const response = await fetch(url, {
    ...init,
    headers,
    next: init?.next || { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchFandomThumbnail(fandomId: string): Promise<string> {
  const parsed = splitFandomId(fandomId);
  if (!parsed) return '';

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '160',
    titles: parsed.page.replace(/ /g, '_'),
    origin: '*',
  });
  const url = `https://${parsed.prefix}.fandom.com/api.php?${params.toString()}`;

  try {
    const data = await fetchJson<FandomPageImageResponse>(url);
    const pages = Object.values(data.query?.pages || {});
    return (pages.find((page) => page.thumbnail?.source)?.thumbnail?.source || '').replace(/^http:/, 'https:');
  } catch {
    return '';
  }
}

async function searchWikidata(name: string): Promise<WikidataSearchResult[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    format: 'json',
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '8',
    search: name,
    origin: '*',
  });

  const data = await fetchJson<WikidataSearchResponse>(`${WIKIDATA_API}?${params.toString()}`);
  return (data.search || [])
    .filter((result) => result.id?.startsWith('Q'))
    .sort((a, b) => scoreSearchResult(b, name) - scoreSearchResult(a, name));
}

async function runSparql(query: string): Promise<SparqlBinding[]> {
  const body = new URLSearchParams({ query }).toString();
  const data = await fetchJson<SparqlResponse>(WIKIDATA_SPARQL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  });

  return data.results?.bindings || [];
}

function buildProfileQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(' ');
  return `
SELECT ?person ?personLabel ?personDescription ?image ?birthDate (SAMPLE(?article) AS ?articleUrl) WHERE {
  VALUES ?person { ${values} }
  ?person wdt:P31 wd:Q5.
  OPTIONAL { ?person wdt:P18 ?image. }
  OPTIONAL { ?person wdt:P569 ?birthDate. }
  OPTIONAL {
    ?article schema:about ?person;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en,ja".
    ?person rdfs:label ?personLabel.
    ?person schema:description ?personDescription.
  }
}
GROUP BY ?person ?personLabel ?personDescription ?image ?birthDate
`;
}

function buildCreditsQuery(id: string): string {
  return `
SELECT
  ?work
  ?workLabel
  ?workDescription
  (MIN(?dateValue) AS ?date)
  (GROUP_CONCAT(DISTINCT ?roleLabel; separator=" | ") AS ?roleLabels)
  (GROUP_CONCAT(DISTINCT ?roleName; separator=" | ") AS ?roleNames)
  (GROUP_CONCAT(DISTINCT ?subjectName; separator=" | ") AS ?subjectNames)
  (GROUP_CONCAT(DISTINCT ?objectName; separator=" | ") AS ?objectNames)
  (GROUP_CONCAT(DISTINCT ?creditedRoleName; separator=" | ") AS ?creditedRoleNames)
  (GROUP_CONCAT(DISTINCT ?instanceLabel; separator=" | ") AS ?kindLabels)
  (SAMPLE(?article) AS ?articleUrl)
  ?isVideoGame
WHERE {
  VALUES ?person { wd:${id} }
  {
    ?work wdt:P725 ?person.
  }
  UNION
  {
    ?work wdt:P161 ?person.
  }
  OPTIONAL { ?work wdt:P577 ?dateValue. }
  OPTIONAL { ?work wdt:P31 ?instance. }
  OPTIONAL {
    ?article schema:about ?work;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  OPTIONAL {
    {
      ?work p:P725 ?statement.
      ?statement ps:P725 ?person.
    }
    UNION
    {
      ?work p:P161 ?statement.
      ?statement ps:P161 ?person.
    }
    OPTIONAL { ?statement pq:P453 ?role. }
    OPTIONAL { ?statement pq:P1810 ?roleName. }
    OPTIONAL { ?statement pq:P4633 ?subjectName. }
    OPTIONAL { ?statement pq:P1932 ?objectName. }
    OPTIONAL { ?statement pq:P13187 ?creditedRoleName. }
  }
  BIND(EXISTS { ?work wdt:P31/wdt:P279* wd:Q7889 } AS ?isVideoGame)
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en,ja".
    ?work rdfs:label ?workLabel.
    ?work schema:description ?workDescription.
    ?instance rdfs:label ?instanceLabel.
    ?role rdfs:label ?roleLabel.
  }
}
GROUP BY ?work ?workLabel ?workDescription ?isVideoGame
ORDER BY DESC(?date) ?workLabel
LIMIT 400
`;
}

function buildCharacterGameCreditsQuery(id: string): string {
  return `
SELECT
  ?work
  ?workLabel
  ?workDescription
  (MIN(?dateValue) AS ?date)
  (SAMPLE(?characterLabel) AS ?derivedRoleLabels)
  ?character
  (SAMPLE(?characterImage) AS ?characterImage)
  (GROUP_CONCAT(DISTINCT ?fandomArticleId; separator=" | ") AS ?roleFandomIds)
  (GROUP_CONCAT(DISTINCT ?instanceLabel; separator=" | ") AS ?kindLabels)
  (SAMPLE(?article) AS ?articleUrl)
  ?isVideoGame
WHERE {
  VALUES ?person { wd:${id} }
  {
    ?character wdt:P725 ?person.
  }
  UNION
  {
    ?character wdt:P161 ?person.
  }

  {
    ?character wdt:P1441 ?work.
  }
  UNION
  {
    ?character wdt:P1080 ?work.
  }
  UNION
  {
    ?character wdt:P361 ?work.
  }

  ?work wdt:P31/wdt:P279* wd:Q7889.
  OPTIONAL { ?work wdt:P577 ?dateValue. }
  OPTIONAL { ?work wdt:P31 ?instance. }
  OPTIONAL { ?character wdt:P18 ?characterImage. }
  OPTIONAL { ?character wdt:P6262 ?fandomArticleId. }
  OPTIONAL {
    ?article schema:about ?work;
      schema:isPartOf <https://en.wikipedia.org/>.
  }
  BIND(true AS ?isVideoGame)
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en,ja".
    ?work rdfs:label ?workLabel.
    ?work schema:description ?workDescription.
    ?character rdfs:label ?characterLabel.
    ?instance rdfs:label ?instanceLabel.
  }
}
GROUP BY ?work ?workLabel ?workDescription ?character ?isVideoGame
ORDER BY DESC(?date) ?workLabel
LIMIT 200
`;
}

function profileFromRow(row: SparqlBinding, fallback: WikidataSearchResult): ActorEntity & {
  image: string;
  birthDate: string;
  articleUrl: string;
} {
  const id = getEntityIdFromUri(getBinding(row, 'person')) || fallback.id || '';
  return {
    id,
    label: getBinding(row, 'personLabel') || fallback.label || '',
    description: getBinding(row, 'personDescription') || fallback.description || '',
    url: `https://www.wikidata.org/wiki/${id}`,
    image: getBinding(row, 'image').replace(/^http:/, 'https:'),
    birthDate: getBinding(row, 'birthDate'),
    articleUrl: getBinding(row, 'articleUrl'),
  };
}

function creditFromRow(row: SparqlBinding): ActorCredit {
  const workUri = getBinding(row, 'work');
  const id = getEntityIdFromUri(workUri);
  const label = getBinding(row, 'workLabel') || id;
  const description = getBinding(row, 'workDescription');
  const roleLabels = splitAggregated(getBinding(row, 'roleLabels'));
  const derivedRoleLabels = splitAggregated(getBinding(row, 'derivedRoleLabels'));
  const roleNames = splitAggregated(getBinding(row, 'roleNames'));
  const subjectNames = splitAggregated(getBinding(row, 'subjectNames'));
  const objectNames = splitAggregated(getBinding(row, 'objectNames'));
  const creditedRoleNames = splitAggregated(getBinding(row, 'creditedRoleNames'));
  const roleImages = splitRoleImages(getBinding(row, 'roleImageTokens'));
  const characterRoleUri = getBinding(row, 'character');
  const characterRoleLabel = derivedRoleLabels[0] || getEntityIdFromUri(characterRoleUri);
  if (characterRoleUri && characterRoleLabel) {
    roleImages.push({
      id: getEntityIdFromUri(characterRoleUri),
      label: characterRoleLabel,
      url: characterRoleUri,
      image: getBinding(row, 'characterImage').replace(/^http:/, 'https:'),
      fandomIds: splitAggregated(getBinding(row, 'roleFandomIds')),
    });
  }
  const kinds = splitAggregated(getBinding(row, 'kindLabels'));
  const roles = [...new Set([
    ...roleLabels,
    ...derivedRoleLabels,
    ...roleNames,
    ...subjectNames,
    ...objectNames,
    ...creditedRoleNames,
  ])]
    .filter((role) => role !== label);
  const isVideoGame = isTruthyBinding(row, 'isVideoGame');
  const isAnimation = !isVideoGame && looksLikeAnimation(label, description, kinds);

  return {
    id,
    label,
    description,
    date: getBinding(row, 'date'),
    year: yearFromDate(getBinding(row, 'date')),
    roles,
    roleImages,
    kinds,
    url: id ? `https://www.wikidata.org/wiki/${id}` : workUri,
    articleUrl: getBinding(row, 'articleUrl'),
    isVideoGame,
    isLikelyGacha: isVideoGame && looksLikeLikelyGacha(label, description),
    isAnimation,
    sources: [{
      label: 'Wikidata',
      url: id ? `https://www.wikidata.org/wiki/${id}` : 'https://www.wikidata.org/',
    }],
  };
}

function creditFromExternal(credit: ExternalActorCredit): ActorCredit {
  return {
    ...credit,
    roleImages: credit.roleImages.map((role) => ({
      ...role,
      fandomIds: [],
    })),
    sources: mergeSources(credit.sources),
  };
}

function dedupeCredits(credits: ActorCredit[]): ActorCredit[] {
  const map = new Map<string, ActorCredit>();

  for (const credit of credits) {
    const key = creditDedupeKey(credit);
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        ...credit,
        sources: mergeSources(credit.sources),
      });
      continue;
    }

    const roles = [...new Set([...current.roles, ...credit.roles])];
    const roleImageById = new Map<string, ActorRoleImage>();
    for (const roleImage of [...current.roleImages, ...credit.roleImages]) {
      const currentImage = roleImageById.get(roleImage.id);
      if (!currentImage || (!currentImage.image && roleImage.image)) {
        roleImageById.set(roleImage.id, {
          ...roleImage,
          fandomIds: [...new Set([...(currentImage?.fandomIds || []), ...roleImage.fandomIds])],
        });
      } else {
        roleImageById.set(roleImage.id, {
          ...currentImage,
          fandomIds: [...new Set([...currentImage.fandomIds, ...roleImage.fandomIds])],
        });
      }
    }
    const kinds = [...new Set([...current.kinds, ...credit.kinds])];
    const sources = mergeSources([...current.sources, ...credit.sources]);
    map.set(key, {
      ...current,
      id: current.id.startsWith('Q') ? current.id : credit.id.startsWith('Q') ? credit.id : current.id,
      date: current.date || credit.date,
      year: current.year ?? credit.year,
      roles,
      roleImages: [...roleImageById.values()],
      kinds,
      articleUrl: current.articleUrl || credit.articleUrl,
      url: current.url || credit.url,
      isLikelyGacha: current.isLikelyGacha || credit.isLikelyGacha,
      isAnimation: current.isAnimation || credit.isAnimation,
      sources,
    });
  }

  return [...map.values()].sort((a, b) => {
    const yearDiff = (b.year || -999999) - (a.year || -999999);
    if (yearDiff !== 0) return yearDiff;
    return a.label.localeCompare(b.label);
  });
}

async function addFandomRoleThumbnails(credits: ActorCredit[]): Promise<ActorCredit[]> {
  const missingImagePairs: Array<{ creditId: string; roleId: string; role: ActorRoleImage; workLabel: string }> = [];

  for (const credit of credits) {
    if (!credit.isVideoGame) continue;
    for (const role of credit.roleImages) {
      if (role.image || role.fandomIds.length === 0) continue;
      missingImagePairs.push({
        creditId: credit.id,
        roleId: role.id,
        role,
        workLabel: credit.label,
      });
    }
  }

  const imageByPair = new Map<string, string>();
  await Promise.all(
    missingImagePairs.slice(0, 36).map(async (pair) => {
      for (const fandomId of getFandomCandidates(pair.role, pair.workLabel)) {
        const image = await fetchFandomThumbnail(fandomId);
        if (image) {
          imageByPair.set(`${pair.creditId}:${pair.roleId}`, image);
          return;
        }
      }
    })
  );

  if (imageByPair.size === 0) return credits;

  return credits.map((credit) => ({
    ...credit,
    roleImages: credit.roleImages.map((role) => ({
      ...role,
      image: role.image || imageByPair.get(`${credit.id}:${role.id}`) || '',
    })),
  }));
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim();
  const jpName = request.nextUrl.searchParams.get('jpName')?.trim() || '';

  if (!name) {
    return NextResponse.json({ error: 'Missing actor name.' }, { status: 400 });
  }

  try {
    const searchResults = await searchWikidata(name);
    const candidateIds = searchResults.map((result) => result.id).filter((id): id is string => Boolean(id));

    if (candidateIds.length === 0) {
      const external = await scrapeActorCreditSources({ name, jpName });
      const credits = dedupeCredits(external.credits.map(creditFromExternal));
      const gameCredits = credits.filter((credit) => credit.isVideoGame);
      const likelyGachaCredits = gameCredits.filter((credit) => credit.isLikelyGacha);
      const animationCredits = credits.filter((credit) => credit.isAnimation);
      const announcementCredits = credits.filter(isXAnnouncementCredit);

      return NextResponse.json({
        query: name,
        source: {
          label: 'Wikidata',
          searchUrl: `${WIKIDATA_API}?action=wbsearchentities`,
          sparqlUrl: WIKIDATA_SPARQL,
          scrapers: external.sources,
        },
        entity: null,
        profile: null,
        credits,
        gameCredits,
        likelyGachaCredits,
        animationCredits,
        announcementCredits,
        scrapers: external.sources,
        message: 'No Wikidata person match found.',
      });
    }

    const profileRows = await runSparql(buildProfileQuery(candidateIds));
    const profileById = new Map(profileRows.map((row) => [getEntityIdFromUri(getBinding(row, 'person')), row]));
    const bestSearch = searchResults.find((result) => result.id && profileById.has(result.id)) || searchResults[0];
    const bestId = bestSearch.id || '';
    const profileRow = profileById.get(bestId);

    if (!bestId || !profileRow) {
      const external = await scrapeActorCreditSources({ name, jpName });
      const credits = dedupeCredits(external.credits.map(creditFromExternal));
      const gameCredits = credits.filter((credit) => credit.isVideoGame);
      const likelyGachaCredits = gameCredits.filter((credit) => credit.isLikelyGacha);
      const animationCredits = credits.filter((credit) => credit.isAnimation);
      const announcementCredits = credits.filter(isXAnnouncementCredit);

      return NextResponse.json({
        query: name,
        source: {
          label: 'Wikidata',
          searchUrl: `${WIKIDATA_API}?action=wbsearchentities`,
          sparqlUrl: WIKIDATA_SPARQL,
          scrapers: external.sources,
        },
        entity: null,
        profile: null,
        credits,
        gameCredits,
        likelyGachaCredits,
        animationCredits,
        announcementCredits,
        scrapers: external.sources,
        candidates: searchResults,
        message: 'Wikidata returned search results, but none resolved to a human profile.',
      });
    }

    const profile = profileFromRow(profileRow, bestSearch);
    const [directCreditRows, characterGameCreditRows, external] = await Promise.all([
      runSparql(buildCreditsQuery(bestId)),
      runSparql(buildCharacterGameCreditsQuery(bestId)),
      scrapeActorCreditSources({ name, jpName }),
    ]);
    const credits = await addFandomRoleThumbnails(dedupeCredits([
      ...[...directCreditRows, ...characterGameCreditRows].map(creditFromRow),
      ...external.credits.map(creditFromExternal),
    ]));
    const gameCredits = credits.filter((credit) => credit.isVideoGame);
    const likelyGachaCredits = gameCredits.filter((credit) => credit.isLikelyGacha);
    const animationCredits = credits.filter((credit) => credit.isAnimation);
    const announcementCredits = credits.filter(isXAnnouncementCredit);

    return NextResponse.json({
      query: name,
      source: {
        label: 'Wikidata',
        entitySearch: `${WIKIDATA_API}?action=wbsearchentities`,
        sparql: WIKIDATA_SPARQL,
        voiceActorProperty: 'https://www.wikidata.org/wiki/Property:P725',
        castMemberFallbackProperty: 'https://www.wikidata.org/wiki/Property:P161',
        scrapers: external.sources,
      },
      entity: {
        id: profile.id,
        label: profile.label,
        description: profile.description,
        url: profile.url,
      },
      profile,
      credits,
      gameCredits,
      likelyGachaCredits,
      animationCredits,
      announcementCredits,
      scrapers: external.sources,
      candidates: searchResults.slice(0, 5),
    });
  } catch (error) {
    console.error('Failed to enrich VoiceDB actor:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch actor enrichment.',
        query: name,
      },
      { status: 502 }
    );
  }
}
