import { NextRequest, NextResponse } from 'next/server';
import { normalizeFeatureTimeline } from '@/lib/feature-timeline/normalize';
import type { TimelineLang } from '@/lib/feature-timeline/types';
import { DATA_CACHE_HEADERS } from '@/lib/data-source';

export const revalidate = 3600;

function getLangParam(value: string | null): TimelineLang {
  return value === 'jp' ? 'jp' : 'en';
}

export async function GET(request: NextRequest) {
  try {
    const lang = getLangParam(request.nextUrl.searchParams.get('lang'));
    const payload = await normalizeFeatureTimeline(lang);
    return NextResponse.json(payload, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load feature timeline.';
    return NextResponse.json(
      {
        lang: 'en',
        generatedAt: new Date().toISOString(),
        counts: {
          total: 0,
          feature_banner: 0,
          feature_announcement: 0,
          feature_guide_dialog: 0,
          live: 0,
          upcoming: 0,
          ended: 0,
          unknown: 0,
        },
        entries: [],
        partialWarnings: [message],
      },
      { status: 500 }
    );
  }
}
