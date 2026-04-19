export const ASSET_CDN_ROOT = 'https://wfjukebox.b-cdn.net';
export const MUSIC_CDN_ROOT = `${ASSET_CDN_ROOT}/music`;

export const DIRECTORY_LIKE_RE = /https?:\/\/[^\s"'`]+|\/?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/g;
export const BGM_PATH_RE = /\/?bgm\/[A-Za-z0-9._/-]+/gi;

export function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(value);
}

export function hasAudioExtension(value: string): boolean {
  return /\.(mp3|ogg|wav|m4a)$/i.test(value);
}

export function normalizeAssetPath(value: string): string {
  let normalized = value
    .trim()
    .replace(/\\/g, '/')
    .split(/[?#]/)[0]
    .replace(/[),.;]+$/, '');

  if (normalized.startsWith(ASSET_CDN_ROOT)) {
    normalized = normalized.slice(ASSET_CDN_ROOT.length);
  }

  const assetsIndex = normalized.toLowerCase().lastIndexOf('/assets/');
  if (assetsIndex >= 0) {
    normalized = normalized.slice(assetsIndex + '/assets/'.length);
  }

  return normalized
    .replace(/^\/+/, '')
    .replace(/^assets\//i, '');
}

export function buildImageUrlFromPath(pathValue?: string): string {
  if (!pathValue) return '';
  if ((pathValue.startsWith('http://') || pathValue.startsWith('https://')) && !pathValue.startsWith(ASSET_CDN_ROOT)) {
    return pathValue;
  }
  const normalized = normalizeAssetPath(pathValue);
  return `${ASSET_CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
}

export function buildBgmUrlFromPath(pathValue?: string): string {
  if (!pathValue) return '';
  if ((pathValue.startsWith('http://') || pathValue.startsWith('https://')) && !pathValue.startsWith(ASSET_CDN_ROOT)) {
    return pathValue;
  }
  const normalized = normalizeAssetPath(pathValue);
  return `${ASSET_CDN_ROOT}/${hasAudioExtension(normalized) ? normalized : `${normalized}.mp3`}`;
}

export function extractDirectoryLikeTokens(input: string): string[] {
  const matches = input.match(DIRECTORY_LIKE_RE) || [];
  return matches.map((token) => token.replace(/[),.;]+$/, '').trim()).filter((token) => token.includes('/'));
}

export function collectImageCandidatesFromRaw(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    for (const token of extractDirectoryLikeTokens(value)) out.add(buildImageUrlFromPath(token));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageCandidatesFromRaw(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectImageCandidatesFromRaw(item, out);
    }
  }
}

export function extractBgmTokens(input: string): string[] {
  const matches = input.match(BGM_PATH_RE) || [];
  return matches.map((token) => token.replace(/[),.;]+$/, '').trim()).filter(Boolean);
}

export function collectBgmCandidatesFromRaw(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    for (const token of extractBgmTokens(value)) out.add(buildBgmUrlFromPath(token));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectBgmCandidatesFromRaw(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectBgmCandidatesFromRaw(item, out);
    }
  }
}

export function buildMusicFallbackUrls(
  pathValue: string,
  options: { includePrimary?: boolean } = {}
): string[] {
  const path = normalizeAssetPath(pathValue).replace(/\.mp3$/i, '');
  const result: string[] = [];

  if (options.includePrimary !== false) {
    result.push(buildBgmUrlFromPath(path));
  }

  if (path.startsWith('bgm/world_')) {
    result.push(`${MUSIC_CDN_ROOT}/StoryBGM/${path.replace(/^bgm\//, '')}.mp3`);
  } else if (path.startsWith('bgm/event/')) {
    result.push(`${MUSIC_CDN_ROOT}/${path.replace(/^bgm\//, '')}.mp3`);
  } else if (path.startsWith('bgm/common/')) {
    result.push(`${MUSIC_CDN_ROOT}/${path.replace(/^bgm\//, '')}.mp3`);
  } else if (path.startsWith('bgm/')) {
    result.push(`${MUSIC_CDN_ROOT}/${path.replace(/^bgm\//, '')}.mp3`);
  } else if (options.includePrimary === false) {
    result.push(buildBgmUrlFromPath(path));
  }

  return [...new Set(result.filter(Boolean))];
}
