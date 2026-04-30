export type SearchOperatorKey =
  | 'attribute'
  | 'category'
  | 'face'
  | 'has'
  | 'id'
  | 'missing'
  | 'mode'
  | 'prefix'
  | 'rarity'
  | 'race'
  | 'source'
  | 'stance'
  | 'type'
  | 'va'
  | 'weapon';

export type SearchHighlightPart = {
  text: string;
  match?: boolean;
};

type SearchFilterValue = string | number | boolean | Array<string | number | boolean> | undefined;

type SearchMatchKind = 'exact' | 'token' | 'prefix' | 'word' | 'substring' | 'collapsed';

export type SearchFieldInput = {
  key: string;
  label: string;
  text: string;
  searchText?: string;
  weight: number;
  highlight?: boolean;
};

export type SearchDocumentInput = {
  id: string;
  kind: string;
  group: string;
  href: string;
  title: string;
  subtitle: string;
  snippet?: string;
  badges?: string[];
  imageUrl?: string;
  imagePixelated?: boolean;
  priority?: number;
  fields: SearchFieldInput[];
  filters?: Partial<Record<SearchOperatorKey, SearchFilterValue>>;
};

export type SearchField = SearchFieldInput & {
  normalizedDisplayText: string;
  normalizedSearchText: string;
  collapsedSearchText: string;
  tokenSet: Set<string>;
};

export type SearchDocument = Omit<SearchDocumentInput, 'fields'> & {
  fields: SearchField[];
};

export type ParsedSearchTerm = {
  raw: string;
  normalized: string;
  collapsed: string;
};

export type ParsedSearchQuery = {
  raw: string;
  terms: ParsedSearchTerm[];
  filters: Partial<Record<SearchOperatorKey, string[]>>;
  normalizedPhrase: string;
  collapsedPhrase: string;
  hasTerms: boolean;
  hasFilters: boolean;
};

export type SearchMatch = {
  score: number;
  reason: string;
  matchedFieldLabel: string | null;
  bestFieldKey: string | null;
  bestFieldText: string | null;
  highlightTerms: string[];
};

export type SearchMatchResult<TDocument extends SearchDocument = SearchDocument> = {
  document: TDocument;
  match: SearchMatch;
};

export type SearchApiResult = {
  id: string;
  kind: string;
  group: string;
  href: string;
  title: string;
  subtitle: string;
  snippet?: string;
  badges?: string[];
  imageUrl?: string;
  imagePixelated?: boolean;
  score: number;
  reason: string;
  titleHighlights: SearchHighlightPart[];
  subtitleHighlights: SearchHighlightPart[];
  snippetHighlights?: SearchHighlightPart[];
};

const OPERATOR_KEYS = new Set<SearchOperatorKey>([
  'attribute',
  'category',
  'face',
  'has',
  'id',
  'missing',
  'mode',
  'prefix',
  'rarity',
  'race',
  'source',
  'stance',
  'type',
  'va',
  'weapon',
]);

const TOKEN_ALIASES: Record<string, string[]> = {
  anv: ['anniversary', 'anniv'],
  halfanv: ['half anniversary', 'half anniv'],
  ny: ['new year', 'newyear'],
  smr: ['summer'],
  xm: ['christmas', 'xmas'],
  vt: ['valentine', 'valentines'],
  wd: ['white day', 'whiteday'],
  gl: ['global'],
  jp: ['japan', 'japanese'],
};

const MATCH_KIND_MULTIPLIERS: Record<SearchMatchKind, number> = {
  exact: 18,
  token: 16,
  prefix: 13,
  word: 11,
  substring: 8,
  collapsed: 7,
};

function splitSearchTokens(raw: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;

  for (const char of raw) {
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (/\s/.test(char) && !inQuote) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeOperatorKey(value: string): SearchOperatorKey | null {
  const normalized = value.trim().toLowerCase();
  return OPERATOR_KEYS.has(normalized as SearchOperatorKey)
    ? (normalized as SearchOperatorKey)
    : null;
}

function normalizeFilterValue(value: string): string {
  return normalizeSearchValue(value);
}

function toFilterValues(value: SearchFilterValue): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry))
      .map((entry) => normalizeFilterValue(entry))
      .filter(Boolean);
  }

  return [normalizeFilterValue(String(value))].filter(Boolean);
}

function addFilter(filters: Partial<Record<SearchOperatorKey, string[]>>, key: SearchOperatorKey, rawValue: string) {
  const values = rawValue
    .split(',')
    .map((value) => normalizeFilterValue(value))
    .filter(Boolean);

  if (!values.length) return;
  filters[key] = uniq([...(filters[key] || []), ...values]);
}

function describeMatch(kind: SearchMatchKind, label: string): string {
  if (kind === 'exact') return `Exact ${label} match`;
  if (kind === 'prefix') return `${label} starts with query`;
  return `Matched ${label}`;
}

function buildTokenSet(value: string): Set<string> {
  return new Set(value.split(' ').filter(Boolean));
}

function getHighlightPatterns(query: ParsedSearchQuery): string[] {
  return uniq([
    ...query.terms.map((term) => term.raw.trim()).filter((term) => term.length > 1 || /^\d+$/.test(term)),
    ...Object.values(query.filters).flat().filter((value) => value.length > 1 || /^\d+$/.test(value)),
  ]);
}

function getQueryGate(query: ParsedSearchQuery): 'all' | 'pages-only' {
  if (!query.raw.trim()) return 'pages-only';
  if (query.hasFilters) return 'all';

  const meaningfulTerms = query.terms.filter((term) => term.raw.length >= 2 || /^\d+$/.test(term.raw));
  return meaningfulTerms.length === 0 ? 'pages-only' : 'all';
}

export function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function collapseSearchValue(value: string): string {
  return normalizeSearchValue(value).replace(/\s+/g, '');
}

export function expandAliasToken(rawToken: string): string[] {
  const token = normalizeSearchValue(rawToken);
  if (!token) return [];

  const results = new Set<string>([token]);
  const compactToken = token.replace(/\s+/g, '');

  const directAliases = TOKEN_ALIASES[token] || TOKEN_ALIASES[compactToken];
  if (directAliases) {
    directAliases.forEach((alias) => results.add(normalizeSearchValue(alias)));
  }

  for (const [aliasKey, aliasValues] of Object.entries(TOKEN_ALIASES)) {
    if (compactToken === aliasKey || compactToken.startsWith(aliasKey)) {
      aliasValues.forEach((alias) => results.add(normalizeSearchValue(alias)));
    }
  }

  return Array.from(results).filter(Boolean);
}

export function expandAliasValue(value: string): string[] {
  const normalized = normalizeSearchValue(value);
  if (!normalized) return [];

  const terms = normalized.split(' ').flatMap((token) => expandAliasToken(token));
  return uniq([normalized, collapseSearchValue(value), ...terms].filter(Boolean));
}

export function createSearchField(input: SearchFieldInput): SearchField {
  const text = input.text || '';
  const searchText = input.searchText || text;
  const normalizedDisplayText = normalizeSearchValue(text);
  const normalizedSearchText = normalizeSearchValue(searchText);

  return {
    ...input,
    text,
    searchText,
    normalizedDisplayText,
    normalizedSearchText,
    collapsedSearchText: collapseSearchValue(searchText),
    tokenSet: buildTokenSet(normalizedSearchText),
  };
}

export function createSearchDocument(input: SearchDocumentInput): SearchDocument {
  return {
    ...input,
    fields: input.fields.map((field) => createSearchField(field)),
  };
}

export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const filters: Partial<Record<SearchOperatorKey, string[]>> = {};
  const terms: ParsedSearchTerm[] = [];

  for (const token of splitSearchTokens(raw)) {
    const colonIndex = token.indexOf(':');
    if (colonIndex > 0) {
      const rawKey = token.slice(0, colonIndex);
      const rawValue = token.slice(colonIndex + 1);
      const key = normalizeOperatorKey(rawKey);
      if (key && rawValue.trim()) {
        addFilter(filters, key, rawValue.trim());
        continue;
      }
    }

    const normalized = normalizeSearchValue(token);
    if (!normalized) continue;
    terms.push({
      raw: token.trim(),
      normalized,
      collapsed: collapseSearchValue(token),
    });
  }

  const normalizedPhrase = normalizeSearchValue(raw);
  return {
    raw,
    terms,
    filters,
    normalizedPhrase,
    collapsedPhrase: collapseSearchValue(raw),
    hasTerms: terms.length > 0,
    hasFilters: Object.keys(filters).length > 0,
  };
}

export function hasSearchIntent(query: ParsedSearchQuery): boolean {
  return query.hasTerms || query.hasFilters;
}

function scoreField(field: SearchField, term: ParsedSearchTerm) {
  if (!term.normalized) return null;

  if (field.normalizedDisplayText === term.normalized || field.normalizedSearchText === term.normalized) {
    return {
      field,
      kind: 'exact' as const,
      score: field.weight * MATCH_KIND_MULTIPLIERS.exact + term.normalized.length,
    };
  }

  if (field.tokenSet.has(term.normalized)) {
    return {
      field,
      kind: 'token' as const,
      score: field.weight * MATCH_KIND_MULTIPLIERS.token + term.normalized.length,
    };
  }

  if (
    field.normalizedDisplayText.startsWith(term.normalized) ||
    field.normalizedSearchText.startsWith(term.normalized)
  ) {
    return {
      field,
      kind: 'prefix' as const,
      score: field.weight * MATCH_KIND_MULTIPLIERS.prefix + term.normalized.length,
    };
  }

  if (
    field.normalizedDisplayText.includes(` ${term.normalized}`) ||
    field.normalizedSearchText.includes(` ${term.normalized}`)
  ) {
    return {
      field,
      kind: 'word' as const,
      score: field.weight * MATCH_KIND_MULTIPLIERS.word + term.normalized.length,
    };
  }

  if (field.normalizedSearchText.includes(term.normalized)) {
    return {
      field,
      kind: 'substring' as const,
      score: field.weight * MATCH_KIND_MULTIPLIERS.substring + term.normalized.length,
    };
  }

  if (term.collapsed && field.collapsedSearchText.includes(term.collapsed)) {
    return {
      field,
      kind: 'collapsed' as const,
      score: field.weight * MATCH_KIND_MULTIPLIERS.collapsed + term.collapsed.length,
    };
  }

  return null;
}

function matchesFilters(document: SearchDocument, query: ParsedSearchQuery): boolean {
  for (const [key, queryValues] of Object.entries(query.filters) as Array<[SearchOperatorKey, string[]]>) {
    const docValues = toFilterValues(document.filters?.[key]);
    if (!queryValues.length) continue;
    if (!docValues.length) return false;

    const matched = queryValues.every((queryValue) =>
      docValues.some(
        (docValue) =>
          docValue === queryValue ||
          docValue.startsWith(queryValue) ||
          docValue.includes(queryValue)
      )
    );

    if (!matched) return false;
  }

  return true;
}

export function scoreSearchDocument(document: SearchDocument, query: ParsedSearchQuery): SearchMatch | null {
  if (!matchesFilters(document, query)) return null;

  const gate = getQueryGate(query);
  if (gate === 'pages-only' && document.kind !== 'page') return null;

  const termMatches = query.terms.map((term) => {
    let bestMatch: ReturnType<typeof scoreField> = null;

    for (const field of document.fields) {
      const candidate = scoreField(field, term);
      if (!candidate) continue;
      if (!bestMatch || candidate.score > bestMatch.score) {
        bestMatch = candidate;
      }
    }

    return bestMatch;
  });

  if (query.hasTerms && termMatches.some((match) => !match)) {
    return null;
  }

  let score = document.priority || 0;
  let bestField = termMatches
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort((a, b) => b.score - a.score)[0] || null;

  for (const match of termMatches) {
    if (!match) continue;
    score += match.score;
  }

  if (query.terms.length > 1 && query.normalizedPhrase) {
    for (const field of document.fields) {
      if (!field.normalizedSearchText.includes(query.normalizedPhrase)) continue;
      const phraseScore = field.weight * 6 + query.normalizedPhrase.length;
      score += phraseScore;
      if (!bestField || phraseScore > bestField.score) {
        bestField = {
          field,
          kind: 'substring',
          score: phraseScore,
        };
      }
      break;
    }
  }

  if (!query.hasTerms && query.hasFilters) {
    score += 6;
  }

  if (!query.hasTerms && !query.hasFilters && document.kind === 'page') {
    score += 12;
  }

  const highlightTerms = getHighlightPatterns(query);
  return {
    score,
    reason: bestField ? describeMatch(bestField.kind, bestField.field.label) : 'Matched filters',
    matchedFieldLabel: bestField?.field.label || null,
    bestFieldKey: bestField?.field.key || null,
    bestFieldText: bestField?.field.text || null,
    highlightTerms,
  };
}

export function searchDocuments<TDocument extends SearchDocument>(
  documents: TDocument[],
  rawQuery: string,
  options?: { limit?: number }
): { query: ParsedSearchQuery; results: SearchMatchResult<TDocument>[] } {
  const query = parseSearchQuery(rawQuery);

  const results = documents
    .map((document) => {
      const match = scoreSearchDocument(document, query);
      return match ? { document, match } : null;
    })
    .filter((entry): entry is SearchMatchResult<TDocument> => Boolean(entry))
    .sort((a, b) => {
      if (b.match.score !== a.match.score) return b.match.score - a.match.score;
      if ((b.document.priority || 0) !== (a.document.priority || 0)) {
        return (b.document.priority || 0) - (a.document.priority || 0);
      }
      return a.document.title.localeCompare(b.document.title);
    });

  return {
    query,
    results: typeof options?.limit === 'number' ? results.slice(0, options.limit) : results,
  };
}

export function buildHighlightParts(text: string, patterns: string[]): SearchHighlightPart[] {
  if (!text) return [{ text: '' }];

  const normalizedPatterns = uniq(
    patterns
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern.length > 1 || /^\d+$/.test(pattern))
      .sort((a, b) => b.length - a.length)
  );

  if (!normalizedPatterns.length) return [{ text }];

  const lower = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];

  for (const pattern of normalizedPatterns) {
    const lowerPattern = pattern.toLowerCase();
    let startIndex = 0;

    while (startIndex < lower.length) {
      const matchIndex = lower.indexOf(lowerPattern, startIndex);
      if (matchIndex < 0) break;
      ranges.push({ start: matchIndex, end: matchIndex + lowerPattern.length });
      startIndex = matchIndex + lowerPattern.length;
    }
  }

  if (!ranges.length) return [{ text }];

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    last.end = Math.max(last.end, range.end);
  }

  const parts: SearchHighlightPart[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start) });
    }
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }

  return parts;
}

export function truncateSearchText(value: string, maxLength = 140): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function toSearchApiResult(
  result: SearchMatchResult,
  query: ParsedSearchQuery
): SearchApiResult {
  const { document, match } = result;
  const highlightTerms = match.highlightTerms.length > 0 ? match.highlightTerms : getHighlightPatterns(query);

  const bestFieldSnippet =
    match.bestFieldText &&
    match.bestFieldText !== document.title &&
    match.bestFieldText !== document.subtitle
      ? truncateSearchText(match.bestFieldText, 160)
      : document.snippet
        ? truncateSearchText(document.snippet, 160)
        : undefined;

  return {
    id: document.id,
    kind: document.kind,
    group: document.group,
    href: document.href,
    title: document.title,
    subtitle: document.subtitle,
    snippet: bestFieldSnippet,
    badges: document.badges,
    imageUrl: document.imageUrl,
    imagePixelated: document.imagePixelated,
    score: match.score,
    reason: match.reason,
    titleHighlights: buildHighlightParts(document.title, highlightTerms),
    subtitleHighlights: buildHighlightParts(document.subtitle, highlightTerms),
    snippetHighlights: bestFieldSnippet ? buildHighlightParts(bestFieldSnippet, highlightTerms) : undefined,
  };
}

export const SEARCH_OPERATOR_HINTS = [
  'id:10',
  'face:white_tiger',
  'va:hanazawa',
  'type:equipment',
  'source:event',
  'rarity:5',
  'has:img',
  'missing:bgm',
] as const;
