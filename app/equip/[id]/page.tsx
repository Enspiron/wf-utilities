import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ItemDetailPage from '@/components/item-detail-page';
import { getItemDetailData } from '@/lib/item-catalog';

type EquipmentDetailRouteProps = {
  params: Promise<{ id: string }>;
};

const SITE_NAME = 'World Flipper Tools';

const getSiteBaseUrl = (): URL => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      // Ignore malformed env and fallback.
    }
  }

  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }

  return new URL('http://localhost:3000');
};

export async function generateMetadata({ params }: EquipmentDetailRouteProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getItemDetailData('equipment', id);
  if (!detail) {
    return {
      title: 'Equipment Not Found - World Flipper Tools',
      description: 'The requested equipment could not be found.',
    };
  }

  const imageUrl = detail.imageCandidates[0];
  const canonicalPath = `/equip/${encodeURIComponent(detail.entry.id)}`;
  const canonicalUrl = new URL(canonicalPath, getSiteBaseUrl()).toString();
  const title = `${detail.entry.name} - Equipment`;
  const description = (detail.entry.description || detail.entry.flavorText || 'World Flipper equipment detail.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const faviconUrl = imageUrl ? `/api/assets/image?url=${encodeURIComponent(imageUrl)}` : '/favicon.ico';

  return {
    title: `${title} - ${SITE_NAME}`,
    description,
    alternates: { canonical: canonicalPath },
    icons: {
      icon: [
        { url: faviconUrl, type: 'image/png', sizes: '32x32' },
        { url: faviconUrl, type: 'image/png', sizes: '192x192' },
      ],
      apple: [{ url: faviconUrl }],
      shortcut: [faviconUrl],
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: imageUrl ? [{ url: imageUrl, alt: detail.entry.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function EquipmentDetailRoute({ params }: EquipmentDetailRouteProps) {
  const { id } = await params;
  const detail = await getItemDetailData('equipment', id);
  if (!detail) {
    notFound();
  }

  return <ItemDetailPage routeKind='equipment' detail={detail} />;
}

