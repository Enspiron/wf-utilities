export type TimelineLang = 'en' | 'jp';
export type TimelineSource = 'feature_banner' | 'feature_announcement' | 'feature_guide_dialog';
export type TimelineStatus = 'live' | 'upcoming' | 'ended' | 'unknown';
export type TimelineCategory =
  | 'gacha'
  | 'event'
  | 'campaign'
  | 'comic'
  | 'payment'
  | 'system'
  | 'survey'
  | 'other';

export interface FeatureTimelineRefs {
  internalId: string | null;
  bannerKey: string | null;
  targetRef: string | null;
}

export interface FeatureTimelineRecurrenceHints {
  startHint: string | null;
  endHint: string | null;
}

export interface FeatureTimelineEntry {
  uid: string;
  source: TimelineSource;
  rowKey: string;
  sourceFile: string;
  lang: TimelineLang;
  title: string;
  subtitle: string;
  description: string | null;
  imagePath: string | null;
  imageUrlCandidates: string[];
  startAt: string | null;
  endAt: string | null;
  status: TimelineStatus;
  durationDays: number | null;
  isPersistent: boolean;
  isScheduled: boolean;
  category: TimelineCategory;
  tags: string[];
  priorityCode: string | null;
  refs: FeatureTimelineRefs;
  raw: unknown;
  parseWarnings: string[];
  recurrenceHints?: FeatureTimelineRecurrenceHints | null;
}

export interface FeatureTimelineCounts {
  total: number;
  feature_banner: number;
  feature_announcement: number;
  feature_guide_dialog: number;
  live: number;
  upcoming: number;
  ended: number;
  unknown: number;
}

export interface FeatureTimelinePayload {
  lang: TimelineLang;
  generatedAt: string;
  counts: FeatureTimelineCounts;
  entries: FeatureTimelineEntry[];
  partialWarnings: string[];
}
