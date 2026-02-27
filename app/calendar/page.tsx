'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Languages,
  Loader2,
  Music4,
  Pause,
  Play,
  Search,
  Volume2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type EventType = 'reward' | 'stamina' | 'challenge' | 'gacha' | 'active_mission' | 'login_bonus' | 'quest';
type EventStatus = 'live' | 'upcoming' | 'ended';
type ViewMode = 'month' | 'week' | 'list';
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

interface CalendarEvent {
  id: string;
  type: EventType;
  questCategory: QuestCategory | null;
  title: string;
  titleJp: string;
  startAt: Date;
  endAt: Date;
  data: Record<string, unknown>;
  sourceFile: string;
}

function getEventKey(event: CalendarEvent): string {
  return `${event.type}::${event.id}::${event.sourceFile}`;
}

const TYPE_OPTIONS: Array<{ value: EventType | 'all'; en: string; jp: string }> = [
  { value: 'all', en: 'All Types', jp: '???' },
  { value: 'quest', en: 'Quest Event', jp: '???????' },
  { value: 'reward', en: 'Reward', jp: '??' },
  { value: 'stamina', en: 'Stamina', jp: '????' },
  { value: 'challenge', en: 'Challenge', jp: '?????' },
  { value: 'gacha', en: 'Gacha', jp: '???' },
  { value: 'active_mission', en: 'Active Mission', jp: '??????????' },
  { value: 'login_bonus', en: 'Login Bonus', jp: '????????' },
];

const QUEST_CATEGORY_OPTIONS: Array<{ value: QuestCategory | 'all'; en: string; jp: string }> = [
  { value: 'all', en: 'All Quest Categories', jp: 'All Quest Categories' },
  { value: 'gacha_banner', en: 'Gacha Banner', jp: 'Gacha Banner' },
  { value: 'advent_event', en: 'Advent Event', jp: 'Advent Event' },
  { value: 'carnival_event', en: 'Carnival Event', jp: 'Carnival Event' },
  { value: 'raid_event', en: 'Raid Event', jp: 'Raid Event' },
  { value: 'ranking_event', en: 'Ranking Event', jp: 'Ranking Event' },
  { value: 'single_quest', en: 'Single Quest', jp: 'Single Quest' },
  { value: 'rush_event', en: 'Rush Event', jp: 'Rush Event' },
  { value: 'story_event', en: 'Story Event', jp: 'Story Event' },
  { value: 'world_story_event', en: 'World Story Event', jp: 'World Story Event' },
  { value: 'other', en: 'Other Quest', jp: 'Other Quest' },
];

const STATUS_OPTIONS: Array<{ value: EventStatus | 'all'; en: string; jp: string }> = [
  { value: 'all', en: 'All Status', jp: '???' },
  { value: 'live', en: 'Live', jp: '???' },
  { value: 'upcoming', en: 'Upcoming', jp: '????' },
  { value: 'ended', en: 'Ended', jp: '??' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SELECTED_DAY_PAGE_SIZE = 80;
const LIST_PAGE_SIZE = 120;
const DATE_RE = /\b\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?\b/;
const MIN_VALID_DATE = new Date('2003-01-01T00:00:00Z');
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const DIRECTORY_LIKE_RE = /https?:\/\/[^\s"'`]+|\/?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/g;
const BGM_PATH_RE = /\/?bgm\/[A-Za-z0-9._/-]+/gi;

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
  return matches
    .map((token) => token.replace(/[),.;]+$/, '').trim())
    .filter((token) => token.includes('/'));
}

function collectImageCandidatesFromRaw(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    const tokens = extractDirectoryLikeTokens(value);
    for (const token of tokens) out.add(buildImageUrlFromPath(token));
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

function getGachaBannerImageUrl(event: CalendarEvent): string | null {
  if (event.type !== 'gacha') return null;
  const raw = event.data.raw;
  if (!Array.isArray(raw)) return null;
  const bannerPath = raw[3];
  if (
    typeof bannerPath !== 'string' ||
    !bannerPath.trim() ||
    bannerPath === '(None)'
  ) {
    return null;
  }
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
  return [...ordered].slice(0, 8);
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
    const tokens = extractBgmTokens(value);
    for (const token of tokens) out.add(buildBgmUrlFromPath(token));
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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekStartSunday(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
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

function getQuestCategoryColor(category: QuestCategory): string {
  switch (category) {
    case 'gacha_banner':
      return 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/25';
    case 'advent_event':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/25';
    case 'carnival_event':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/25';
    case 'raid_event':
      return 'bg-red-500/10 text-red-600 border-red-500/25';
    case 'ranking_event':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/25';
    case 'single_quest':
      return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25';
    case 'rush_event':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/25';
    case 'story_event':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
    case 'world_story_event':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/25';
    default:
      return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25';
  }
}

function getQuestCategoryLabel(category: QuestCategory, language: 'en' | 'jp'): string {
  const found = QUEST_CATEGORY_OPTIONS.find((option) => option.value === category);
  if (!found) return category;
  return language === 'jp' ? found.jp : found.en;
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

function formatDateRange(startAt: Date, endAt: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${startAt.toLocaleDateString(undefined, opts)} - ${endAt.toLocaleDateString(undefined, opts)}`;
}

function getDurationDays(startAt: Date, endAt: Date): number {
  return Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS));
}

function findNextMatchingDate(events: CalendarEvent[], selectedDate: Date): Date | null {
  if (events.length === 0) return null;

  const dayStart = startOfDay(selectedDate).getTime();
  const dayEnd = endOfDay(selectedDate).getTime();

  const hasAnyOnSelectedDay = events.some(
    (event) => event.startAt.getTime() <= dayEnd && event.endAt.getTime() >= dayStart
  );
  if (hasAnyOnSelectedDay) return startOfDay(selectedDate);

  const nextFutureStart = events
    .map((event) => event.startAt)
    .filter((d) => d.getTime() > dayEnd)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (nextFutureStart) return startOfDay(nextFutureStart);

  const earliest = events
    .map((event) => event.startAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return earliest ? startOfDay(earliest) : null;
}

function parseRewardEvents(data: Record<string, unknown>): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[1]);
    const endAt = parseDate(row[2]);
    if (!startAt || !endAt) continue;
    events.push({
      id,
      type: 'reward',
      questCategory: null,
      title: safeString(row[0], `Reward ${id}`),
      titleJp: safeString(row[0], `?? ${id}`),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'campaign/reward_campaign',
    });
  }
  return events;
}

function parseStaminaEvents(data: Record<string, unknown>): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[1]);
    const endAt = parseDate(row[2]);
    if (!startAt || !endAt) continue;
    events.push({
      id,
      type: 'stamina',
      questCategory: null,
      title: safeString(row[0], `Stamina ${id}`),
      titleJp: safeString(row[0], `???? ${id}`),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'campaign/stamina_campaign',
    });
  }
  return events;
}

function parseChallengeEvents(data: Record<string, unknown>): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[1]);
    const endAt = parseDate(row[2]);
    if (!startAt || !endAt) continue;
    events.push({
      id,
      type: 'challenge',
      questCategory: null,
      title: safeString(row[0], `Challenge ${id}`),
      titleJp: safeString(row[0], `????? ${id}`),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'campaign/daily_challenge_point_campaign',
    });
  }
  return events;
}

function parseGachaEvents(data: Record<string, unknown>): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[29]);
    const endAt = parseDate(row[30]);
    if (!startAt || !endAt) continue;
    events.push({
      id,
      type: 'gacha',
      questCategory: 'gacha_banner',
      title: safeString(row[1], safeString(row[0], `Gacha ${id}`)),
      titleJp: safeString(row[1], safeString(row[0], `??? ${id}`)),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'gacha/gacha',
    });
  }
  return events;
}

function parseActiveMissionEvents(data: Record<string, unknown>): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [id, row] of Object.entries(data)) {
    if (!Array.isArray(row)) continue;
    const startAt = parseDate(row[14]);
    const endAt = parseDate(row[15]) ?? parseDate('2099-12-31 23:59:59');
    if (!startAt || !endAt) continue;
    events.push({
      id,
      type: 'active_mission',
      questCategory: null,
      title: safeString(row[0], `Mission ${id}`),
      titleJp: safeString(row[1], safeString(row[0], `????? ${id}`)),
      startAt,
      endAt,
      data: { raw: row },
      sourceFile: 'active_mission/active_mission_event',
    });
  }
  return events;
}

function parseLoginBonusEvents(data: Record<string, unknown>): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [category, group] of Object.entries(data)) {
    if (!group || typeof group !== 'object') continue;
    for (const [id, row] of Object.entries(group as Record<string, unknown>)) {
      if (!Array.isArray(row)) continue;
      const startAt = parseDate(row[40]);
      const endAt = parseDate(row[41]);
      if (!startAt || !endAt) continue;
      events.push({
        id: `${category}_${id}`,
        type: 'login_bonus',
        questCategory: null,
        title: `Login Bonus - ${category}`,
        titleJp: `???????? - ${category}`,
        startAt,
        endAt,
        data: { raw: row },
        sourceFile: 'bonus/login_bonus',
      });
    }
  }
  return events;
}

function collectQuestDateRows(
  value: unknown,
  pathKey: string,
  out: Array<{ key: string; startAt: Date; endAt: Date; raw: unknown }>
) {
  if (Array.isArray(value)) {
    const dates = value
      .map((entry) => (typeof entry === 'string' ? parseDateToken(entry) : null))
      .filter((d): d is Date => !!d);
    if (dates.length >= 2) {
      const startAt = dates[0];
      const endAt = dates[1];
      if (isSaneDateRange(startAt, endAt)) {
        out.push({ key: pathKey || 'entry', startAt, endAt, raw: value });
      }
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
      for (const item of value.slice(0, 20)) {
        queue.push({ value: item, depth: depth + 1 });
      }
      continue;
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) {
        queue.push({ value: item, depth: depth + 1 });
      }
    }
  }

  return null;
}

function parseQuestEventsFromFile(file: string, data: Record<string, unknown>): CalendarEvent[] {
  const rows: Array<{ key: string; startAt: Date; endAt: Date; raw: unknown }> = [];
  collectQuestDateRows(data, '', rows);

  const shortName = file.split('/').pop() || file;
  const lowerFile = file.toLowerCase();
  const questCategory = getQuestCategoryFromSourceFile(file);

  function resolveQuestTitle(raw: unknown, key: string): string {
    const fallbackTitle = `${shortName} - ${key}`;
    if (!Array.isArray(raw)) return fallbackTitle;

    // quest_event rows commonly store display title at index 1.
    if (lowerFile.includes('quest_event')) {
      const questEventTitle = raw[1];
      if (
        typeof questEventTitle === 'string' &&
        questEventTitle.trim() &&
        questEventTitle !== '(None)'
      ) {
        return questEventTitle.trim();
      }
    }

    // story/world_story rows store a useful display title at index 2.
    if (questCategory === 'world_story_event' || questCategory === 'story_event') {
      const worldStoryTitle = raw[2];
      if (
        typeof worldStoryTitle === 'string' &&
        worldStoryTitle.trim() &&
        worldStoryTitle !== '(None)'
      ) {
        return worldStoryTitle.trim();
      }
    }

    // Heuristic fallback: pick first human-readable title-like string.
    const heuristicTitle = findTitleLikeString(raw);
    if (heuristicTitle) return heuristicTitle;

    return fallbackTitle;
  }

  return rows.map((row) => {
    const resolvedTitle = resolveQuestTitle(row.raw, row.key);
    return {
      id: `quest_${file}_${row.key}`,
      type: 'quest',
      questCategory,
      title: resolvedTitle,
      titleJp: resolvedTitle,
      startAt: row.startAt,
      endAt: row.endAt,
      data: { raw: row.raw },
      sourceFile: `quest/${file}`,
    };
  });
}

function EventImageGallery({ event }: { event: CalendarEvent }) {
  const imageCandidates = useMemo(() => {
    const candidates = new Set<string>();
    collectImageCandidatesFromRaw(event.data, candidates);
    return [...candidates].slice(0, 40);
  }, [event]);

  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const visibleImages = imageCandidates.filter((url) => !failedUrls.has(url));
  const failedList = imageCandidates.filter((url) => failedUrls.has(url));
  if (imageCandidates.length === 0) return null;

  return (
    <div className='space-y-3'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm'>Detected Images</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleImages.length > 0 ? (
            <div className='grid grid-cols-2 gap-3 md:grid-cols-3'>
              {visibleImages.map((url) => (
                <div key={url} className='rounded-md border p-2'>
                  <button
                    type='button'
                    onClick={() => setPreviewUrl(url)}
                    className='mb-2 block w-full rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                    title='Open larger preview'
                  >
                    <div className='flex h-24 items-center justify-center rounded bg-muted/30'>
                      <Image
                        src={url}
                        alt='Detected asset'
                        width={120}
                        height={96}
                        unoptimized={true}
                        style={{ objectFit: 'contain', imageRendering: 'pixelated' }}
                        onError={() =>
                          setFailedUrls((prev) => {
                            const next = new Set(prev);
                            next.add(url);
                            return next;
                          })
                        }
                      />
                    </div>
                  </button>
                  <p className='line-clamp-2 break-all text-[10px] text-muted-foreground'>{url}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
              No detected image URLs loaded successfully.
            </div>
          )}
        </CardContent>
      </Card>

      {failedList.length > 0 && (
        <Card className='border-amber-500/30 bg-amber-500/5'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Failed Image Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-1'>
              {failedList.map((url) => (
                <p key={url} className='break-all font-mono text-[11px] text-muted-foreground'>
                  {url}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent
          className='max-h-[92vh] max-w-5xl overflow-hidden p-3 sm:p-4'
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {previewUrl && (
            <div className='space-y-2'>
              <DialogHeader className='sr-only'>
                <DialogTitle>Image Preview</DialogTitle>
                <DialogDescription>Large preview of the selected detected asset image.</DialogDescription>
              </DialogHeader>
              <div className='flex max-h-[80vh] items-center justify-center overflow-hidden rounded-md border bg-muted/20 p-2'>
                <Image
                  src={previewUrl}
                  alt='Asset preview'
                  width={1400}
                  height={1000}
                  unoptimized={true}
                  className='h-auto max-h-[76vh] w-auto max-w-full object-contain'
                />
              </div>
              <p className='break-all text-xs text-muted-foreground'>{previewUrl}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  const togglePlay = useCallback(async () => {
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
  }, []);

  const label = useMemo(() => {
    const fileName = url.split('/').pop() || url;
    try {
      return decodeURIComponent(fileName).replace(/\.mp3$/i, '');
    } catch {
      return fileName.replace(/\.mp3$/i, '');
    }
  }, [url]);

  const progressMax = duration > 0 ? duration : 1;

  return (
    <div className='rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 p-3'>
      <audio ref={audioRef} preload='none' className='hidden'>
        <source src={url} type='audio/mpeg' />
      </audio>

      <div className='mb-2 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='mb-1 flex items-center gap-2'>
            <div className='rounded-md border border-primary/20 bg-primary/10 p-1.5'>
              <Music4 className='h-3.5 w-3.5 text-primary' />
            </div>
            <p className='truncate text-sm font-medium'>{label}</p>
          </div>
          <p className='truncate text-[11px] text-muted-foreground'>{url}</p>
        </div>
        <Button type='button' size='icon' variant='secondary' onClick={() => void togglePlay()} className='shrink-0'>
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
          onChange={(e) => {
            const next = Number(e.target.value);
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
          onChange={(e) => setVolume(Number(e.target.value))}
          className='h-1.5 w-full cursor-pointer accent-primary'
        />
        <span className='w-9 text-right text-[11px] text-muted-foreground'>{volume}%</span>
      </div>
    </div>
  );
}

function EventListPreviewImage({ urls, alt }: { urls: string[]; alt: string }) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const candidateUrls = urls.filter((url) => !failedUrls.has(url));
  if (candidateUrls.length === 0) return null;
  const src = candidateUrls[0];

  return (
    <div className='h-20 w-44 shrink-0 overflow-hidden rounded-md border bg-muted/20 p-1'>
      <Image
        src={src}
        alt={alt}
        width={224}
        height={128}
        unoptimized={true}
        className='h-full w-full object-contain'
        onError={() =>
          setFailedUrls((prev) => {
            if (prev.has(src)) return prev;
            const next = new Set(prev);
            next.add(src);
            return next;
          })
        }
      />
    </div>
  );
}

const EventDetailsDialog = memo(function EventDetailsDialog({
  event,
  language,
  now,
  onClose,
}: {
  event: CalendarEvent | null;
  language: 'en' | 'jp';
  now: Date;
  onClose: () => void;
}) {
  const [showAssetScan, setShowAssetScan] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  const parsedEvent = useMemo(() => {
    if (!event) return null;
    const status = getEventStatus(event, now);
    return {
      id: event.id,
      type: event.type,
      questCategory:
        event.type === 'quest' && event.questCategory
          ? getQuestCategoryLabel(event.questCategory, language)
          : null,
      status,
      titleEn: event.title,
      titleJp: event.titleJp,
      source: event.sourceFile,
      start: event.startAt.toISOString(),
      end: event.endAt.toISOString(),
      durationDays: getDurationDays(event.startAt, event.endAt),
    };
  }, [event, now, language]);

  const rawEventJson = useMemo(() => {
    if (!event || !showRawData) return '';
    return JSON.stringify(event.data, null, 2);
  }, [event, showRawData]);

  const bgmCandidates = useMemo(() => {
    if (!event) return [];
    const candidates = new Set<string>();
    collectBgmCandidatesFromRaw(event.data, candidates);
    return [...candidates].slice(0, 12);
  }, [event]);

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className='max-h-[90vh] max-w-3xl overflow-y-auto'
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {event && parsedEvent && (
          <>
            <DialogHeader>
              <DialogTitle>{language === 'jp' ? event.titleJp : event.title}</DialogTitle>
              <DialogDescription>{event.id}</DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>Asset Detection</CardTitle>
                </CardHeader>
                <CardContent className='space-y-2'>
                  <p className='text-xs text-muted-foreground'>Load detected directory-like image paths from raw data.</p>
                  <Button size='sm' variant='outline' onClick={() => setShowAssetScan((prev) => !prev)}>
                    {showAssetScan ? 'Hide Asset Scan' : 'Load Asset Scan'}
                  </Button>
                </CardContent>
              </Card>
              {showAssetScan && <EventImageGallery key={`${event.id}-${event.sourceFile}`} event={event} />}

              {bgmCandidates.length > 0 && (
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm'>Detected BGM</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {bgmCandidates.map((url) => (
                      <BgmAudioPlayer key={url} url={url} />
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>{language === 'jp' ? '解析済み情報' : 'Parsed Info'}</CardTitle>
                </CardHeader>
                <CardContent className='space-y-2 text-sm'>
                  <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                    <div><span className='text-muted-foreground'>Type:</span> {parsedEvent.type}</div>
                    {parsedEvent.questCategory && (
                      <div><span className='text-muted-foreground'>Quest Category:</span> {parsedEvent.questCategory}</div>
                    )}
                    <div><span className='text-muted-foreground'>Status:</span> {parsedEvent.status}</div>
                    <div><span className='text-muted-foreground'>Start:</span> {parsedEvent.start}</div>
                    <div><span className='text-muted-foreground'>End:</span> {parsedEvent.end}</div>
                    <div><span className='text-muted-foreground'>Duration:</span> {parsedEvent.durationDays} days</div>
                    <div><span className='text-muted-foreground'>Source:</span> {parsedEvent.source}</div>
                  </div>
                  <div><span className='text-muted-foreground'>Title (EN):</span> {parsedEvent.titleEn}</div>
                  <div><span className='text-muted-foreground'>Title (JP):</span> {parsedEvent.titleJp}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm'>{language === 'jp' ? '未解析データ' : 'Unparsed Raw Data'}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!showRawData ? (
                    <div className='space-y-2'>
                      <p className='text-xs text-muted-foreground'>
                        {language === 'jp'
                          ? '未解析データは大きいため、必要なときだけ読み込みます。'
                          : 'Raw payload can be large. Load it on demand.'}
                      </p>
                      <Button size='sm' variant='outline' onClick={() => setShowRawData(true)}>
                        {language === 'jp' ? '未解析データを読み込む' : 'Load Raw Data'}
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className='h-[320px] rounded-md border p-3'>
                      <pre className='text-xs whitespace-pre-wrap break-words'>{rawEventJson}</pre>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [language, setLanguage] = useState<'en' | 'jp'>('en');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const [search, setSearch] = useState('');
  const [bgmOnly, setBgmOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [questCategoryFilter, setQuestCategoryFilter] = useState<QuestCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all');
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const [selectedDayPage, setSelectedDayPage] = useState(1);
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const lang = language === 'jp' ? 'jp' : 'en';
        const [rewardRes, staminaRes, challengeRes, gachaRes, activeMissionRes, loginBonusRes, questListRes] = await Promise.all([
          fetch(`/api/orderedmap/data?category=campaign&file=reward_campaign&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=campaign&file=stamina_campaign&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=campaign&file=daily_challenge_point_campaign&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=gacha&file=gacha&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=active_mission&file=active_mission_event&lang=${lang}`),
          fetch(`/api/orderedmap/data?category=bonus&file=login_bonus&lang=${lang}`),
          fetch(`/api/quests/list?lang=${lang}`),
        ]);

        const [rewardJson, staminaJson, challengeJson, gachaJson, activeMissionJson, loginBonusJson] =
          (await Promise.all([
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
              const res = await fetch(
                `/api/orderedmap/data?category=quest&file=${encodeURIComponent(file)}&lang=${lang}`
              );
              if (!res.ok) return null;
              const json = (await res.json()) as RawApiPayload;
              return { file, data: json.data || {} };
            } catch {
              return null;
            }
          })
        );

        const questEvents = questPayloads
          .filter((entry): entry is { file: string; data: Record<string, unknown> } => !!entry)
          .flatMap((entry) => parseQuestEventsFromFile(entry.file, entry.data));

        const parsed = [
          ...questEvents,
          ...parseRewardEvents(rewardJson.data || {}),
          ...parseStaminaEvents(staminaJson.data || {}),
          ...parseChallengeEvents(challengeJson.data || {}),
          ...parseGachaEvents(gachaJson.data || {}),
          ...parseActiveMissionEvents(activeMissionJson.data || {}),
          ...parseLoginBonusEvents(loginBonusJson.data || {}),
        ];

        const sane = parsed.filter((event) => isSaneDateRange(event.startAt, event.endAt));

        sane.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
        setEvents(sane);

        if (sane.length > 0) {
          const first = sane[0].startAt;
          setMonth(new Date(first.getFullYear(), first.getMonth(), 1));
          setSelectedDate(startOfDay(first));
        }
      } catch (err) {
        console.error('Failed to load calendar events:', err);
        setError('Failed to load event calendar.');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [language]);

  const now = useMemo(() => new Date(), []);

  const bgmByEventKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const event of events) {
      const candidates = new Set<string>();
      collectBgmCandidatesFromRaw(event.data, candidates);
      map.set(getEventKey(event), candidates.size > 0);
    }
    return map;
  }, [events]);

  const bgmEventCount = useMemo(() => {
    let count = 0;
    for (const hasBgm of bgmByEventKey.values()) {
      if (hasBgm) count += 1;
    }
    return count;
  }, [bgmByEventKey]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((event) => {
      const eventKey = getEventKey(event);
      if (bgmOnly && !bgmByEventKey.get(eventKey)) return false;
      if (typeFilter !== 'all' && event.type !== typeFilter) return false;
      if (questCategoryFilter !== 'all') {
        if (event.questCategory !== questCategoryFilter) return false;
      }
      const status = getEventStatus(event, now);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${event.id} ${event.title} ${event.titleJp} ${event.sourceFile}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, bgmByEventKey, bgmOnly, typeFilter, questCategoryFilter, statusFilter, search, now]);

  const typeCounts = useMemo(() => {
    const map = new Map<EventType, number>();
    for (const event of events) {
      map.set(event.type, (map.get(event.type) || 0) + 1);
    }
    return map;
  }, [events]);

  const questEventCount = useMemo(() => {
    return events.filter((event) => event.questCategory !== null).length;
  }, [events]);

  const questCategoryCounts = useMemo(() => {
    const map = new Map<QuestCategory, number>([
      ['gacha_banner', 0],
      ['advent_event', 0],
      ['carnival_event', 0],
      ['raid_event', 0],
      ['ranking_event', 0],
      ['single_quest', 0],
      ['rush_event', 0],
      ['story_event', 0],
      ['world_story_event', 0],
      ['other', 0],
    ]);
    for (const event of events) {
      if (!event.questCategory) continue;
      map.set(event.questCategory, (map.get(event.questCategory) || 0) + 1);
    }
    return map;
  }, [events]);

  const statusCounts = useMemo(() => {
    const map = new Map<EventStatus, number>([
      ['live', 0],
      ['upcoming', 0],
      ['ended', 0],
    ]);
    for (const event of events) {
      const status = getEventStatus(event, now);
      map.set(status, (map.get(status) || 0) + 1);
    }
    return map;
  }, [events, now]);

  const monthEvents = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    return filteredEvents.filter((event) => event.startAt <= end && event.endAt >= start);
  }, [filteredEvents, month]);

  const selectedDayEvents = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    return filteredEvents.filter((event) => event.startAt <= dayEnd && event.endAt >= dayStart);
  }, [filteredEvents, selectedDate]);

  const selectedDayTotalPages = Math.max(1, Math.ceil(selectedDayEvents.length / SELECTED_DAY_PAGE_SIZE));
  const safeSelectedDayPage = Math.min(selectedDayPage, selectedDayTotalPages);
  const visibleSelectedDayEvents = useMemo(() => {
    const start = (safeSelectedDayPage - 1) * SELECTED_DAY_PAGE_SIZE;
    return selectedDayEvents.slice(start, start + SELECTED_DAY_PAGE_SIZE);
  }, [selectedDayEvents, safeSelectedDayPage]);

  const orderedFilteredEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const startDiff = a.startAt.getTime() - b.startAt.getTime();
      if (startDiff !== 0) return startDiff;
      return a.endAt.getTime() - b.endAt.getTime();
    });
  }, [filteredEvents]);

  const listTotalPages = Math.max(1, Math.ceil(orderedFilteredEvents.length / LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, listTotalPages);
  const visibleListEvents = useMemo(() => {
    const start = (safeListPage - 1) * LIST_PAGE_SIZE;
    return orderedFilteredEvents.slice(start, start + LIST_PAGE_SIZE);
  }, [orderedFilteredEvents, safeListPage]);

  const listPreviewByEventKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const event of visibleListEvents) {
      const previewUrls = getEventPreviewImageCandidates(event);
      if (previewUrls.length > 0) {
        map.set(getEventKey(event), previewUrls);
      }
    }
    return map;
  }, [visibleListEvents]);

  useEffect(() => {
    if (filteredEvents.length === 0) return;
    if (selectedDayEvents.length > 0) return;

    const nextDate = findNextMatchingDate(filteredEvents, selectedDate);
    if (!nextDate || sameDay(nextDate, selectedDate)) return;

    setSelectedDate(nextDate);
    setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }, [filteredEvents, selectedDayEvents, selectedDate]);

  useEffect(() => {
    setSelectedDayPage(1);
  }, [selectedDate, search, bgmOnly, typeFilter, questCategoryFilter, statusFilter]);

  useEffect(() => {
    setListPage(1);
  }, [search, bgmOnly, typeFilter, questCategoryFilter, statusFilter, language]);

  const datesWithEvents = useMemo(() => {
    const set = new Set<number>();
    for (const event of filteredEvents) {
      const start = startOfDay(event.startAt);
      const end = startOfDay(event.endAt);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(d.getTime());
      }
    }
    return [...set].map((ms) => new Date(ms));
  }, [filteredEvents]);

  const sortedEventDateMs = useMemo(() => {
    return datesWithEvents
      .map((d) => startOfDay(d).getTime())
      .sort((a, b) => a - b);
  }, [datesWithEvents]);

  const nextEventDate = useMemo(() => {
    const currentMs = startOfDay(selectedDate).getTime();
    const nextMs = sortedEventDateMs.find((ms) => ms > currentMs);
    return typeof nextMs === 'number' ? new Date(nextMs) : null;
  }, [selectedDate, sortedEventDateMs]);

  const weekDays = useMemo(() => {
    const start = weekStartSunday(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const weekBuckets = useMemo(() => {
    return weekDays.map((day) => {
      const start = startOfDay(day);
      const end = endOfDay(day);
      const dayEvents = filteredEvents
        .filter((event) => event.startAt <= end && event.endAt >= start)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      return { day, events: dayEvents };
    });
  }, [weekDays, filteredEvents]);

  const dayEventIdSet = useMemo(() => new Set(selectedDayEvents.map((event) => event.id)), [selectedDayEvents]);

  const monthLabel = useMemo(() => {
    if (language === 'jp') {
      return `${month.getFullYear()}?${month.getMonth() + 1}?`;
    }
    return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [month, language]);

  const selectedDateLabel = useMemo(() => {
    if (language === 'jp') {
      return selectedDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }, [selectedDate, language]);

  const clearFilters = () => {
    setSearch('');
    setBgmOnly(false);
    setTypeFilter('all');
    setQuestCategoryFilter('all');
    setStatusFilter('all');
  };

  const timelinePanel = useMemo(() => {
    return (
      <Card className='flex min-h-0 flex-col'>
        <CardHeader className='flex-row items-center justify-between pb-3'>
          <CardTitle className='text-base'>
            {viewMode === 'list'
              ? `${language === 'jp' ? 'Event List' : 'Event List'} (${orderedFilteredEvents.length})`
              : monthLabel}
          </CardTitle>
          {viewMode !== 'list' ? (
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='icon'
                onClick={() => {
                  const m = new Date(month);
                  m.setMonth(m.getMonth() - 1);
                  setMonth(m);
                }}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  const t = new Date();
                  setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
                  setSelectedDate(startOfDay(t));
                }}
              >
                {language === 'jp' ? '??' : 'Today'}
              </Button>
              <Button
                variant='outline'
                size='icon'
                onClick={() => {
                  const m = new Date(month);
                  m.setMonth(m.getMonth() + 1);
                  setMonth(m);
                }}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={!nextEventDate}
                onClick={() => {
                  if (!nextEventDate) return;
                  setSelectedDate(startOfDay(nextEventDate));
                  setMonth(new Date(nextEventDate.getFullYear(), nextEventDate.getMonth(), 1));
                }}
              >
                {language === 'jp' ? 'æ¬¡ã®ã‚¤ãƒ™ãƒ³ãƒˆæ—¥' : 'Next Event Date'}
              </Button>
            </div>
          ) : (
            <p className='text-xs text-muted-foreground'>
              {language === 'jp' ? '??????' : 'Sorted by start date'}
            </p>
          )}
        </CardHeader>
        <CardContent className='min-h-0 overflow-hidden'>
          {viewMode === 'month' ? (
            <div className='h-full overflow-y-auto pr-1'>
              <Calendar
                mode='single'
                month={month}
                onMonthChange={setMonth}
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                modifiers={{ hasEvents: datesWithEvents }}
                modifiersClassNames={{
                  hasEvents:
                    'relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary',
                }}
                className='rounded-lg border p-3'
              />

              <div className='mt-4'>
                <p className='mb-2 text-sm font-medium text-muted-foreground'>
                  {language === 'jp' ? '???????' : 'This Month'} ({monthEvents.length})
                </p>
                <div className='space-y-2'>
                  {monthEvents.slice(0, 40).map((event) => {
                    const status = getEventStatus(event, now);
                    return (
                      <button
                        key={`${event.id}-${event.type}`}
                        onClick={() => setSelectedEventKey(getEventKey(event))}
                        className='w-full rounded-md border p-2 text-left transition hover:bg-accent'
                      >
                        <div className='mb-1 flex flex-wrap items-center gap-2'>
                          <Badge variant='outline' className={cn('text-[10px]', getTypeColor(event.type))}>
                            {event.type}
                          </Badge>
                          {event.type === 'quest' && event.questCategory && (
                            <Badge variant='outline' className={cn('text-[10px]', getQuestCategoryColor(event.questCategory))}>
                              {getQuestCategoryLabel(event.questCategory, language)}
                            </Badge>
                          )}
                          <Badge variant='outline' className={cn('text-[10px]', getStatusColor(status))}>
                            {status}
                          </Badge>
                        </div>
                        <p className='line-clamp-2 text-sm font-medium'>
                          {language === 'jp' ? event.titleJp : event.title}
                        </p>
                        <p className='text-xs text-muted-foreground'>{formatDateRange(event.startAt, event.endAt)}</p>
                      </button>
                    );
                  })}
                  {monthEvents.length === 0 && (
                    <p className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                      {language === 'jp' ? '???????????????' : 'No events in this month.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <ScrollArea className='h-full pr-1'>
              <div className='space-y-3'>
                {weekBuckets.map(({ day, events: bucketEvents }) => {
                  const isSelected = sameDay(day, selectedDate);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(startOfDay(day))}
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition hover:bg-accent',
                        isSelected && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className='mb-2 flex items-center justify-between'>
                        <p className='text-sm font-semibold'>
                          {day.toLocaleDateString(language === 'jp' ? 'ja-JP' : 'en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <Badge variant='secondary'>{bucketEvents.length}</Badge>
                      </div>
                      <div className='space-y-1'>
                        {bucketEvents.slice(0, 3).map((event) => (
                          <p key={`${event.id}-${event.type}`} className='truncate text-xs text-muted-foreground'>
                            {language === 'jp' ? event.titleJp : event.title}
                          </p>
                        ))}
                        {bucketEvents.length === 0 && (
                          <p className='text-xs text-muted-foreground'>
                            {language === 'jp' ? '??????' : 'No events'}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className='flex h-full min-h-0 flex-col'>
              <ScrollArea className='min-h-0 flex-1 pr-1'>
                <div className='space-y-2'>
                  {visibleListEvents.map((event) => {
                    const status = getEventStatus(event, now);
                    const eventKey = getEventKey(event);
                    const previewImageUrls = listPreviewByEventKey.get(eventKey) || [];
                    return (
                      <button
                        key={eventKey}
                        type='button'
                        onClick={() => setSelectedEventKey(eventKey)}
                        className='w-full rounded-md border p-2 text-left transition hover:bg-accent'
                      >
                        <div className='flex items-start gap-3'>
                          <div className='min-w-0 flex-1'>
                            <div className='mb-1 flex flex-wrap items-center gap-2'>
                              <Badge variant='outline' className={cn('text-[10px]', getTypeColor(event.type))}>
                                {event.type}
                              </Badge>
                              {event.type === 'quest' && event.questCategory && (
                                <Badge variant='outline' className={cn('text-[10px]', getQuestCategoryColor(event.questCategory))}>
                                  {getQuestCategoryLabel(event.questCategory, language)}
                                </Badge>
                              )}
                              <Badge variant='outline' className={cn('text-[10px]', getStatusColor(status))}>
                                {status}
                              </Badge>
                            </div>
                            <p className='line-clamp-1 text-sm font-medium'>
                              {language === 'jp' ? event.titleJp : event.title}
                            </p>
                            <p className='text-xs text-muted-foreground'>{formatDateRange(event.startAt, event.endAt)}</p>
                            <p className='mt-1 truncate text-[11px] text-muted-foreground'>
                              {language === 'jp' ? '???' : 'Source'}: {event.sourceFile}
                            </p>
                          </div>
                          {previewImageUrls.length > 0 && (
                            <EventListPreviewImage
                              urls={previewImageUrls}
                              alt={`${event.type} preview`}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {orderedFilteredEvents.length === 0 && (
                    <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
                      {language === 'jp' ? '???????????????' : 'No events match your filters.'}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {orderedFilteredEvents.length > 0 && listTotalPages > 1 && (
                <div className='mt-2 flex flex-wrap items-center justify-center gap-2 border-t pt-3'>
                  <Button size='sm' variant='outline' disabled={safeListPage === 1} onClick={() => setListPage(1)}>
                    First
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeListPage === 1}
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className='px-2 text-xs text-muted-foreground'>
                    Page {safeListPage} / {listTotalPages}
                  </span>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeListPage === listTotalPages}
                    onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                  >
                    Next
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeListPage === listTotalPages}
                    onClick={() => setListPage(listTotalPages)}
                  >
                    Last
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }, [
    datesWithEvents,
    language,
    listPreviewByEventKey,
    listTotalPages,
    month,
    monthEvents,
    monthLabel,
    nextEventDate,
    now,
    orderedFilteredEvents.length,
    safeListPage,
    selectedDate,
    viewMode,
    visibleListEvents,
    weekBuckets,
  ]);
  const selectedDayPanel = useMemo(() => {
    return (
      <Card className='flex min-h-0 flex-col'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>
            {language === 'jp' ? '???' : 'Selected Day'}: {selectedDateLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className='min-h-0 overflow-hidden'>
          <ScrollArea className='h-full pr-1'>
            <div className='space-y-3'>
              {visibleSelectedDayEvents.map((event) => {
                const status = getEventStatus(event, now);
                const isHighlighted = dayEventIdSet.has(event.id);
                return (
                  <button
                    type='button'
                    onClick={() => setSelectedEventKey(getEventKey(event))}
                    key={`${event.id}-${event.type}`}
                    className={cn(
                      'w-full rounded-md border p-3 text-left transition hover:bg-accent',
                      isHighlighted && 'border-primary/40'
                    )}
                  >
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      <Badge variant='outline' className={cn('text-[10px]', getTypeColor(event.type))}>
                        {event.type}
                      </Badge>
                      {event.type === 'quest' && event.questCategory && (
                        <Badge variant='outline' className={cn('text-[10px]', getQuestCategoryColor(event.questCategory))}>
                          {getQuestCategoryLabel(event.questCategory, language)}
                        </Badge>
                      )}
                      <Badge variant='outline' className={cn('text-[10px]', getStatusColor(status))}>
                        {status}
                      </Badge>
                    </div>
                    <p className='mb-1 text-sm font-semibold'>
                      {language === 'jp' ? event.titleJp : event.title}
                    </p>
                    <p className='text-xs text-muted-foreground'>{formatDateRange(event.startAt, event.endAt)}</p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {language === 'jp' ? '??' : 'Duration'}: {getDurationDays(event.startAt, event.endAt)}{' '}
                      {language === 'jp' ? '?' : 'days'}
                    </p>
                    <p className='mt-1 break-all text-[11px] text-muted-foreground'>
                      {language === 'jp' ? '???' : 'Source'}: {event.sourceFile}
                    </p>
                  </button>
                );
              })}

              {selectedDayEvents.length === 0 && (
                <div className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  {language === 'jp' ? '???????????????' : 'No events on this day.'}
                </div>
              )}

              {selectedDayEvents.length > 0 && selectedDayTotalPages > 1 && (
                <div className='mt-2 flex flex-wrap items-center justify-center gap-2 border-t pt-3'>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeSelectedDayPage === 1}
                    onClick={() => setSelectedDayPage(1)}
                  >
                    First
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeSelectedDayPage === 1}
                    onClick={() => setSelectedDayPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className='px-2 text-xs text-muted-foreground'>
                    Page {safeSelectedDayPage} / {selectedDayTotalPages}
                  </span>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeSelectedDayPage === selectedDayTotalPages}
                    onClick={() => setSelectedDayPage((p) => Math.min(selectedDayTotalPages, p + 1))}
                  >
                    Next
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={safeSelectedDayPage === selectedDayTotalPages}
                    onClick={() => setSelectedDayPage(selectedDayTotalPages)}
                  >
                    Last
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }, [
    dayEventIdSet,
    language,
    now,
    safeSelectedDayPage,
    selectedDateLabel,
    selectedDayEvents.length,
    selectedDayTotalPages,
    visibleSelectedDayEvents,
  ]);

  const eventsByKey = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const event of events) {
      map.set(getEventKey(event), event);
    }
    return map;
  }, [events]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventKey) return null;
    return eventsByKey.get(selectedEventKey) || null;
  }, [selectedEventKey, eventsByKey]);
  const handleCloseDialog = useCallback(() => setSelectedEventKey(null), []);

  if (loading) {
    return (
      <div className='h-[calc(100vh-4rem)] bg-background p-4'>
        <div className='flex h-full items-center justify-center'>
          <Card className='w-80'>
            <CardContent className='pt-6'>
              <div className='flex flex-col items-center gap-3'>
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
                <div className='text-center'>
                  <p className='text-sm font-medium'>Loading calendar</p>
                  <p className='text-xs text-muted-foreground'>Normalizing events...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-background via-background to-muted/20'>
      <div className='mx-auto flex h-full w-full max-w-7xl flex-col p-3 sm:p-4'>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold'>
              <CalendarIcon className='h-6 w-6 text-primary' />
              {language === 'jp' ? '??????????' : 'Event Timeline'}
            </h1>
            <p className='text-sm text-muted-foreground'>
              {language === 'jp'
                ? '???????????????????????'
                : 'Filter, browse, and inspect events by month, week, or list.'}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant={viewMode === 'month' ? 'default' : 'outline'} size='sm' onClick={() => setViewMode('month')}>
              {language === 'jp' ? '??' : 'Month'}
            </Button>
            <Button variant={viewMode === 'week' ? 'default' : 'outline'} size='sm' onClick={() => setViewMode('week')}>
              {language === 'jp' ? '??' : 'Week'}
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size='sm' onClick={() => setViewMode('list')}>
              {language === 'jp' ? '??' : 'List'}
            </Button>
            <Button variant='outline' size='sm' onClick={() => setLanguage(language === 'jp' ? 'en' : 'jp')}>
              <Languages className='mr-2 h-4 w-4' />
              {language === 'jp' ? 'EN' : 'JP'}
            </Button>
          </div>
        </div>

        {error && (
          <Card className='mb-3 border-destructive/40 bg-destructive/5'>
            <CardContent className='p-3 text-sm text-destructive'>{error}</CardContent>
          </Card>
        )}

        <div
          className={cn(
            'grid min-h-0 flex-1 gap-3',
            viewMode === 'list'
              ? 'xl:grid-cols-[270px_minmax(0,1fr)]'
              : 'xl:grid-cols-[270px_minmax(0,1fr)_330px]'
          )}
        >
          <Card className='flex min-h-0 flex-col'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>{language === 'jp' ? '?????' : 'Filters'}</CardTitle>
            </CardHeader>
            <CardContent className='min-h-0 space-y-4 overflow-y-auto'>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={language === 'jp' ? '???????...' : 'Search events...'}
                  className='pl-9'
                />
              </div>
              <Button
                variant={bgmOnly ? 'default' : 'outline'}
                size='sm'
                onClick={() => setBgmOnly((v) => !v)}
                className='w-full justify-between'
              >
                <span>{language === 'jp' ? 'BGMありのみ' : 'Contains BGM'}</span>
                <Badge variant='secondary'>{bgmEventCount}</Badge>
              </Button>

              <div>
                <p className='mb-2 text-xs uppercase tracking-wide text-muted-foreground'>
                  {language === 'jp' ? '???' : 'Type'}
                </p>
                <div className='space-y-2'>
                  {TYPE_OPTIONS.map((option) => {
                    const count = option.value === 'all' ? events.length : typeCounts.get(option.value) || 0;
                    return (
                      <Button
                        key={option.value}
                        variant={typeFilter === option.value ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => setTypeFilter(option.value)}
                        className='w-full justify-between'
                      >
                        <span>{language === 'jp' ? option.jp : option.en}</span>
                        <Badge variant='secondary'>{count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className='mb-2 text-xs uppercase tracking-wide text-muted-foreground'>
                  {language === 'jp' ? 'Quest Category' : 'Quest Category'}
                </p>
                <div className='space-y-2'>
                  {QUEST_CATEGORY_OPTIONS.map((option) => {
                    const count =
                      option.value === 'all'
                        ? questEventCount
                        : questCategoryCounts.get(option.value) || 0;
                    return (
                      <Button
                        key={option.value}
                        variant={questCategoryFilter === option.value ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => setQuestCategoryFilter(option.value)}
                        className='w-full justify-between'
                      >
                        <span>{language === 'jp' ? option.jp : option.en}</span>
                        <Badge variant='secondary'>{count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className='mb-2 text-xs uppercase tracking-wide text-muted-foreground'>
                  {language === 'jp' ? '?????' : 'Status'}
                </p>
                <div className='space-y-2'>
                  {STATUS_OPTIONS.map((option) => {
                    const count =
                      option.value === 'all'
                        ? events.length
                        : statusCounts.get(option.value as EventStatus) || 0;
                    return (
                      <Button
                        key={option.value}
                        variant={statusFilter === option.value ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => setStatusFilter(option.value)}
                        className='w-full justify-between'
                      >
                        <span>{language === 'jp' ? option.jp : option.en}</span>
                        <Badge variant='secondary'>{count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Button variant='outline' size='sm' onClick={clearFilters} className='w-full'>
                {language === 'jp' ? '??????????' : 'Reset Filters'}
              </Button>
            </CardContent>
          </Card>

          {timelinePanel}
          {viewMode !== 'list' && selectedDayPanel}
        </div>
      </div>

      <EventDetailsDialog
        key={selectedEventKey ?? 'no-event'}
        event={selectedEvent}
        language={language}
        now={now}
        onClose={handleCloseDialog}
      />
    </div>
  );
}

