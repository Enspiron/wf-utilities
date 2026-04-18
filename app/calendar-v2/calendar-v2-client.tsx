'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock3,
  Database,
  FileJson,
  ImageIcon,
  ImageOff,
  Languages,
  LayoutGrid,
  ListFilter,
  Loader2,
  Music4,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  Table2,
  Volume2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type EventType = 'reward' | 'stamina' | 'challenge' | 'gacha' | 'active_mission' | 'login_bonus' | 'quest';
type EventStatus = 'live' | 'upcoming' | 'ended';
type CalendarView = 'timeline' | 'month' | 'table';
type AssetFilter = 'all' | 'has-images' | 'missing-images';
type AudioFilter = 'all' | 'has-bgm';
type SortMode = 'start-asc' | 'start-desc' | 'title-asc' | 'duration-desc' | 'source-asc';
type DateConfidence = 'exact' | 'inferred' | 'fallback';
type DetailTab = 'summary' | 'images' | 'audio' | 'fields' | 'json';
type QuestCategory =
  | 'gacha_banner'
  | 'advent_event'
  | 'carnival_event'
  | 'raid_event'
  | 'ranking_event'
  | 'single_quest'
  | 'rush_event'
  | 'story_event'
  | 'world_story_event'
  | 'other';

type RawApiPayload = {
  data?: Record<string, unknown>;
};

type CalendarEvent = {
  id: string;
  type: EventType;
  questCategory: QuestCategory | null;
  title: string;
  titleJp: string;
  startAt: Date;
  endAt: Date;
  data: Record<string, unknown>;
  sourceFile: string;
  dateConfidence: DateConfidence;
  dateNote: string;
};

type ParseResult = {
  events: CalendarEvent[];
  missingDateCount: number;
};

type CalendarSettings = {
  view: CalendarView;
  lang: 'en' | 'jp';
  q: string;
  status: EventStatus | 'all';
  type: EventType | 'all';
  quest: QuestCategory | 'all';
  source: string;
  asset: AssetFilter;
  audio: AudioFilter;
  confidence: DateConfidence | 'all';
  sort: SortMode;
  day: string;
  page: number;
  event: string;
};

type AssetSummary = {
  imageCandidates: string[];
  bgmCandidates: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 90;
const DATE_RE = /\b\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?\b/;
const MIN_VALID_DATE = new Date('2003-01-01T00:00:00Z');
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const DIRECTORY_LIKE_RE = /https?:\/\/[^\s"'`]+|\/?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/g;
const BGM_PATH_RE = /\/?bgm\/[A-Za-z0-9._/-]+/gi;

const DEFAULT_SETTINGS: CalendarSettings = {
  view: 'timeline',
  lang: 'en',
  q: '',
  status: 'all',
  type: 'all',
  quest: 'all',
  source: 'all',
  asset: 'all',
  audio: 'all',
  confidence: 'all',
  sort: 'start-desc',
  day: '',
  page: 1,
  event: '',
};

const TYPE_OPTIONS: Array<{ value: EventType | 'all'; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'quest', label: 'Quest' },
  { value: 'gacha', label: 'Gacha' },
  { value: 'reward', label: 'Reward' },
  { value: 'stamina', label: 'Stamina' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'active_mission', label: 'Mission' },
  { value: 'login_bonus', label: 'Login bonus' },
];

const QUEST_CATEGORY_OPTIONS: Array<{ value: QuestCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All quest categories' },
  { value: 'gacha_banner', label: 'Gacha banner' },
  { value: 'advent_event', label: 'Advent event' },
  { value: 'carnival_event', label: 'Carnival event' },
  { value: 'raid_event', label: 'Raid event' },
  { value: 'ranking_event', label: 'Ranking event' },
  { value: 'single_quest', label: 'Single quest' },
  { value: 'rush_event', label: 'Rush event' },
  { value: 'story_event', label: 'Story event' },
  { value: 'world_story_event', label: 'World story' },
  { value: 'other', label: 'Other quest' },
];

const STATUS_OPTIONS: Array<{ value: EventStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All status' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
];

const CONFIDENCE_OPTIONS: Array<{ value: DateConfidence | 'all'; label: string }> = [
  { value: 'all', label: 'Any date confidence' },
  { value: 'exact', label: 'Exact fields' },
  { value: 'inferred', label: 'Inferred from raw' },
  { value: 'fallback', label: 'Fallback range' },
];

function getParam(params: Pick<URLSearchParams, 'get'>, key: string): string {
  return params.get(key)?.trim() || '';
}

function normalizeSettings(settings: CalendarSettings): CalendarSettings {
  return {
    ...settings,
    view: ['timeline', 'month', 'table'].includes(settings.view) ? settings.view : DEFAULT_SETTINGS.view,
    lang: settings.lang === 'jp' ? 'jp' : 'en',
    status: ['all', 'live', 'upcoming', 'ended'].includes(settings.status) ? settings.status : 'all',
    type: TYPE_OPTIONS.some((option) => option.value === settings.type) ? settings.type : 'all',
    quest: QUEST_CATEGORY_OPTIONS.some((option) => option.value === settings.quest) ? settings.quest : 'all',
    source: settings.source || 'all',
    asset: ['all', 'has-images', 'missing-images'].includes(settings.asset) ? settings.asset : 'all',
    audio: settings.audio === 'has-bgm' ? 'has-bgm' : 'all',
    confidence: CONFIDENCE_OPTIONS.some((option) => option.value === settings.confidence) ? settings.confidence : 'all',
    sort: ['start-asc', 'start-desc', 'title-asc', 'duration-desc', 'source-asc'].includes(settings.sort)
      ? settings.sort
      : 'start-desc',
    page: Number.isFinite(settings.page) && settings.page > 0 ? Math.floor(settings.page) : 1,
  };
}

function settingsFromParams(params: Pick<URLSearchParams, 'get'>): CalendarSettings {
  return normalizeSettings({
    view: (getParam(params, 'view') as CalendarView) || DEFAULT_SETTINGS.view,
    lang: (getParam(params, 'lang') as 'en' | 'jp') || DEFAULT_SETTINGS.lang,
    q: getParam(params, 'q'),
    status: (getParam(params, 'status') as EventStatus | 'all') || 'all',
    type: (getParam(params, 'type') as EventType | 'all') || 'all',
    quest: (getParam(params, 'quest') as QuestCategory | 'all') || 'all',
    source: getParam(params, 'source') || 'all',
    asset: (getParam(params, 'asset') as AssetFilter) || 'all',
    audio: (getParam(params, 'audio') as AudioFilter) || 'all',
    confidence: (getParam(params, 'confidence') as DateConfidence | 'all') || 'all',
    sort: (getParam(params, 'sort') as SortMode) || DEFAULT_SETTINGS.sort,
    day: getParam(params, 'day'),
    page: Number.parseInt(getParam(params, 'page') || '1', 10),
    event: getParam(params, 'event'),
  });
}

function encodeSettings(settings: CalendarSettings): string {
  const params = new URLSearchParams();
  if (settings.view !== DEFAULT_SETTINGS.view) params.set('view', settings.view);
  if (settings.lang !== DEFAULT_SETTINGS.lang) params.set('lang', settings.lang);
  if (settings.q) params.set('q', settings.q);
  if (settings.status !== 'all') params.set('status', settings.status);
  if (settings.type !== 'all') params.set('type', settings.type);
  if (settings.quest !== 'all') params.set('quest', settings.quest);
  if (settings.source !== 'all') params.set('source', settings.source);
  if (settings.asset !== 'all') params.set('asset', settings.asset);
  if (settings.audio !== 'all') params.set('audio', settings.audio);
  if (settings.confidence !== 'all') params.set('confidence', settings.confidence);
  if (settings.sort !== DEFAULT_SETTINGS.sort) params.set('sort', settings.sort);
  if (settings.day) params.set('day', settings.day);
  if (settings.page > 1) params.set('page', String(settings.page));
  if (settings.event) params.set('event', settings.event);
  return params.toString();
}

function getEventKey(event: CalendarEvent): string {
  return `${event.type}::${event.id}::${event.sourceFile}`;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateToken(value: string): Date | null {
  const match = value.match(DATE_RE);
  if (!match) return null;
  return parseDate(match[0]);
}

function parseDayParam(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
}

function formatDayParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|svg|gif)$/i.test(value);
}

function buildImageUrlFromPath(pathValue: string): string {
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) return pathValue;
  const normalized = pathValue.replace(/^\/+/, '');
  return `${CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
}

function extractDirectoryLikeTokens(input: string): string[] {
  const matches = input.match(DIRECTORY_LIKE_RE) || [];
  return matches.map((token) => token.replace(/[),.;]+$/, '').trim()).filter((token) => token.includes('/'));
}

function collectImageCandidatesFromRaw(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    for (const token of extractDirectoryLikeTokens(value)) out.add(buildImageUrlFromPath(token));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageCandidatesFromRaw(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectImageCandidatesFromRaw(item, out);
  }
}

function getGachaBannerImageUrl(event: CalendarEvent): string | null {
  if (event.type !== 'gacha') return null;
  const raw = event.data.raw;
  if (!Array.isArray(raw)) return null;
  const bannerPath = raw[3];
  if (typeof bannerPath !== 'string' || !bannerPath.trim() || bannerPath === '(None)') return null;
  return buildImageUrlFromPath(bannerPath.trim());
}

function getEventPreviewImageCandidates(event: CalendarEvent): string[] {
  const ordered = new Set<string>();
  const gachaBanner = getGachaBannerImageUrl(event);
  if (gachaBanner) ordered.add(gachaBanner);
  const candidates = new Set<string>();
  collectImageCandidatesFromRaw(event.data, candidates);
  for (const url of candidates) {
    if (/\/bgm\//i.test(url)) continue;
    ordered.add(url);
  }
  return [...ordered].slice(0, 16);
}

function hasAudioExtension(value: string): boolean {
  return /\.(mp3|ogg|wav|m4a)$/i.test(value);
}

function buildBgmUrlFromPath(pathValue: string): string {
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) return pathValue;
  const normalized = pathValue.replace(/^\/+/, '');
  return `${CDN_ROOT}/${hasAudioExtension(normalized) ? normalized : `${normalized}.mp3`}`;
}

function extractBgmTokens(input: string): string[] {
  const matches = input.match(BGM_PATH_RE) || [];
  return matches.map((token) => token.replace(/[),.;]+$/, '').trim());
}

function collectBgmCandidatesFromRaw(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    for (const token of extractBgmTokens(value)) out.add(buildBgmUrlFromPath(token));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectBgmCandidatesFromRaw(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectBgmCandidatesFromRaw(item, out);
  }
}

function getAssetSummary(event: CalendarEvent): AssetSummary {
  const bgmCandidates = new Set<string>();
  collectBgmCandidatesFromRaw(event.data, bgmCandidates);
  return {
    imageCandidates: getEventPreviewImageCandidates(event),
    bgmCandidates: [...bgmCandidates].slice(0, 16),
  };
}

function isSaneDateRange(startAt: Date, endAt: Date): boolean {
  if (endAt.getTime() < startAt.getTime()) return false;
  const sy = startAt.getFullYear();
  const ey = endAt.getFullYear();
  if (sy < MIN_VALID_DATE.getFullYear() || sy >= 2100) return false;
  if (ey < MIN_VALID_DATE.getFullYear() || ey >= 2100) return false;
  return true;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getEventStatus(event: CalendarEvent, now: Date): EventStatus {
  const nowMs = now.getTime();
  if (nowMs < event.startAt.getTime()) return 'upcoming';
  if (nowMs > event.endAt.getTime()) return 'ended';
  return 'live';
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getTypeColor(type: EventType): string {
  switch (type) {
    case 'quest':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/25';
    case 'reward':
      return 'bg-sky-500/10 text-sky-600 border-sky-500/25';
    case 'stamina':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
    case 'challenge':
      return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25';
    case 'gacha':
      return 'bg-pink-500/10 text-pink-600 border-pink-500/25';
    case 'active_mission':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/25';
    case 'login_bonus':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/25';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getStatusColor(status: EventStatus): string {
  switch (status) {
    case 'live':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
    case 'upcoming':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/25';
    case 'ended':
      return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getConfidenceColor(confidence: DateConfidence): string {
  switch (confidence) {
    case 'exact':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
    case 'inferred':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/25';
    case 'fallback':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/25';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getQuestCategoryFromSourceFile(file: string): QuestCategory {
  const lower = file.toLowerCase();
  if (lower.includes('world_story_event')) return 'world_story_event';
  if (lower.includes('advent_event')) return 'advent_event';
  if (lower.includes('carnival')) return 'carnival_event';
  if (lower.startsWith('boss_battle/') || lower.includes('boss_battle')) return 'raid_event';
  if (lower.includes('raid_event')) return 'raid_event';
  if (lower.includes('ranking') || lower.includes('score_attack')) return 'ranking_event';
  if (lower.includes('single_quest') || lower.includes('single_event')) return 'single_quest';
  if (lower.includes('rush_event')) return 'rush_event';
  if (lower.includes('story_event')) return 'story_event';
  if (lower.includes('gacha') || lower.includes('pickup')) return 'gacha_banner';
  return 'other';
}

function isRelevantQuestFile(file: string): boolean {
  const lower = file.toLowerCase();
  return (
    lower.startsWith('event/') ||
    lower.startsWith('boss_battle/') ||
    lower.startsWith('practice/') ||
    lower.includes('_event') ||
    lower.includes('_quest') ||
    lower.includes('pickup') ||
    lower.includes('schedule') ||
    lower.includes('carnival') ||
    lower.includes('advent') ||
    lower.includes('raid') ||
    lower.includes('ranking') ||
    lower.includes('rush') ||
    lower.includes('story') ||
    lower.includes('single') ||
    lower.includes('gacha') ||
    lower.includes('banner')
  );
}

function getQuestCategoryLabel(category: QuestCategory): string {
  return QUEST_CATEGORY_OPTIONS.find((option) => option.value === category)?.label || category;
}

function formatDateRange(startAt: Date, endAt: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${startAt.toLocaleDateString(undefined, opts)} - ${endAt.toLocaleDateString(undefined, opts)}`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDurationDays(startAt: Date, endAt: Date): number {
  return Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS));
}

function makeEvent(input: Omit<CalendarEvent, 'dateConfidence' | 'dateNote'> & { dateConfidence?: DateConfidence; dateNote?: string }): CalendarEvent {
  return {
    ...input,
    dateConfidence: input.dateConfidence || 'exact',
    dateNote: input.dateNote || 'Dates came from explicit start/end fields.',
  };
}

function parseRewardEvents(data: Record<string, unknown>): ParseResult {
  const events: CalendarEvent[] = [];
  let missingDateCount = 0;
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[1]);
    const endAt = parseDate(row[2]);
    if (!startAt || !endAt) {
      missingDateCount += 1;
      continue;
    }
    events.push(makeEvent({
      id,
      type: 'reward',
      questCategory: null,
      title: safeString(row[0], `Reward ${id}`),
      titleJp: safeString(row[0], `Reward ${id}`),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'campaign/reward_campaign',
    }));
  }
  return { events, missingDateCount };
}

function parseStaminaEvents(data: Record<string, unknown>): ParseResult {
  const events: CalendarEvent[] = [];
  let missingDateCount = 0;
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[1]);
    const endAt = parseDate(row[2]);
    if (!startAt || !endAt) {
      missingDateCount += 1;
      continue;
    }
    events.push(makeEvent({
      id,
      type: 'stamina',
      questCategory: null,
      title: safeString(row[0], `Stamina ${id}`),
      titleJp: safeString(row[0], `Stamina ${id}`),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'campaign/stamina_campaign',
    }));
  }
  return { events, missingDateCount };
}

function parseChallengeEvents(data: Record<string, unknown>): ParseResult {
  const events: CalendarEvent[] = [];
  let missingDateCount = 0;
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[1]);
    const endAt = parseDate(row[2]);
    if (!startAt || !endAt) {
      missingDateCount += 1;
      continue;
    }
    events.push(makeEvent({
      id,
      type: 'challenge',
      questCategory: null,
      title: safeString(row[0], `Challenge ${id}`),
      titleJp: safeString(row[0], `Challenge ${id}`),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'campaign/daily_challenge_point_campaign',
    }));
  }
  return { events, missingDateCount };
}

function parseGachaEvents(data: Record<string, unknown>): ParseResult {
  const events: CalendarEvent[] = [];
  let missingDateCount = 0;
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[29]);
    const endAt = parseDate(row[30]);
    if (!startAt || !endAt) {
      missingDateCount += 1;
      continue;
    }
    events.push(makeEvent({
      id,
      type: 'gacha',
      questCategory: 'gacha_banner',
      title: safeString(row[1], safeString(row[0], `Gacha ${id}`)),
      titleJp: safeString(row[1], safeString(row[0], `Gacha ${id}`)),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'gacha/gacha',
    }));
  }
  return { events, missingDateCount };
}

function parseActiveMissionEvents(data: Record<string, unknown>): ParseResult {
  const events: CalendarEvent[] = [];
  let missingDateCount = 0;
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[14]);
    const explicitEnd = parseDate(row[15]);
    const endAt = explicitEnd ?? parseDate('2099-12-31 23:59:59');
    if (!startAt || !endAt) {
      missingDateCount += 1;
      continue;
    }
    events.push(makeEvent({
      id,
      type: 'active_mission',
      questCategory: null,
      title: safeString(row[0], `Mission ${id}`),
      titleJp: safeString(row[1], safeString(row[0], `Mission ${id}`)),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'active_mission/active_mission_event',
      dateConfidence: explicitEnd ? 'exact' : 'fallback',
      dateNote: explicitEnd
        ? 'Start and end came from active mission fields.'
        : 'Start came from active mission fields; end was missing and uses an open-ended fallback.',
    }));
  }
  return { events, missingDateCount };
}

function parseLoginBonusEvents(data: Record<string, unknown>): ParseResult {
  const events: CalendarEvent[] = [];
  let missingDateCount = 0;
  for (const [category, group] of Object.entries(data)) {
    if (!group || typeof group !== 'object') continue;
    for (const [id, row] of Object.entries(group as Record<string, unknown>)) {
      if (!Array.isArray(row)) continue;
      const startAt = parseDate(row[40]);
      const endAt = parseDate(row[41]);
      if (!startAt || !endAt) {
        missingDateCount += 1;
        continue;
      }
      events.push(makeEvent({
        id: `${category}_${id}`,
        type: 'login_bonus',
        questCategory: null,
        title: `Login Bonus - ${category}`,
        titleJp: `Login Bonus - ${category}`,
        startAt,
        endAt,
        data: { raw: row },
        sourceFile: 'bonus/login_bonus',
      }));
    }
  }
  return { events, missingDateCount };
}

function collectQuestDateRows(
  value: unknown,
  pathKey: string,
  out: Array<{ key: string; startAt: Date; endAt: Date; raw: unknown }>
) {
  if (Array.isArray(value)) {
    const dates = value.map((entry) => (typeof entry === 'string' ? parseDateToken(entry) : null)).filter((d): d is Date => !!d);
    if (dates.length >= 2) {
      const startAt = dates[0];
      const endAt = dates[1];
      if (isSaneDateRange(startAt, endAt)) out.push({ key: pathKey || 'entry', startAt, endAt, raw: value });
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextKey = pathKey ? `${pathKey}.${k}` : k;
      collectQuestDateRows(v, nextKey, out);
    }
  }
}

function isLikelyQuestTitleText(value: string): boolean {
  const text = value.trim();
  if (!text || text === '(None)') return false;
  if (text.length < 3 || text.length > 140) return false;
  if (/[\/_]/.test(text)) return false;
  if (/https?:\/\//i.test(text)) return false;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(text)) return false;
  if (/^[0-9.,:%+\- ]+$/.test(text)) return false;
  if (/^rich_text/i.test(text)) return false;
  if (/^[a-z0-9-]+$/i.test(text) && !/\s/.test(text) && !/[A-Z]/.test(text)) return false;
  return /[A-Za-z]/.test(text) || /[^\x00-\x7F]/.test(text);
}

function findTitleLikeString(raw: unknown): string | null {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: raw, depth: 0 }];
  let visited = 0;

  while (queue.length > 0 && visited < 400) {
    const current = queue.shift();
    if (!current) break;
    visited += 1;

    const { value, depth } = current;
    if (typeof value === 'string') {
      if (isLikelyQuestTitleText(value)) return value.trim();
      continue;
    }
    if (depth >= 3) continue;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 20)) queue.push({ value: item, depth: depth + 1 });
      continue;
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) queue.push({ value: item, depth: depth + 1 });
    }
  }

  return null;
}

function parseQuestEventsFromFile(file: string, data: Record<string, unknown>): ParseResult {
  const rows: Array<{ key: string; startAt: Date; endAt: Date; raw: unknown }> = [];
  collectQuestDateRows(data, '', rows);

  const shortName = file.split('/').pop() || file;
  const lowerFile = file.toLowerCase();
  const questCategory = getQuestCategoryFromSourceFile(file);

  function resolveQuestTitle(raw: unknown, key: string): string {
    const fallbackTitle = `${shortName} - ${key}`;
    if (!Array.isArray(raw)) return fallbackTitle;

    if (lowerFile.includes('quest_event')) {
      const questEventTitle = raw[1];
      if (typeof questEventTitle === 'string' && questEventTitle.trim() && questEventTitle !== '(None)') {
        return questEventTitle.trim();
      }
    }

    if (questCategory === 'world_story_event' || questCategory === 'story_event') {
      const worldStoryTitle = raw[2];
      if (typeof worldStoryTitle === 'string' && worldStoryTitle.trim() && worldStoryTitle !== '(None)') {
        return worldStoryTitle.trim();
      }
    }

    return findTitleLikeString(raw) || fallbackTitle;
  }

  const events = rows.map((row) => {
    const resolvedTitle = resolveQuestTitle(row.raw, row.key);
    return makeEvent({
      id: `quest_${file}_${row.key}`,
      type: 'quest',
      questCategory,
      title: resolvedTitle,
      titleJp: resolvedTitle,
      startAt: row.startAt,
      endAt: row.endAt,
      data: { raw: row.raw },
      sourceFile: `quest/${file}`,
      dateConfidence: 'inferred',
      dateNote: 'Dates were inferred from date-like strings inside quest raw data.',
    });
  });

  return { events, missingDateCount: rows.length === 0 ? 1 : 0 };
}

function combineParseResults(results: ParseResult[]): ParseResult {
  return {
    events: results.flatMap((result) => result.events),
    missingDateCount: results.reduce((sum, result) => sum + result.missingDateCount, 0),
  };
}

function pickInitialFocus(events: CalendarEvent[], now: Date): Date {
  const activeOrUpcoming = events
    .filter((event) => event.endAt >= now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
  if (activeOrUpcoming) return startOfDay(activeOrUpcoming.startAt);
  const latest = [...events].sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0];
  return latest ? startOfDay(latest.startAt) : startOfDay(now);
}

function getMonthDays(focus: Date): Date[] {
  const first = monthStart(focus);
  const gridStart = startOfDay(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + index);
    return d;
  });
}

function getRawRows(value: unknown): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [];

  function visit(input: unknown, path: string, depth: number) {
    if (rows.length >= 120) return;
    if (input === null || typeof input !== 'object' || depth >= 3) {
      let formatted: string;
      if (typeof input === 'string') formatted = input;
      else formatted = JSON.stringify(input);
      rows.push({ key: path || 'value', value: formatted ?? String(input) });
      return;
    }
    if (Array.isArray(input)) {
      input.slice(0, 80).forEach((item, index) => visit(item, path ? `${path}.${index}` : String(index), depth + 1));
      return;
    }
    for (const [key, item] of Object.entries(input as Record<string, unknown>).slice(0, 80)) {
      visit(item, path ? `${path}.${key}` : key, depth + 1);
    }
  }

  visit(value, '', 0);
  return rows;
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className='flex flex-wrap items-center justify-center gap-2 border-t bg-background p-3'>
      <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => onPage(1)}>
        First
      </Button>
      <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>
        Previous
      </Button>
      <span className='px-2 text-xs text-muted-foreground'>
        Page {page} of {totalPages}
      </span>
      <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>
        Next
      </Button>
      <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => onPage(totalPages)}>
        Last
      </Button>
    </div>
  );
}

function SmartPreviewImage({ urls, alt, className }: { urls: string[]; alt: string; className?: string }) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const src = urls.find((url) => !failedUrls.has(url));

  if (!src) {
    return (
      <div className={cn('flex items-center justify-center rounded-md border border-dashed bg-muted/30 text-muted-foreground', className)}>
        <ImageOff className='h-5 w-5' />
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-md border bg-background p-1', className)}>
      <Image
        src={src}
        alt={alt}
        width={240}
        height={160}
        unoptimized
        className='h-full w-full object-contain'
        onError={() =>
          setFailedUrls((current) => {
            if (current.has(src)) return current;
            const next = new Set(current);
            next.add(src);
            return next;
          })
        }
      />
    </div>
  );
}

function EventPills({
  event,
  status,
}: {
  event: CalendarEvent;
  status: EventStatus;
}) {
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <Badge variant='outline' className={cn('text-[10px]', getStatusColor(status))}>
        {status}
      </Badge>
      <Badge variant='outline' className={cn('text-[10px]', getTypeColor(event.type))}>
        {event.type.replace('_', ' ')}
      </Badge>
      {event.questCategory && (
        <Badge variant='outline' className='border-cyan-500/25 bg-cyan-500/10 text-[10px] text-cyan-700'>
          {getQuestCategoryLabel(event.questCategory)}
        </Badge>
      )}
      <Badge variant='outline' className={cn('text-[10px]', getConfidenceColor(event.dateConfidence))}>
        {event.dateConfidence}
      </Badge>
    </div>
  );
}

function EventCard({
  event,
  now,
  assets,
  selected,
  onOpen,
}: {
  event: CalendarEvent;
  now: Date;
  assets: AssetSummary;
  selected?: boolean;
  onOpen: () => void;
}) {
  const status = getEventStatus(event, now);
  const hasImages = assets.imageCandidates.length > 0;
  const hasAudio = assets.bgmCandidates.length > 0;

  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'grid w-full grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-md border bg-card/70 p-2 text-left transition hover:border-primary/40 hover:bg-accent/40 md:grid-cols-[112px_minmax(0,1fr)]',
        selected && 'border-primary bg-primary/5'
      )}
    >
      <SmartPreviewImage urls={assets.imageCandidates} alt={event.title} className='h-24 w-full md:h-28' />
      <div className='min-w-0 space-y-2'>
        <EventPills event={event} status={status} />
        <div>
          <p className='line-clamp-2 text-sm font-semibold md:text-base'>{event.title}</p>
          <p className='mt-1 text-xs text-muted-foreground'>{formatDateRange(event.startAt, event.endAt)}</p>
        </div>
        <div className='flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
          <span className='inline-flex items-center gap-1'>
            <Clock3 className='h-3 w-3' />
            {getDurationDays(event.startAt, event.endAt)} days
          </span>
          <span className='inline-flex items-center gap-1'>
            <Database className='h-3 w-3' />
            {event.sourceFile}
          </span>
        </div>
        <div className='flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground'>
          <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5', hasImages && 'border-emerald-500/25 text-emerald-600')}>
            <ImageIcon className='h-3 w-3' />
            {hasImages ? 'image' : 'no image'}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5', hasAudio && 'border-cyan-500/25 text-cyan-600')}>
            <Music4 className='h-3 w-3' />
            {hasAudio ? 'audio' : 'no audio'}
          </span>
          <span className='inline-flex items-center gap-1 rounded border px-1.5 py-0.5'>
            <FileJson className='h-3 w-3' />
            raw
          </span>
        </div>
      </div>
    </button>
  );
}

function NowStrip({
  events,
  now,
  missingDateCount,
  onStatus,
}: {
  events: CalendarEvent[];
  now: Date;
  missingDateCount: number;
  onStatus: (status: EventStatus | 'all') => void;
}) {
  const soonStart = now.getTime();
  const soonEnd = now.getTime() + 14 * DAY_MS;
  const endingEnd = now.getTime() + 7 * DAY_MS;
  const live = events.filter((event) => getEventStatus(event, now) === 'live');
  const startingSoon = events.filter((event) => event.startAt.getTime() > soonStart && event.startAt.getTime() <= soonEnd);
  const endingSoon = events.filter((event) => event.endAt.getTime() >= soonStart && event.endAt.getTime() <= endingEnd);

  const items = [
    { label: 'Live now', value: live.length, helper: live[0]?.title || 'Nothing active', action: () => onStatus('live') },
    {
      label: 'Starting soon',
      value: startingSoon.length,
      helper: startingSoon[0] ? formatDateRange(startingSoon[0].startAt, startingSoon[0].endAt) : 'Next 14 days',
      action: () => onStatus('upcoming'),
    },
    {
      label: 'Ending soon',
      value: endingSoon.length,
      helper: endingSoon[0] ? endingSoon[0].title : 'Next 7 days',
      action: () => onStatus('live'),
    },
    { label: 'No date found', value: missingDateCount, helper: 'Skipped records', action: () => onStatus('all') },
  ];

  return (
    <div className='sticky top-16 z-30 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4'>
      <div className='mx-auto grid max-w-7xl grid-cols-2 gap-2 lg:grid-cols-4'>
        {items.map((item) => (
          <button
            key={item.label}
            type='button'
            onClick={item.action}
            className='rounded-md border bg-card/80 p-2 text-left transition hover:border-primary/40 hover:bg-accent/50'
          >
            <div className='flex items-center justify-between gap-2'>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{item.label}</p>
              <span className='text-lg font-semibold'>{item.value}</span>
            </div>
            <p className='mt-1 truncate text-[11px] text-muted-foreground'>{item.helper}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function DensityStrip({
  events,
  focusDate,
  onMonth,
}: {
  events: CalendarEvent[];
  focusDate: Date;
  onMonth: (date: Date) => void;
}) {
  const months = Array.from({ length: 12 }, (_, index) => addMonths(monthStart(focusDate), index - 5));
  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) {
      const start = startOfDay(event.startAt);
      const end = startOfDay(event.endAt);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDayParam(d);
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [events]);

  return (
    <div className='rounded-md border bg-card/60 p-3'>
      <div className='mb-2 flex items-center justify-between gap-2'>
        <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Calendar Density</p>
        <p className='text-[11px] text-muted-foreground'>Click a month to jump</p>
      </div>
      <div className='grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6'>
        {months.map((month) => {
          const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
          const selected = monthKey(month) === monthKey(focusDate);
          return (
            <button
              key={month.toISOString()}
              type='button'
              onClick={() => onMonth(month)}
              className={cn('rounded-md border p-2 text-left transition hover:border-primary/40', selected && 'border-primary bg-primary/5')}
            >
              <p className='mb-1 text-xs font-medium'>
                {month.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
              </p>
              <div className='grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5'>
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = new Date(month.getFullYear(), month.getMonth(), index + 1);
                  const count = dayCounts.get(formatDayParam(day)) || 0;
                  return (
                    <span
                      key={index}
                      className={cn(
                        'h-1 rounded-full bg-muted',
                        count > 0 && count < 4 && 'bg-sky-400',
                        count >= 4 && count < 10 && 'bg-emerald-500',
                        count >= 10 && 'bg-pink-500'
                      )}
                      title={`${formatDayParam(day)}: ${count}`}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  events,
  assetsByKey,
  now,
  focusDate,
  onFocusDate,
  onOpen,
}: {
  events: CalendarEvent[];
  assetsByKey: Map<string, AssetSummary>;
  now: Date;
  focusDate: Date;
  onFocusDate: (date: Date) => void;
  onOpen: (event: CalendarEvent) => void;
}) {
  const monthDays = getMonthDays(focusDate);
  const monthEnd = endOfDay(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0));
  const monthEvents = events.filter(
    (event) => event.startAt <= monthEnd && event.endAt >= monthStart(focusDate)
  );
  const selectedDayEvents = events
    .filter((event) => event.startAt <= endOfDay(focusDate) && event.endAt >= startOfDay(focusDate))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return (
    <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]'>
      <section className='min-h-0 rounded-md border bg-card/60 p-3'>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='text-lg font-semibold'>
              {focusDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            <p className='text-xs text-muted-foreground'>{monthEvents.length} events touch this month</p>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' size='icon' onClick={() => onFocusDate(addMonths(focusDate, -1))}>
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button variant='outline' size='sm' onClick={() => onFocusDate(new Date())}>
              Today
            </Button>
            <Button variant='outline' size='icon' onClick={() => onFocusDate(addMonths(focusDate, 1))}>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-7 border-b pb-2 text-center text-xs font-medium text-muted-foreground'>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className='grid grid-cols-7 gap-1 pt-2'>
          {monthDays.map((day) => {
            const inMonth = day.getMonth() === focusDate.getMonth();
            const dayEvents = events.filter((event) => event.startAt <= endOfDay(day) && event.endAt >= startOfDay(day));
            const typeDots = [...new Set(dayEvents.slice(0, 5).map((event) => event.type))];
            return (
              <button
                key={day.toISOString()}
                type='button'
                onClick={() => onFocusDate(day)}
                className={cn(
                  'min-h-24 rounded-md border p-1.5 text-left transition hover:border-primary/40 hover:bg-accent/40',
                  !inMonth && 'opacity-45',
                  sameDay(day, focusDate) && 'border-primary bg-primary/5'
                )}
              >
                <div className='mb-1 flex items-center justify-between'>
                  <span className='text-xs font-medium'>{day.getDate()}</span>
                  {dayEvents.length > 0 && <Badge variant='secondary' className='h-5 px-1.5 text-[10px]'>{dayEvents.length}</Badge>}
                </div>
                <div className='mb-1 flex flex-wrap gap-1'>
                  {typeDots.map((type) => (
                    <span key={type} className={cn('h-1.5 w-4 rounded-full border', getTypeColor(type))} />
                  ))}
                </div>
                <div className='space-y-1'>
                  {dayEvents.slice(0, 2).map((event) => (
                    <p key={getEventKey(event)} className='truncate text-[10px] text-muted-foreground'>
                      {event.title}
                    </p>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className='min-h-0 rounded-md border bg-card/60'>
        <div className='border-b p-3'>
          <h2 className='font-semibold'>{focusDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          <p className='text-xs text-muted-foreground'>{selectedDayEvents.length} events</p>
        </div>
        <ScrollArea className='h-[640px] p-3'>
          <div className='space-y-2 pr-3'>
            {selectedDayEvents.map((event) => (
              <EventCard
                key={getEventKey(event)}
                event={event}
                now={now}
                assets={assetsByKey.get(getEventKey(event)) || { imageCandidates: [], bgmCandidates: [] }}
                onOpen={() => onOpen(event)}
              />
            ))}
            {selectedDayEvents.length === 0 && (
              <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>No events on this day.</div>
            )}
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}

function TimelineView({
  events,
  assetsByKey,
  now,
  page,
  totalPages,
  onPage,
  onOpen,
  selectedKey,
}: {
  events: CalendarEvent[];
  assetsByKey: Map<string, AssetSummary>;
  now: Date;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onOpen: (event: CalendarEvent) => void;
  selectedKey: string;
}) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.startAt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const list = groups.get(key) || [];
    list.push(event);
    groups.set(key, list);
  }

  return (
    <section className='min-h-0 rounded-md border bg-card/60'>
      <div className='border-b p-3'>
        <h2 className='text-lg font-semibold'>Timeline</h2>
        <p className='text-xs text-muted-foreground'>Grouped by start month</p>
      </div>
      <ScrollArea className='h-[calc(100vh-23rem)] min-h-[520px] p-3'>
        <div className='space-y-5 pr-3'>
          {[...groups.entries()].map(([label, groupEvents]) => (
            <div key={label} className='space-y-2'>
              <div className='sticky top-0 z-10 flex items-center gap-2 bg-card/95 py-1'>
                <div className='h-px flex-1 bg-border' />
                <Badge variant='secondary'>{label}</Badge>
                <div className='h-px flex-1 bg-border' />
              </div>
              <div className='space-y-2'>
                {groupEvents.map((event) => (
                  <EventCard
                    key={getEventKey(event)}
                    event={event}
                    now={now}
                    assets={assetsByKey.get(getEventKey(event)) || { imageCandidates: [], bgmCandidates: [] }}
                    selected={selectedKey === getEventKey(event)}
                    onOpen={() => onOpen(event)}
                  />
                ))}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>No events match these filters.</div>
          )}
        </div>
      </ScrollArea>
      <Pagination page={page} totalPages={totalPages} onPage={onPage} />
    </section>
  );
}

function TableView({
  events,
  assetsByKey,
  now,
  page,
  totalPages,
  onPage,
  onOpen,
}: {
  events: CalendarEvent[];
  assetsByKey: Map<string, AssetSummary>;
  now: Date;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onOpen: (event: CalendarEvent) => void;
}) {
  return (
    <section className='min-h-0 rounded-md border bg-card/60'>
      <div className='border-b p-3'>
        <h2 className='text-lg font-semibold'>Event Table</h2>
        <p className='text-xs text-muted-foreground'>Sortable data with asset flags</p>
      </div>
      <div className='max-h-[calc(100vh-23rem)] min-h-[520px] overflow-auto'>
        <table className='w-full min-w-[980px] text-left text-sm'>
          <thead className='sticky top-0 z-10 border-b bg-background'>
            <tr className='text-xs uppercase tracking-wide text-muted-foreground'>
              <th className='px-3 py-2'>Title</th>
              <th className='px-3 py-2'>Status</th>
              <th className='px-3 py-2'>Type</th>
              <th className='px-3 py-2'>Start</th>
              <th className='px-3 py-2'>End</th>
              <th className='px-3 py-2'>Assets</th>
              <th className='px-3 py-2'>Date</th>
              <th className='px-3 py-2'>Source</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const status = getEventStatus(event, now);
              const assets = assetsByKey.get(getEventKey(event)) || { imageCandidates: [], bgmCandidates: [] };
              return (
                <tr key={getEventKey(event)} className='border-b transition hover:bg-accent/40'>
                  <td className='max-w-[300px] px-3 py-2'>
                    <button type='button' className='line-clamp-2 text-left font-medium hover:text-primary' onClick={() => onOpen(event)}>
                      {event.title}
                    </button>
                    <p className='truncate text-[11px] text-muted-foreground'>{event.id}</p>
                  </td>
                  <td className='px-3 py-2'>
                    <Badge variant='outline' className={cn('text-[10px]', getStatusColor(status))}>{status}</Badge>
                  </td>
                  <td className='px-3 py-2'>
                    <Badge variant='outline' className={cn('text-[10px]', getTypeColor(event.type))}>{event.type.replace('_', ' ')}</Badge>
                  </td>
                  <td className='px-3 py-2 text-xs'>{formatDateTime(event.startAt)}</td>
                  <td className='px-3 py-2 text-xs'>{formatDateTime(event.endAt)}</td>
                  <td className='px-3 py-2'>
                    <div className='flex gap-1.5'>
                      <Badge variant='secondary' className='gap-1 text-[10px]'>
                        <ImageIcon className='h-3 w-3' />
                        {assets.imageCandidates.length}
                      </Badge>
                      <Badge variant='secondary' className='gap-1 text-[10px]'>
                        <Music4 className='h-3 w-3' />
                        {assets.bgmCandidates.length}
                      </Badge>
                    </div>
                  </td>
                  <td className='px-3 py-2'>
                    <Badge variant='outline' className={cn('text-[10px]', getConfidenceColor(event.dateConfidence))}>
                      {event.dateConfidence}
                    </Badge>
                  </td>
                  <td className='max-w-[240px] truncate px-3 py-2 text-xs text-muted-foreground'>{event.sourceFile}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {events.length === 0 && <div className='p-8 text-center text-sm text-muted-foreground'>No events match these filters.</div>}
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={onPage} />
    </section>
  );
}

function formatAudioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function BgmAudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    audio.pause();
  };

  const label = url.split('/').pop()?.replace(/\.mp3$/i, '') || url;
  const progressMax = duration > 0 ? duration : 1;

  return (
    <div className='rounded-md border bg-card/80 p-3'>
      <audio ref={audioRef} preload='none' className='hidden'>
        <source src={url} type='audio/mpeg' />
      </audio>
      <div className='mb-2 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{label}</p>
          <p className='truncate text-[11px] text-muted-foreground'>{url}</p>
        </div>
        <Button type='button' size='icon' variant='secondary' onClick={() => void togglePlay()}>
          {isPlaying ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
        </Button>
      </div>
      <div className='mb-2 flex items-center gap-2'>
        <span className='w-10 text-right font-mono text-[11px] text-muted-foreground'>{formatAudioClock(currentTime)}</span>
        <input
          type='range'
          min={0}
          max={progressMax}
          step={0.1}
          value={Math.min(currentTime, progressMax)}
          onChange={(event) => {
            const next = Number(event.target.value);
            const audio = audioRef.current;
            if (!audio || Number.isNaN(next)) return;
            audio.currentTime = next;
            setCurrentTime(next);
          }}
          className='h-1.5 w-full cursor-pointer accent-primary'
        />
        <span className='w-10 font-mono text-[11px] text-muted-foreground'>{formatAudioClock(duration)}</span>
      </div>
      <div className='flex items-center gap-2'>
        <Volume2 className='h-3.5 w-3.5 text-muted-foreground' />
        <input
          type='range'
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className='h-1.5 w-full cursor-pointer accent-primary'
        />
        <span className='w-9 text-right text-[11px] text-muted-foreground'>{volume}%</span>
      </div>
    </div>
  );
}

function ImageGalleryTab({ event, assets }: { event: CalendarEvent; assets: AssetSummary }) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(assets.imageCandidates[0] || null);
  const [showFailed, setShowFailed] = useState(false);
  const visibleImages = assets.imageCandidates.filter((url) => !failedUrls.has(url));
  const failedList = assets.imageCandidates.filter((url) => failedUrls.has(url));

  if (assets.imageCandidates.length === 0) {
    return <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>No image-like asset paths were found.</div>;
  }

  return (
    <div className='grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]'>
      <div className='space-y-2'>
        {visibleImages.map((url) => (
          <button
            key={url}
            type='button'
            onClick={() => setPreviewUrl(url)}
            className={cn('grid w-full grid-cols-[56px_minmax(0,1fr)] gap-2 rounded-md border p-1.5 text-left hover:border-primary/40', previewUrl === url && 'border-primary bg-primary/5')}
          >
            <SmartPreviewImage urls={[url]} alt={event.title} className='h-12 w-14' />
            <span className='line-clamp-2 break-all text-[11px] text-muted-foreground'>{url}</span>
          </button>
        ))}
      </div>
      <div className='min-w-0 space-y-3'>
        <div className='flex min-h-[360px] items-center justify-center rounded-md border bg-muted/20 p-2'>
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={`${event.title} preview`}
              width={1200}
              height={720}
              unoptimized
              className='max-h-[520px] w-auto max-w-full object-contain'
              onError={() =>
                setFailedUrls((current) => {
                  if (current.has(previewUrl)) return current;
                  const next = new Set(current);
                  next.add(previewUrl);
                  return next;
                })
              }
            />
          ) : (
            <ImageOff className='h-8 w-8 text-muted-foreground' />
          )}
        </div>
        {failedList.length > 0 && (
          <div className='rounded-md border border-amber-500/30 bg-amber-500/5 p-3'>
            <Button type='button' size='sm' variant='outline' onClick={() => setShowFailed((current) => !current)}>
              {showFailed ? 'Hide failed candidates' : `Show failed candidates (${failedList.length})`}
            </Button>
            {showFailed && (
              <div className='mt-3 space-y-1'>
                {failedList.map((url) => (
                  <p key={url} className='break-all font-mono text-[11px] text-muted-foreground'>{url}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetailsDialog({
  event,
  assets,
  now,
  onClose,
}: {
  event: CalendarEvent | null;
  assets: AssetSummary | null;
  now: Date;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const activeAssets = assets || { imageCandidates: [], bgmCandidates: [] };
  const rawRows = useMemo(() => (event ? getRawRows(event.data.raw ?? event.data) : []), [event]);
  const json = useMemo(() => (event && tab === 'json' ? JSON.stringify(event.data, null, 2) : ''), [event, tab]);

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className='max-h-[92vh] max-w-6xl overflow-hidden p-0'
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {event && (
          <div className='grid max-h-[92vh] grid-rows-[auto_auto_minmax(0,1fr)]'>
            <DialogHeader className='border-b px-5 py-4'>
              <DialogTitle className='line-clamp-2 pr-8'>{event.title}</DialogTitle>
              <DialogDescription>{event.id}</DialogDescription>
            </DialogHeader>
            <div className='flex flex-wrap gap-2 border-b px-5 py-3'>
              {(['summary', 'images', 'audio', 'fields', 'json'] as DetailTab[]).map((item) => (
                <Button key={item} type='button' size='sm' variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>
                  {item === 'json' ? 'Source JSON' : item[0].toUpperCase() + item.slice(1)}
                </Button>
              ))}
            </div>
            <ScrollArea className='min-h-0 px-5 py-4'>
              {tab === 'summary' && (
                <div className='grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]'>
                  <SmartPreviewImage urls={activeAssets.imageCandidates} alt={event.title} className='h-56 w-full' />
                  <div className='space-y-4'>
                    <EventPills event={event} status={getEventStatus(event, now)} />
                    <div className='grid gap-3 sm:grid-cols-2'>
                      {[
                        ['Start', formatDateTime(event.startAt)],
                        ['End', formatDateTime(event.endAt)],
                        ['Duration', `${getDurationDays(event.startAt, event.endAt)} days`],
                        ['Source', event.sourceFile],
                        ['Images', String(activeAssets.imageCandidates.length)],
                        ['Audio', String(activeAssets.bgmCandidates.length)],
                      ].map(([label, value]) => (
                        <div key={label} className='rounded-md border p-3'>
                          <p className='text-xs uppercase tracking-wide text-muted-foreground'>{label}</p>
                          <p className='mt-1 break-words text-sm font-medium'>{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className='rounded-md border p-3'>
                      <p className='text-xs uppercase tracking-wide text-muted-foreground'>Date Confidence</p>
                      <p className='mt-1 text-sm font-medium'>{event.dateConfidence}</p>
                      <p className='mt-1 text-xs text-muted-foreground'>{event.dateNote}</p>
                    </div>
                  </div>
                </div>
              )}
              {tab === 'images' && <ImageGalleryTab event={event} assets={activeAssets} />}
              {tab === 'audio' && (
                <div className='space-y-3'>
                  {activeAssets.bgmCandidates.map((url) => <BgmAudioPlayer key={url} url={url} />)}
                  {activeAssets.bgmCandidates.length === 0 && (
                    <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>No BGM-like asset paths were found.</div>
                  )}
                </div>
              )}
              {tab === 'fields' && (
                <div className='overflow-hidden rounded-md border'>
                  <table className='w-full min-w-[720px] text-left text-sm'>
                    <thead className='border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground'>
                      <tr>
                        <th className='px-3 py-2'>Field</th>
                        <th className='px-3 py-2'>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.map((row) => (
                        <tr key={`${row.key}-${row.value}`} className='border-b'>
                          <td className='w-56 break-all px-3 py-2 font-mono text-xs text-muted-foreground'>{row.key}</td>
                          <td className='break-all px-3 py-2 text-xs'>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === 'json' && (
                <pre className='max-h-[64vh] overflow-auto rounded-md border bg-muted/20 p-3 text-xs'>{json}</pre>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarV2Client() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSettings = useMemo(() => settingsFromParams(searchParams), [searchParams]);
  const [settings, setSettings] = useState(initialSettings);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [missingDateCount, setMissingDateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const now = useMemo(() => new Date(), []);

  const focusDate = parseDayParam(settings.day) || pickInitialFocus(events, now);

  const updateSettings = (patch: Partial<CalendarSettings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    setSettings(next);
    const query = encodeSettings(next);
    router.replace(query ? `/calendar-v2?${query}` : '/calendar-v2', { scroll: false });
  };

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const lang = settings.lang === 'jp' ? 'jp' : 'en';
        const [rewardRes, staminaRes, challengeRes, gachaRes, activeMissionRes, loginBonusRes, questListRes] = await Promise.all([
          fetch(`/api/orderedmap/data?category=campaign&file=reward_campaign&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=campaign&file=stamina_campaign&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=campaign&file=daily_challenge_point_campaign&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=gacha&file=gacha&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=active_mission&file=active_mission_event&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=bonus&file=login_bonus&lang=${lang}`),
          fetch(`/api/quests/list?lang=${lang}`),
        ]);

        const [rewardJson, staminaJson, challengeJson, gachaJson, activeMissionJson, loginBonusJson] = (await Promise.all([
          rewardRes.json(),
          staminaRes.json(),
          challengeRes.json(),
          gachaRes.json(),
          activeMissionRes.json(),
          loginBonusRes.json(),
        ])) as RawApiPayload[];

        const questListJson = (await questListRes.json()) as { files?: string[] };
        const questFiles = (questListJson.files || []).filter((file) => isRelevantQuestFile(file));
        const questPayloads = await Promise.all(
          questFiles.map(async (file) => {
            try {
              const res = await fetch(`/api/orderedmap/data?category=quest&file=${encodeURIComponent(file)}&lang=${lang}`);
              if (!res.ok) return null;
              const json = (await res.json()) as RawApiPayload;
              return { file, data: json.data || {} };
            } catch {
              return null;
            }
          })
        );

        const parsed = combineParseResults([
          parseRewardEvents(rewardJson.data || {}),
          parseStaminaEvents(staminaJson.data || {}),
          parseChallengeEvents(challengeJson.data || {}),
          parseGachaEvents(gachaJson.data || {}),
          parseActiveMissionEvents(activeMissionJson.data || {}),
          parseLoginBonusEvents(loginBonusJson.data || {}),
          ...questPayloads
            .filter((entry): entry is { file: string; data: Record<string, unknown> } => !!entry)
            .map((entry) => parseQuestEventsFromFile(entry.file, entry.data)),
        ]);

        const sane = parsed.events.filter((event) => isSaneDateRange(event.startAt, event.endAt));
        sane.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
        if (!active) return;
        setEvents(sane);
        setMissingDateCount(parsed.missingDateCount + parsed.events.length - sane.length);
      } catch (err) {
        console.error('Failed to load calendar v2:', err);
        if (!active) return;
        setError('Failed to load event calendar.');
        setEvents([]);
        setMissingDateCount(0);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [settings.lang, now]);

  const assetsByKey = useMemo(() => {
    const map = new Map<string, AssetSummary>();
    for (const event of events) map.set(getEventKey(event), getAssetSummary(event));
    return map;
  }, [events]);

  const sourceOptions = useMemo(() => {
    const sources = [...new Set(events.map((event) => event.sourceFile))].sort((a, b) => a.localeCompare(b));
    return ['all', ...sources];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = settings.q.trim().toLowerCase();
    return events.filter((event) => {
      const key = getEventKey(event);
      const assets = assetsByKey.get(key) || { imageCandidates: [], bgmCandidates: [] };
      if (settings.status !== 'all' && getEventStatus(event, now) !== settings.status) return false;
      if (settings.type !== 'all' && event.type !== settings.type) return false;
      if (settings.quest !== 'all' && event.questCategory !== settings.quest) return false;
      if (settings.source !== 'all' && event.sourceFile !== settings.source) return false;
      if (settings.asset === 'has-images' && assets.imageCandidates.length === 0) return false;
      if (settings.asset === 'missing-images' && assets.imageCandidates.length > 0) return false;
      if (settings.audio === 'has-bgm' && assets.bgmCandidates.length === 0) return false;
      if (settings.confidence !== 'all' && event.dateConfidence !== settings.confidence) return false;
      if (!q) return true;
      const haystack = `${event.id} ${event.title} ${event.titleJp} ${event.sourceFile} ${event.type}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [assetsByKey, events, now, settings]);

  const orderedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    sorted.sort((a, b) => {
      switch (settings.sort) {
        case 'start-asc':
          return a.startAt.getTime() - b.startAt.getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'duration-desc':
          return getDurationDays(b.startAt, b.endAt) - getDurationDays(a.startAt, a.endAt);
        case 'source-asc':
          return a.sourceFile.localeCompare(b.sourceFile) || a.startAt.getTime() - b.startAt.getTime();
        case 'start-desc':
        default:
          return b.startAt.getTime() - a.startAt.getTime();
      }
    });
    return sorted;
  }, [filteredEvents, settings.sort]);

  const totalPages = Math.max(1, Math.ceil(orderedEvents.length / PAGE_SIZE));
  const safePage = Math.min(settings.page, totalPages);
  const pagedEvents = orderedEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const eventsByKey = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const event of events) map.set(getEventKey(event), event);
    return map;
  }, [events]);

  const selectedEvent = settings.event ? eventsByKey.get(settings.event) || null : null;
  const selectedAssets = selectedEvent ? assetsByKey.get(getEventKey(selectedEvent)) || null : null;

  const activeFilterCount = [
    settings.q,
    settings.status !== 'all',
    settings.type !== 'all',
    settings.quest !== 'all',
    settings.source !== 'all',
    settings.asset !== 'all',
    settings.audio !== 'all',
    settings.confidence !== 'all',
  ].filter(Boolean).length;

  const resetFilters = () => {
    updateSettings({
      q: '',
      status: 'all',
      type: 'all',
      quest: 'all',
      source: 'all',
      asset: 'all',
      audio: 'all',
      confidence: 'all',
      page: 1,
      event: '',
    });
  };

  const openEvent = (event: CalendarEvent) => updateSettings({ event: getEventKey(event) });
  const closeEvent = () => updateSettings({ event: '' });
  const setPage = (page: number) => updateSettings({ page });
  const setFocusDate = (date: Date) => updateSettings({ day: formatDayParam(startOfDay(date)), page: 1 });

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <div className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-4'>
        <Card className='w-80'>
          <CardContent className='flex items-center gap-3 p-5'>
            <Loader2 className='h-5 w-5 animate-spin text-primary' />
            <div>
              <p className='text-sm font-medium'>Loading calendar</p>
              <p className='text-xs text-muted-foreground'>Normalizing event data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-background'>
      <div className='border-b bg-card/40 px-3 py-4 sm:px-4'>
        <div className='mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <Badge variant='outline'>Calendar v2</Badge>
              <Badge variant='secondary'>{events.length} dated events</Badge>
              <Badge variant='secondary'>{orderedEvents.length} shown</Badge>
            </div>
            <h1 className='flex items-center gap-2 text-2xl font-semibold'>
              <CalendarDays className='h-6 w-6 text-primary' />
              Event Command Center
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>Live status, event density, assets, and source data.</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant={settings.view === 'timeline' ? 'default' : 'outline'} size='sm' onClick={() => updateSettings({ view: 'timeline', page: 1 })}>
              <ListFilter className='mr-2 h-4 w-4' />
              Timeline
            </Button>
            <Button variant={settings.view === 'month' ? 'default' : 'outline'} size='sm' onClick={() => updateSettings({ view: 'month', page: 1 })}>
              <LayoutGrid className='mr-2 h-4 w-4' />
              Month
            </Button>
            <Button variant={settings.view === 'table' ? 'default' : 'outline'} size='sm' onClick={() => updateSettings({ view: 'table', page: 1 })}>
              <Table2 className='mr-2 h-4 w-4' />
              Table
            </Button>
            <Button variant='outline' size='sm' onClick={() => updateSettings({ lang: settings.lang === 'jp' ? 'en' : 'jp', page: 1 })}>
              <Languages className='mr-2 h-4 w-4' />
              {settings.lang === 'jp' ? 'EN' : 'JP'}
            </Button>
            <Button variant='outline' size='sm' onClick={() => void copyShareLink()}>
              {copied ? <Check className='mr-2 h-4 w-4' /> : <Clipboard className='mr-2 h-4 w-4' />}
              {copied ? 'Copied' : 'Share'}
            </Button>
            <Button asChild variant='ghost' size='sm'>
              <Link href='/calendar'>Classic</Link>
            </Button>
          </div>
        </div>
      </div>

      <NowStrip events={events} now={now} missingDateCount={missingDateCount} onStatus={(status) => updateSettings({ status, page: 1 })} />

      <main className='mx-auto grid max-w-7xl gap-3 p-3 sm:p-4 xl:grid-cols-[300px_minmax(0,1fr)]'>
        <aside className='space-y-3'>
          <section className='rounded-md border bg-card/60 p-3'>
            <div className='mb-3 flex items-center gap-2'>
              <SlidersHorizontal className='h-4 w-4 text-muted-foreground' />
              <h2 className='text-sm font-semibold'>Filters</h2>
              {activeFilterCount > 0 && <Badge variant='secondary'>{activeFilterCount}</Badge>}
            </div>
            <div className='space-y-3'>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={settings.q}
                  onChange={(event) => updateSettings({ q: event.target.value, page: 1 })}
                  placeholder='Search title, ID, source...'
                  className='pl-9'
                />
              </div>

              <Select value={settings.status} onValueChange={(value) => updateSettings({ status: value as CalendarSettings['status'], page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={settings.type} onValueChange={(value) => updateSettings({ type: value as CalendarSettings['type'], page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={settings.quest} onValueChange={(value) => updateSettings({ quest: value as CalendarSettings['quest'], page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QUEST_CATEGORY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={settings.source} onValueChange={(value) => updateSettings({ source: value, page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source === 'all' ? 'All sources' : source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={settings.asset} onValueChange={(value) => updateSettings({ asset: value as AssetFilter, page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any image state</SelectItem>
                  <SelectItem value='has-images'>Has images</SelectItem>
                  <SelectItem value='missing-images'>Missing images</SelectItem>
                </SelectContent>
              </Select>

              <Select value={settings.audio} onValueChange={(value) => updateSettings({ audio: value as AudioFilter, page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any audio state</SelectItem>
                  <SelectItem value='has-bgm'>Has BGM</SelectItem>
                </SelectContent>
              </Select>

              <Select value={settings.confidence} onValueChange={(value) => updateSettings({ confidence: value as CalendarSettings['confidence'], page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONFIDENCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={settings.sort} onValueChange={(value) => updateSettings({ sort: value as SortMode, page: 1 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='start-desc'>Newest first</SelectItem>
                  <SelectItem value='start-asc'>Oldest first</SelectItem>
                  <SelectItem value='title-asc'>Title A-Z</SelectItem>
                  <SelectItem value='duration-desc'>Longest first</SelectItem>
                  <SelectItem value='source-asc'>Source A-Z</SelectItem>
                </SelectContent>
              </Select>

              <Button variant='outline' className='w-full' onClick={resetFilters}>Reset Filters</Button>
            </div>
          </section>

          <DensityStrip events={filteredEvents} focusDate={focusDate} onMonth={setFocusDate} />
        </aside>

        <div className='min-w-0 space-y-3'>
          {error && <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>{error}</div>}

          {settings.view === 'timeline' && (
            <TimelineView
              events={pagedEvents}
              assetsByKey={assetsByKey}
              now={now}
              page={safePage}
              totalPages={totalPages}
              onPage={setPage}
              onOpen={openEvent}
              selectedKey={settings.event}
            />
          )}

          {settings.view === 'month' && (
            <MonthView
              events={orderedEvents}
              assetsByKey={assetsByKey}
              now={now}
              focusDate={focusDate}
              onFocusDate={setFocusDate}
              onOpen={openEvent}
            />
          )}

          {settings.view === 'table' && (
            <TableView
              events={pagedEvents}
              assetsByKey={assetsByKey}
              now={now}
              page={safePage}
              totalPages={totalPages}
              onPage={setPage}
              onOpen={openEvent}
            />
          )}
        </div>
      </main>

      <EventDetailsDialog event={selectedEvent} assets={selectedAssets} now={now} onClose={closeEvent} />
    </div>
  );
}
