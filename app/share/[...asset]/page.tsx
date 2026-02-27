import type { Metadata } from 'next';
import Image from 'next/image';
import { cache } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);

type SearchParamValue = string | string[] | undefined;
type AssetKind = 'audio' | 'image' | 'video' | 'file';

type SharePageProps = {
  // App Router supplies these as plain objects; some people type them as Promises.
  // Your existing code expects Promises, so keep that shape.
  params: Promise<{ asset?: string[] }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
};

type AssetProbe = {
  exists: boolean;
  contentType: string | null;
  contentLength: number | null;
};

type ShareContext = {
  segments: string[];
  assetPath: string;
  assetUrl: string;

  sharePath: string;
  shareUrl: string;

  fileName: string;
  baseName: string;
  extension: string;

  kind: AssetKind;
  mimeType: string | null;

  exists: boolean;
  contentType: string | null;
  contentLength: number | null;

  title: string;
  description: string;
  previewImage: string | null;
};

function getSiteBaseUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      // ignore
    }
  }
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL('http://localhost:3000');
}

function getFirstParam(value: SearchParamValue): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizeAssetSegments(rawSegments: string[] | undefined): string[] | null {
  if (!rawSegments || rawSegments.length === 0) return null;

  const normalized: string[] = [];
  for (const raw of rawSegments) {
    const decoded = safeDecodeSegment(raw).replace(/\\/g, '/');
    const parts = decoded
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      if (part === '.' || part === '..') return null;
      normalized.push(part);
    }
  }

  return normalized.length > 0 ? normalized : null;
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

function classifyByExtension(extension: string): AssetKind {
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  return 'file';
}

function classifyByContentType(contentType: string | null): AssetKind | null {
  if (!contentType) return null;
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  return 'file';
}

function guessMimeType(extension: string): string | null {
  if (!extension) return null;
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'jpg') return 'image/jpeg';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'm4a') return 'audio/mp4';
  if (extension === 'ogv') return 'video/ogg';
  if (extension === 'mov') return 'video/quicktime';
  // fallback
  const kind = classifyByExtension(extension);
  if (kind === 'file') return null;
  return `${kind}/${extension}`;
}

function toDisplayLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTextOverride(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveOptionalUrl(value: string | null): string | null {
  const trimmed = parseTextOverride(value);
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const normalized = trimmed.replace(/^\/+/, '');
  return `${CDN_ROOT}/${normalized}`;
}

function formatBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

// NOTE: This probe is only for your UI badges.
// Discord itself will fetch your CDN URL; your HEAD tags (in head.tsx) are what matters for embeds.
const probeAsset = cache(async (assetUrl: string): Promise<AssetProbe> => {
  try {
    let response = await fetch(assetUrl, {
      method: 'HEAD',
      redirect: 'follow',
      next: { revalidate: 900 },
    });

    // Some CDNs disable HEAD; fallback to a 1-byte range GET
    if (!response.ok && response.status === 405) {
      response = await fetch(assetUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        next: { revalidate: 900 },
      });
    }

    if (!response.ok) return { exists: false, contentType: null, contentLength: null };

    const contentTypeHeader = response.headers.get('content-type');
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength =
      contentLengthHeader && Number.isFinite(Number(contentLengthHeader))
        ? Number(contentLengthHeader)
        : null;

    return {
      exists: true,
      contentType: contentTypeHeader ? contentTypeHeader.split(';')[0].toLowerCase() : null,
      contentLength,
    };
  } catch {
    return { exists: false, contentType: null, contentLength: null };
  }
});

async function resolveShareContext(props: SharePageProps): Promise<ShareContext | null> {
  const [{ asset }, searchParams] = await Promise.all([props.params, props.searchParams]);

  const segments = normalizeAssetSegments(asset);
  if (!segments) return null;

  const siteBaseUrl = getSiteBaseUrl();
  const assetPath = segments.join('/');
  const assetUrl = `${CDN_ROOT}/${assetPath}`;

  const sharePath = `/share/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
  const shareUrl = new URL(sharePath, siteBaseUrl).toString();

  const fileName = segments[segments.length - 1];
  const extension = getExtension(fileName);
  const baseName = extension ? fileName.slice(0, -(extension.length + 1)) : fileName;

  const [probe, titleOverride, descriptionOverride, imageOverrideRaw] = await Promise.all([
    probeAsset(assetUrl),
    Promise.resolve(parseTextOverride(getFirstParam(searchParams.title))),
    Promise.resolve(parseTextOverride(getFirstParam(searchParams.description))),
    Promise.resolve(getFirstParam(searchParams.image)),
  ]);

  const extensionKind = classifyByExtension(extension);
  const contentTypeKind = classifyByContentType(probe.contentType);
  const kind = contentTypeKind || extensionKind;

  const mimeType = probe.contentType || guessMimeType(extension);

  const title = titleOverride || `${toDisplayLabel(baseName) || baseName} · WF Share`;
  const kindLabel =
    kind === 'audio'
      ? 'audio asset'
      : kind === 'image'
        ? 'image asset'
        : kind === 'video'
          ? 'video asset'
          : 'file asset';
  const description = descriptionOverride || `Shared ${kindLabel} from CDN: ${assetPath}`;

  const imageOverride = resolveOptionalUrl(imageOverrideRaw);

  // Better default image than favicon for Discord cards:
  // Put a real 1200x630 image at /share-default.png in /public if you want.
  const defaultShareImage = new URL('/share-default.png', siteBaseUrl).toString();
  const defaultImage = kind === 'image' ? assetUrl : defaultShareImage;

  const previewImage = imageOverride || defaultImage;

  return {
    segments,
    assetPath,
    assetUrl,
    sharePath,
    shareUrl,
    fileName,
    baseName,
    extension,
    kind,
    mimeType,
    exists: probe.exists,
    contentType: probe.contentType,
    contentLength: probe.contentLength,
    title,
    description,
    previewImage,
  };
}

export async function generateMetadata(props: SharePageProps): Promise<Metadata> {
  const context = await resolveShareContext(props);

  if (!context) {
    return {
      title: 'Invalid Share Link',
      description: 'The requested shared asset link is invalid.',
      robots: { index: false, follow: false },
    };
  }

  const baseMetadata = {
    title: context.title,
    description: context.description,
    alternates: { canonical: context.sharePath },
  } satisfies Pick<Metadata, 'title' | 'description' | 'alternates'>;

  // IMPORTANT:
  // Discord is most reliable with explicit OG meta tags for audio (og:audio + og:audio:type),
  // which you should inject in app/share/[...asset]/head.tsx.
  // So here, keep the OG card (title/desc/image/url), but don't depend on openGraph.audio.
  if (context.kind === 'audio') {
    return {
      ...baseMetadata,
      openGraph: {
        type: 'music.song',
        title: context.title,
        description: context.description,
        url: context.shareUrl,
        siteName: 'World Flipper Share',
        images: context.previewImage ? [{ url: context.previewImage, alt: context.title }] : undefined,
      },
      twitter: {
        // Discord ignores twitter player cards; use a normal card.
        card: 'summary_large_image',
        title: context.title,
        description: context.description,
        images: context.previewImage ? [context.previewImage] : undefined,
      },
    };
  }

  if (context.kind === 'video') {
    return {
      ...baseMetadata,
      openGraph: {
        type: 'video.other',
        title: context.title,
        description: context.description,
        url: context.shareUrl,
        siteName: 'World Flipper Share',
        images: context.previewImage ? [{ url: context.previewImage, alt: context.title }] : undefined,
        videos: [{ url: context.assetUrl, type: context.mimeType || 'video/mp4' }],
      },
      twitter: {
        card: 'player',
        title: context.title,
        description: context.description,
        images: context.previewImage ? [context.previewImage] : undefined,
        players: [
          {
            playerUrl: context.shareUrl,
            streamUrl: context.assetUrl,
            width: 1280,
            height: 720,
          },
        ],
      },
    };
  }

  if (context.kind === 'image') {
    return {
      ...baseMetadata,
      openGraph: {
        type: 'website',
        title: context.title,
        description: context.description,
        url: context.shareUrl,
        siteName: 'World Flipper Share',
        images: [{ url: context.assetUrl, alt: context.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: context.title,
        description: context.description,
        images: [context.assetUrl],
      },
    };
  }

  return {
    ...baseMetadata,
    openGraph: {
      type: 'website',
      title: context.title,
      description: context.description,
      url: context.shareUrl,
      siteName: 'World Flipper Share',
      images: context.previewImage ? [{ url: context.previewImage, alt: context.title }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: context.title,
      description: context.description,
      images: context.previewImage ? [context.previewImage] : undefined,
    },
  };
}

export default async function ShareAssetPage(props: SharePageProps) {
  const context = await resolveShareContext(props);

  if (!context) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Invalid Share Link</CardTitle>
              <CardDescription>This share URL does not contain a valid asset path.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const sizeLabel = formatBytes(context.contentLength);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.07),transparent_45%)] p-4 pb-8 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <Card className="border-border/60 bg-background/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="break-all text-xl">{context.title}</CardTitle>
            <CardDescription className="break-all">{context.description}</CardDescription>

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">{context.kind}</Badge>
              {context.mimeType && <Badge variant="outline">{context.mimeType}</Badge>}
              {sizeLabel && <Badge variant="outline">{sizeLabel}</Badge>}
              <Badge variant={context.exists ? 'secondary' : 'outline'}>
                {context.exists ? 'Available' : 'Not Found'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="rounded-md border bg-muted/20 p-2 font-mono text-xs text-muted-foreground">
              {context.assetPath}
            </p>

            <div className="rounded-lg border bg-background/60 p-3">
              {context.kind === 'image' ? (
                <div className="flex justify-center">
                  <Image
                    src={context.assetUrl}
                    alt={context.title}
                    width={1600}
                    height={900}
                    unoptimized
                    className="h-auto max-h-[70vh] w-auto max-w-full rounded-md border bg-muted/20"
                  />
                </div>
              ) : context.kind === 'audio' ? (
                <audio controls preload="metadata" className="w-full">
                  <source src={context.assetUrl} type={context.mimeType || 'audio/mpeg'} />
                </audio>
              ) : context.kind === 'video' ? (
                <video controls preload="metadata" className="max-h-[70vh] w-full rounded-md border bg-black">
                  <source src={context.assetUrl} type={context.mimeType || 'video/mp4'} />
                </video>
              ) : (
                <p className="text-sm text-muted-foreground">Preview is not available for this file type.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={context.assetUrl} target="_blank" rel="noopener noreferrer">
                <Button>Open CDN File</Button>
              </a>
              <a href={context.shareUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">Open Share URL</Button>
              </a>
            </div>

            {context.kind === 'audio' && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Discord embed note</p>
                <p className="mt-1">
                  For Discord to reliably detect audio, add <span className="font-mono">og:audio</span> tags in{' '}
                  <span className="font-mono">app/share/[...asset]/head.tsx</span>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}