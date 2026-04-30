export const COMMUNITY_FEATURES_ENABLED = false;

export const COMMUNITY_UI_PATH_PREFIXES = [
  '/community',
  '/profile',
  '/saves',
  '/login',
  '/register',
] as const;

export const COMMUNITY_API_PATH_PREFIXES = [
  '/api/auth',
  '/api/community',
  '/api/moderation',
  '/api/profile',
  '/api/reports',
  '/api/save-shares',
] as const;

function hasPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isCommunityRouteDisabled(pathname: string): boolean {
  return !COMMUNITY_FEATURES_ENABLED && hasPathPrefix(pathname, COMMUNITY_UI_PATH_PREFIXES);
}

export function isCommunityApiRouteDisabled(pathname: string): boolean {
  return !COMMUNITY_FEATURES_ENABLED && hasPathPrefix(pathname, COMMUNITY_API_PATH_PREFIXES);
}
