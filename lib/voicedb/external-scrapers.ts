export type ExternalCreditSource = {
  label: string;
  url: string;
  viaLabel?: string;
  viaUrl?: string;
};

export type ExternalRoleImage = {
  id: string;
  label: string;
  url: string;
  image: string;
};

export type ExternalActorCredit = {
  id: string;
  label: string;
  description: string;
  date: string;
  year: number | null;
  roles: string[];
  roleImages: ExternalRoleImage[];
  kinds: string[];
  url: string;
  articleUrl: string;
  isVideoGame: boolean;
  isLikelyGacha: boolean;
  isAnimation: boolean;
  sources: ExternalCreditSource[];
};

export type ExternalSourceStatus = {
  label: string;
  url: string;
  viaLabel?: string;
  viaUrl?: string;
  status: 'loaded' | 'no-match' | 'blocked' | 'disabled' | 'error';
  creditCount: number;
  message?: string;
};

type ScraperInput = {
  name: string;
  jpName?: string;
};

type ScraperResult = {
  credits: ExternalActorCredit[];
  sources: ExternalSourceStatus[];
};

type JikanPeopleSearchResponse = {
  data?: JikanPersonSearchResult[];
};

type JikanPersonSearchResult = {
  mal_id?: number;
  url?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  favorites?: number;
  about?: string | null;
  images?: {
    jpg?: {
      image_url?: string;
    };
  };
};

type JikanPersonFullResponse = {
  data?: {
    mal_id?: number;
    url?: string;
    name?: string;
    voices?: JikanVoiceRole[];
  };
};

type JikanVoiceRole = {
  role?: string;
  anime?: {
    mal_id?: number;
    url?: string;
    title?: string;
    images?: {
      jpg?: {
        image_url?: string;
      };
      webp?: {
        image_url?: string;
      };
    };
  };
  character?: {
    mal_id?: number;
    url?: string;
    name?: string;
    images?: {
      jpg?: {
        image_url?: string;
      };
      webp?: {
        image_url?: string;
        small_image_url?: string;
      };
    };
  };
};

type AnnSearchResult = {
  id: string;
  label: string;
  url: string;
};

type XRecentSearchResponse = {
  data?: XPost[];
  meta?: {
    result_count?: number;
  };
  errors?: {
    title?: string;
    detail?: string;
  }[];
};

type XPost = {
  id?: string;
  text?: string;
  created_at?: string;
  lang?: string;
};

const USER_AGENT = 'WorldFlipperToolsVoiceDB/1.0 (personal-use; https://utils.wfjukebox.com/voicedb)';
const REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

const JIKAN_API = 'https://api.jikan.moe/v4';
const JIKAN_SOURCE: ExternalCreditSource = {
  label: 'MyAnimeList',
  url: 'https://myanimelist.net/',
  viaLabel: 'Jikan API',
  viaUrl: 'https://jikan.moe/',
};

const ANN_BASE = 'https://www.animenewsnetwork.com';
const ANN_SOURCE: ExternalCreditSource = {
  label: 'Anime News Network',
  url: 'https://www.animenewsnetwork.com/encyclopedia/',
};

const X_RECENT_SEARCH_URL = 'https://api.x.com/2/tweets/search/recent';
const X_SOURCE: ExternalCreditSource = {
  label: 'X',
  url: 'https://x.com/',
  viaLabel: 'X API recent search',
  viaUrl: 'https://docs.x.com/x-api/posts/search/introduction',
};

const X_FREE_USAGE_FLAG = 'X_API_FREE_USAGE_CONFIRMED';
const X_MAX_RESULTS = 10;

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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeJapanese(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function htmlDecode(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function stripTags(value: string): string {
  return normalizeWhitespace(htmlDecode(value.replace(/<[^>]*>/g, ' ')));
}

function absoluteAnnUrl(value: string): string {
  if (!value) return ANN_BASE;
  if (value.startsWith('http')) return value;
  return `${ANN_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

function looksLikeLikelyGacha(label: string): boolean {
  const haystack = label.toLowerCase();
  return GACHA_HINTS.some((hint) => haystack.includes(hint));
}

function quotedXTerm(value: string): string {
  return `"${value.replace(/"/g, '').slice(0, 80)}"`;
}

function getXBearerToken(): string {
  return process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || '';
}

function canUseXApi(): boolean {
  return process.env[X_FREE_USAGE_FLAG]?.toLowerCase() === 'true';
}

function yearFromDate(value: string): number | null {
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

function isLikelyXVoiceAnnouncement(text: string, input: ScraperInput): boolean {
  const normalized = normalizeWhitespace(text);
  const lower = normalized.toLowerCase();
  const actorNames = [input.name, input.jpName || ''].filter(Boolean);
  const mentionsActor = actorNames.some((actorName) => normalized.includes(actorName));
  const hasVoiceSignal = [
    /\bCV\b/i,
    /\bVA\b/i,
    /voiced by/i,
    /voice actor/i,
    /voice actress/i,
    /cast/i,
    /声優/,
    /キャスト/,
    /ボイス/,
    /役[：:]/,
  ].some((pattern) => pattern.test(normalized));

  return mentionsActor && hasVoiceSignal && !lower.includes('rt @');
}

function extractXRole(text: string, input: ScraperInput): string {
  const escapedNames = [input.name, input.jpName || '']
    .filter(Boolean)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const actorPattern = escapedNames.length ? `(?:${escapedNames.join('|')})` : '';
  const patterns = [
    new RegExp(`(?:CV|ＣＶ|voice|voiced by|声優|キャスト)\\s*[：:]?\\s*${actorPattern}\\s*(?:as|as the)?\\s*([^\\n。.!?]+)`, 'i'),
    new RegExp(`([^\\n。.!?]{2,40})\\s*(?:役|as)\\s*[:：]?\\s*${actorPattern}`, 'i'),
    /(?:character|キャラクター|新キャラ|登場人物)\s*[：:]\s*([^\n。.!?]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const role = normalizeWhitespace(match?.[1] || '');
    if (role && !role.includes('http') && role.length <= 80) return role;
  }

  return 'Voice announcement';
}

function extractXWork(text: string): string {
  const hashtag = text.match(/#([A-Za-z0-9_]{3,40})/);
  if (hashtag?.[1]) return hashtag[1].replace(/_/g, ' ');

  const bracketed = text.match(/[【\[]([^】\]]{2,60})[】\]]/);
  if (bracketed?.[1]) return normalizeWhitespace(bracketed[1]);

  return 'Recent X voice announcement';
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (response.status === 403 || response.status === 429) {
    const error = new Error(`Blocked by source: ${response.status}`);
    error.name = 'SourceBlockedError';
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

async function fetchXRecentSearch(url: string, token: string): Promise<XRecentSearchResponse> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    const error = new Error(`X API refused the request: ${response.status}`);
    error.name = 'SourceBlockedError';
    throw error;
  }

  if (!response.ok) {
    throw new Error(`X API request failed: ${response.status}`);
  }

  return (await response.json()) as XRecentSearchResponse;
}

function scoreJikanPerson(result: JikanPersonSearchResult, input: ScraperInput): number {
  const resultName = normalizeName(result.name || '');
  const targetName = normalizeName(input.name);
  const targetJpName = normalizeJapanese(input.jpName || '');
  const familyName = normalizeJapanese(result.family_name || '');
  const givenName = normalizeJapanese(result.given_name || '');
  const jpForward = `${familyName}${givenName}`;
  const jpReverse = `${givenName}${familyName}`;
  const about = (result.about || '').toLowerCase();
  let score = 0;

  if (resultName === targetName) score += 100;
  if (resultName.includes(targetName)) score += 20;
  if (targetJpName && (jpForward === targetJpName || jpReverse === targetJpName)) score += 90;
  if (about.includes('81produce') || about.includes('81 produce')) score += 12;
  if (about.includes('seiyuu') || about.includes('voice')) score += 10;
  score += Math.min(40, Math.log10((result.favorites || 0) + 1) * 10);
  return score;
}

async function scrapeJikan(input: ScraperInput): Promise<ScraperResult> {
  const searchUrl = `${JIKAN_API}/people?${new URLSearchParams({
    q: input.name,
    limit: '10',
  }).toString()}`;
  const search = await fetchJson<JikanPeopleSearchResponse>(searchUrl);
  const candidates = (search.data || [])
    .filter((candidate) => candidate.mal_id && candidate.name)
    .sort((a, b) => scoreJikanPerson(b, input) - scoreJikanPerson(a, input));
  const best = candidates[0];

  if (!best?.mal_id || scoreJikanPerson(best, input) < 70) {
    return {
      credits: [],
      sources: [{
        ...JIKAN_SOURCE,
        status: 'no-match',
        creditCount: 0,
        message: 'No confident MyAnimeList person match found through Jikan.',
      }],
    };
  }

  const full = await fetchJson<JikanPersonFullResponse>(`${JIKAN_API}/people/${best.mal_id}/full`);
  const personUrl = full.data?.url || best.url || JIKAN_SOURCE.url;
  const credits = (full.data?.voices || [])
    .slice(0, 180)
    .map((voice): ExternalActorCredit | null => {
      const animeId = voice.anime?.mal_id;
      const characterId = voice.character?.mal_id;
      const label = normalizeWhitespace(voice.anime?.title || '');
      const roleLabel = normalizeWhitespace(voice.character?.name || '');
      if (!animeId || !label || !roleLabel) return null;

      const animeUrl = voice.anime?.url || personUrl;
      const roleUrl = voice.character?.url || animeUrl;
      const roleImage = (
        voice.character?.images?.webp?.image_url ||
        voice.character?.images?.webp?.small_image_url ||
        voice.character?.images?.jpg?.image_url ||
        ''
      ).replace(/^http:/, 'https:');
      const roleKind = normalizeWhitespace(voice.role || '');

      return {
        id: `mal-anime:${animeId}`,
        label,
        description: 'Anime voice credit from MyAnimeList via Jikan.',
        date: '',
        year: null,
        roles: [roleLabel],
        roleImages: [{
          id: characterId ? `mal-character:${characterId}` : `mal-character:${slugKey(`${label}-${roleLabel}`)}`,
          label: roleLabel,
          url: roleUrl,
          image: roleImage,
        }],
        kinds: ['anime', roleKind].filter(Boolean),
        url: animeUrl,
        articleUrl: animeUrl,
        isVideoGame: false,
        isLikelyGacha: false,
        isAnimation: true,
        sources: [{
          ...JIKAN_SOURCE,
          url: animeUrl,
        }],
      };
    })
    .filter((credit): credit is ExternalActorCredit => Boolean(credit));

  return {
    credits,
    sources: [{
      ...JIKAN_SOURCE,
      url: personUrl,
      status: 'loaded',
      creditCount: credits.length,
      message: `Matched ${full.data?.name || best.name || input.name} on MyAnimeList through Jikan.`,
    }],
  };
}

function scoreAnnSearchResult(result: AnnSearchResult, input: ScraperInput): number {
  const strippedLabel = result.label.replace(/\(.+?\)/g, '').trim();
  const targetName = normalizeName(input.name);
  const resultName = normalizeName(strippedLabel);
  const targetJpName = normalizeJapanese(input.jpName || '');
  const resultJpName = normalizeJapanese(result.label);
  let score = 0;

  if (resultName === targetName) score += 100;
  if (resultName.includes(targetName)) score += 20;
  if (/seiyuu|voice/i.test(result.label)) score += 20;
  if (targetJpName && resultJpName.includes(targetJpName)) score += 90;
  return score;
}

function parseAnnSearchResults(html: string): AnnSearchResult[] {
  return [...html.matchAll(/person\s+<a href="(\/encyclopedia\/people\.php\?id=(\d+))">([\s\S]*?)<\/a><br>/g)]
    .map((match) => ({
      id: match[2],
      label: stripTags(match[3]),
      url: absoluteAnnUrl(match[1]),
    }));
}

function parseAnnNonAnimeRoles(html: string, personUrl: string): ExternalActorCredit[] {
  const start = html.indexOf('<strong>Non-anime roles:</strong>');
  if (start < 0) return [];

  const scriptAfter = html.indexOf('</div>\n\t<script', start);
  const section = html.slice(start, scriptAfter > start ? scriptAfter : start + 16000);
  const credits: ExternalActorCredit[] = [];

  for (const match of section.matchAll(/<div class="tab">([\s\S]*?)<\/div>/g)) {
    const text = stripTags(match[1]);
    const parsed = text.match(/^(.+?)\s+in\s+"([^"]+)"\s+\(([^)]+)\)(.*)$/);
    if (!parsed) continue;

    const role = normalizeWhitespace(parsed[1]);
    const work = normalizeWhitespace(parsed[2]);
    const medium = normalizeWhitespace(parsed[3]);
    const note = normalizeWhitespace(parsed[4] || '').replace(/^\((.+)\)$/, '$1');
    const isVideoGame = /\bvg\b|game/i.test(medium);
    const isAnimation = !isVideoGame && /animated/i.test(medium);
    if (!work || !role || (!isVideoGame && !isAnimation)) continue;

    credits.push({
      id: `ann:${slugKey(work) || credits.length}`,
      label: work,
      description: `Non-anime role listed by Anime News Network${note ? ` (${note})` : ''}.`,
      date: '',
      year: null,
      roles: [role],
      roleImages: [{
        id: `ann-role:${slugKey(`${work}-${role}`) || credits.length}`,
        label: role,
        url: personUrl,
        image: '',
      }],
      kinds: [medium, note].filter(Boolean),
      url: personUrl,
      articleUrl: personUrl,
      isVideoGame,
      isLikelyGacha: isVideoGame && looksLikeLikelyGacha(work),
      isAnimation,
      sources: [{
        ...ANN_SOURCE,
        url: personUrl,
      }],
    });
  }

  return credits;
}

async function scrapeAnimeNewsNetwork(input: ScraperInput): Promise<ScraperResult> {
  const searchUrl = `${ANN_BASE}/encyclopedia/search/name?${new URLSearchParams({
    q: `"${input.name}"`,
  }).toString()}`;
  const searchHtml = await fetchText(searchUrl);
  const candidates = parseAnnSearchResults(searchHtml)
    .sort((a, b) => scoreAnnSearchResult(b, input) - scoreAnnSearchResult(a, input));
  const best = candidates[0];

  if (!best || scoreAnnSearchResult(best, input) < 80) {
    return {
      credits: [],
      sources: [{
        ...ANN_SOURCE,
        status: 'no-match',
        creditCount: 0,
        message: 'No confident Anime News Network person match found.',
      }],
    };
  }

  const personHtml = await fetchText(best.url);
  const credits = parseAnnNonAnimeRoles(personHtml, best.url);

  return {
    credits,
    sources: [{
      ...ANN_SOURCE,
      url: best.url,
      status: 'loaded',
      creditCount: credits.length,
      message: `Matched ${best.label} on Anime News Network.`,
    }],
  };
}

async function scrapeXRecentAnnouncements(input: ScraperInput): Promise<ScraperResult> {
  const token = getXBearerToken();
  const sourceUrl = X_SOURCE.viaUrl || X_SOURCE.url;

  if (!token) {
    return {
      credits: [],
      sources: [],
    };
  }

  if (!canUseXApi()) {
    return {
      credits: [],
      sources: [{
        ...X_SOURCE,
        status: 'disabled',
        creditCount: 0,
        message: `X bearer token is configured, but recent search is disabled until ${X_FREE_USAGE_FLAG}=true is set after confirming free/no-cost access in the X Developer Console.`,
      }],
    };
  }

  const names = [input.name, input.jpName || ''].filter(Boolean);
  if (names.length === 0) {
    return {
      credits: [],
      sources: [{
        ...X_SOURCE,
        status: 'no-match',
        creditCount: 0,
        message: 'No actor name was available for X recent search.',
      }],
    };
  }

  const actorQuery = names.map(quotedXTerm).join(' OR ');
  const query = `(${actorQuery}) (CV OR VA OR "voiced by" OR "voice actor" OR 声優 OR キャスト OR ボイス OR 役) -is:retweet`;
  const searchUrl = `${X_RECENT_SEARCH_URL}?${new URLSearchParams({
    query,
    max_results: String(X_MAX_RESULTS),
    'tweet.fields': 'created_at,lang',
  }).toString()}`;

  const search = await fetchXRecentSearch(searchUrl, token);
  const posts = (search.data || []).filter((post) => post.id && post.text);
  const credits = posts
    .filter((post) => isLikelyXVoiceAnnouncement(post.text || '', input))
    .slice(0, X_MAX_RESULTS)
    .map((post): ExternalActorCredit => {
      const text = normalizeWhitespace(post.text || '');
      const url = `https://x.com/i/web/status/${post.id}`;
      const label = extractXWork(text);
      const role = extractXRole(text, input);

      return {
        id: `x-post:${post.id}`,
        label,
        description: text.slice(0, 240),
        date: post.created_at || '',
        year: post.created_at ? yearFromDate(post.created_at) : null,
        roles: [role],
        roleImages: [],
        kinds: ['X announcement', post.lang ? `lang:${post.lang}` : ''].filter(Boolean),
        url,
        articleUrl: url,
        isVideoGame: looksLikeLikelyGacha(text) || /\bgame\b|mobile game|gacha|アプリ|ゲーム/i.test(text),
        isLikelyGacha: looksLikeLikelyGacha(text) || /gacha|アプリ/i.test(text),
        isAnimation: /anime|animation|アニメ/i.test(text),
        sources: [{
          ...X_SOURCE,
          url,
        }],
      };
    });

  return {
    credits,
    sources: [{
      ...X_SOURCE,
      url: sourceUrl,
      status: credits.length > 0 ? 'loaded' : 'no-match',
      creditCount: credits.length,
      message: credits.length > 0
        ? `Found ${credits.length} recent X voice announcement candidate${credits.length === 1 ? '' : 's'}.`
        : `Searched the official X recent-search endpoint with max_results=${X_MAX_RESULTS}; no recent announcement candidates matched.`,
    }],
  };
}

function blockedSource(label: string, url: string, error: unknown, via?: Pick<ExternalSourceStatus, 'viaLabel' | 'viaUrl'>): ExternalSourceStatus {
  const message = error instanceof Error ? error.message : 'Source blocked the request.';
  return {
    label,
    url,
    ...via,
    status: message.includes('403') || message.includes('429') ? 'blocked' : 'error',
    creditCount: 0,
    message,
  };
}

export async function scrapeActorCreditSources(input: ScraperInput): Promise<ScraperResult> {
  const [jikanResult, annResult, xResult] = await Promise.allSettled([
    scrapeJikan(input),
    scrapeAnimeNewsNetwork(input),
    scrapeXRecentAnnouncements(input),
  ]);

  const results: ScraperResult[] = [];

  if (jikanResult.status === 'fulfilled') {
    results.push(jikanResult.value);
  } else {
    results.push({
      credits: [],
      sources: [blockedSource(JIKAN_SOURCE.label, JIKAN_SOURCE.url, jikanResult.reason, {
        viaLabel: JIKAN_SOURCE.viaLabel,
        viaUrl: JIKAN_SOURCE.viaUrl,
      })],
    });
  }

  if (annResult.status === 'fulfilled') {
    results.push(annResult.value);
  } else {
    results.push({
      credits: [],
      sources: [blockedSource(ANN_SOURCE.label, ANN_SOURCE.url, annResult.reason)],
    });
  }

  if (xResult.status === 'fulfilled') {
    results.push(xResult.value);
  } else {
    results.push({
      credits: [],
      sources: [blockedSource(X_SOURCE.label, X_SOURCE.url, xResult.reason, {
        viaLabel: X_SOURCE.viaLabel,
        viaUrl: X_SOURCE.viaUrl,
      })],
    });
  }

  return {
    credits: results.flatMap((result) => result.credits),
    sources: results.flatMap((result) => result.sources),
  };
}
