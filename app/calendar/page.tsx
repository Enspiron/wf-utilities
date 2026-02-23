'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { DayClickEventHandler } from 'react-day-picker';
import { Calendar as CalendarIcon, Loader2, Languages } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CampaignEvent {
  id: string;
  type: 'reward' | 'stamina' | 'challenge' | 'gacha' | 'active_mission' | 'login_bonus';
  startDate: Date;
  endDate: Date;
  data: Record<string, unknown>;
  name?: string;
  nameJp?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CampaignEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'reward' | 'stamina' | 'challenge' | 'gacha' | 'active_mission' | 'login_bonus'>('all');
  const [language, setLanguage] = useState<'jp' | 'en'>('en');
  const hasInitialized = useRef(false);

  useEffect(() => {
    loadCampaignData();
  }, []);

  async function loadCampaignData() {
    setLoading(true);
    try {
      // Fetch all event types with dates
      const [rewardRes, staminaRes, challengeRes, gachaRes, activeMissionRes, loginBonusRes] = await Promise.all([
        fetch('/api/orderedmap/data?category=campaign&file=reward_campaign'),
        fetch('/api/orderedmap/data?category=campaign&file=stamina_campaign'),
        fetch('/api/orderedmap/data?category=campaign&file=daily_challenge_point_campaign'),
        fetch('/api/orderedmap/data?category=gacha&file=gacha'),
        fetch('/api/orderedmap/data?category=active_mission&file=active_mission_event'),
        fetch('/api/orderedmap/data?category=bonus&file=login_bonus'),
      ]);

      const [rewardData, staminaData, challengeData, gachaData, activeMissionData, loginBonusData] = await Promise.all([
        rewardRes.json(),
        staminaRes.json(),
        challengeRes.json(),
        gachaRes.json(),
        activeMissionRes.json(),
        loginBonusRes.json(),
      ]);

      const allEvents: CampaignEvent[] = [];

      // Parse reward campaigns
      if (rewardData.data) {
        Object.entries(rewardData.data).forEach(([id, data]) => {
          if (Array.isArray(data) && data[1] && data[2]) {
            const startDate = new Date(data[1] as string);
            const endDate = new Date(data[2] as string);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              allEvents.push({
                id,
                type: 'reward',
                startDate,
                endDate,
                data: { raw: data },
              });
            }
          }
        });
      }

      // Parse stamina campaigns
      if (staminaData.data) {
        Object.entries(staminaData.data).forEach(([id, data]) => {
          if (Array.isArray(data) && data[1] && data[2]) {
            const startDate = new Date(data[1] as string);
            const endDate = new Date(data[2] as string);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              allEvents.push({
                id,
                type: 'stamina',
                startDate,
                endDate,
                data: { raw: data },
              });
            }
          }
        });
      }

      // Parse challenge campaigns
      if (challengeData.data) {
        Object.entries(challengeData.data).forEach(([id, data]) => {
          if (Array.isArray(data) && data[1] && data[2]) {
            const startDate = new Date(data[1] as string);
            const endDate = new Date(data[2] as string);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              allEvents.push({
                id,
                type: 'challenge',
                startDate,
                endDate,
                data: { raw: data },
              });
            }
          }
        });
      }

      // Parse gacha events (dates at indices 29, 30)
      if (gachaData.data) {
        Object.entries(gachaData.data).forEach(([id, data]) => {
          if (Array.isArray(data) && data[29] && data[30]) {
            const startDate = new Date(data[29] as string);
            const endDate = new Date(data[30] as string);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              allEvents.push({
                id,
                type: 'gacha',
                startDate,
                endDate,
                nameJp: data[1] as string,
                name: data[0] as string,
                data: { raw: data },
              });
            }
          }
        });
      }

      // Parse active mission events (dates at indices 14, 15)
      if (activeMissionData.data) {
        Object.entries(activeMissionData.data).forEach(([id, data]) => {
          if (Array.isArray(data) && data[14]) {
            const startDate = new Date(data[14] as string);
            // Use end date if available, otherwise use a far future date
            const endDateStr = data[15] && data[15] !== '(None)' ? data[15] as string : '2099-12-31 23:59:59';
            const endDate = new Date(endDateStr);
            
            // Only add if both dates are valid
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              allEvents.push({
                id,
                type: 'active_mission',
                startDate,
                endDate,
                nameJp: data[1] as string,
                name: data[0] as string,
                data: { raw: data },
              });
            }
          }
        });
      }

      // Parse login bonus (nested structure, dates at indices 40, 41)
      if (loginBonusData.data) {
        Object.entries(loginBonusData.data).forEach(([category, categoryData]) => {
          if (typeof categoryData === 'object' && categoryData !== null) {
            Object.entries(categoryData).forEach(([id, data]) => {
              if (Array.isArray(data) && data[40] && data[41]) {
                const startDate = new Date(data[40] as string);
                const endDate = new Date(data[41] as string);
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                  allEvents.push({
                    id: `${category}_${id}`,
                    type: 'login_bonus',
                    startDate,
                    endDate,
                    nameJp: `ログインボーナス - ${category}`,
                    name: `Login Bonus - ${category}`,
                    data: { raw: data },
                  });
                }
              }
            });
          }
        });
      }

      // Sort by start date and filter out invalid/test dates
      // Only keep reasonable dates (post-2000, pre-2100) to exclude test data
      const filteredEvents = allEvents.filter(event => {
        const startYear = event.startDate.getFullYear();
        const endYear = event.endDate.getFullYear();
        // Filter out obvious test dates and far future placeholders
        return startYear >= 2000 && startYear < 2100 && 
               endYear >= 2000 && endYear < 2100;
      });
      
      filteredEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      
      console.log('Total events:', allEvents.length);
      console.log('Filtered events:', filteredEvents.length);
      if (filteredEvents.length > 0) {
        console.log('First event:', filteredEvents[0].startDate.toISOString(), filteredEvents[0]);
        console.log('Last event:', filteredEvents[filteredEvents.length - 1].endDate.toISOString(), filteredEvents[filteredEvents.length - 1]);
      }
      
      setEvents(filteredEvents);
      
      // Set initial date to first event's month on first load
      if (filteredEvents.length > 0 && !hasInitialized.current) {
        const firstDate = filteredEvents[0].startDate;
        setMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
        hasInitialized.current = true;
      }
    } catch (error) {
      console.error('Error loading campaign data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const time = date.getTime();
    return filteredEvents.filter(event => {
      if (!event.startDate || !event.endDate || 
          isNaN(event.startDate.getTime()) || isNaN(event.endDate.getTime())) {
        return false;
      }
      return time >= event.startDate.getTime() && time <= event.endDate.getTime();
    });
  };

  // Create modifiers for react-day-picker
  const datesWithEvents = useMemo<Date[]>(() => {
    const dates: Date[] = [];

    // Collect all dates that have events
    filteredEvents.forEach(event => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
    });

    return dates;
  }, [filteredEvents]);

  const handleDayClick: DayClickEventHandler = (day) => {
    const eventsForDay = getEventsForDate(day);
    if (eventsForDay.length > 0) {
      setSelectedDate(day);
    }
  };

  // Month display events (events that overlap with current month)
  const monthEvents = useMemo(() => {
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    const monthStart = new Date(year, monthNum, 1);
    const monthEnd = new Date(year, monthNum + 1, 0, 23, 59, 59);
    
    return filteredEvents.filter(event => {
      return (event.startDate <= monthEnd && event.endDate >= monthStart);
    });
  }, [month, filteredEvents]);

  const dateRange = useMemo(() => {
    if (events.length === 0) return { min: new Date(), max: new Date() };
    const validDates = events.flatMap(e => {
      const dates = [];
      if (e.startDate && !isNaN(e.startDate.getTime())) dates.push(e.startDate);
      if (e.endDate && !isNaN(e.endDate.getTime())) dates.push(e.endDate);
      return dates;
    });
    if (validDates.length === 0) return { min: new Date(), max: new Date() };
    return {
      min: new Date(Math.min(...validDates.map(d => d.getTime()))),
      max: new Date(Math.max(...validDates.map(d => d.getTime())))
    };
  }, [events]);

  function getEventColor(type: string) {
    switch (type) {
      case 'reward':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'stamina':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
      case 'challenge':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'gacha':
        return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
      case 'active_mission':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'login_bonus':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  }

  function getEventLabel(type: string) {
    switch (type) {
      case 'reward': return language === 'jp' ? '報酬キャンペーン' : 'Reward Campaign';
      case 'stamina': return language === 'jp' ? 'スタミナキャンペーン' : 'Stamina Campaign';
      case 'challenge': return language === 'jp' ? 'チャレンジキャンペーン' : 'Challenge Campaign';
      case 'gacha': return language === 'jp' ? 'ガチャ' : 'Gacha';
      case 'active_mission': return language === 'jp' ? 'アクティブミッション' : 'Active Mission';
      case 'login_bonus': return language === 'jp' ? 'ログインボーナス' : 'Login Bonus';
      default: return type;
    }
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function formatRange(startMs: number, endMs: number) {
    const s = new Date(startMs);
    const e = new Date(endMs);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
  }

  function focusEvent(ev: CampaignEvent) {
    const start = ev.startDate;
    setMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setSelectedEvent(ev);
  }

  const monthYearText = useMemo(() => {
    const year = month.getFullYear();
    const monthNum = month.getMonth();
    if (language === 'jp') {
      return `${year}年${monthNum + 1}月`;
    }
    return month.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }, [month, language]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-80">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium">Loading Campaign Calendar</p>
                <p className="text-xs text-muted-foreground mt-1">Parsing event data...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <CalendarIcon className="h-16 w-16 text-muted-foreground opacity-50" />
              <div className="text-center">
                <p className="text-lg font-medium">No Events Found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Unable to load calendar events. Check console for errors.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8 text-primary" />
              {language === 'jp' ? 'キャンペーンカレンダー' : 'Campaign Calendar'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'jp' ? 'すべてのゲームイベントとキャンペーン' : 'View all game events and campaigns'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              aria-label="Filter events by type"
            >
              <option value="all">{language === 'jp' ? 'すべて' : 'All Events'} ({events.length})</option>
              <option value="reward">{language === 'jp' ? '報酬' : 'Reward'} ({events.filter(e => e.type === 'reward').length})</option>
              <option value="stamina">{language === 'jp' ? 'スタミナ' : 'Stamina'} ({events.filter(e => e.type === 'stamina').length})</option>
              <option value="challenge">{language === 'jp' ? 'チャレンジ' : 'Challenge'} ({events.filter(e => e.type === 'challenge').length})</option>
              <option value="gacha">{language === 'jp' ? 'ガチャ' : 'Gacha'} ({events.filter(e => e.type === 'gacha').length})</option>
              <option value="active_mission">{language === 'jp' ? 'ミッション' : 'Missions'} ({events.filter(e => e.type === 'active_mission').length})</option>
              <option value="login_bonus">{language === 'jp' ? 'ログボ' : 'Login Bonus'} ({events.filter(e => e.type === 'login_bonus').length})</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === 'jp' ? 'en' : 'jp')}
            >
              <Languages className="h-4 w-4 mr-2" />
              {language === 'jp' ? 'EN' : 'JP'}
            </Button>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left Panel: Event List */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">
                {language === 'jp' ? 'イベント' : 'Events'}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {monthEvents.length} {language === 'jp' ? '件' : 'events'} in {monthYearText}
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-3">
                  {monthEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      {language === 'jp' ? 'イベントがありません' : 'No events found'}
                    </div>
                  ) : (
                    monthEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => focusEvent(ev)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md border transition",
                          selectedEvent?.id === ev.id
                            ? 'bg-primary/10 border-primary'
                            : 'border-border hover:bg-accent'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className={cn("text-[10px]", getEventColor(ev.type))}>
                            {getEventLabel(ev.type)}
                          </Badge>
                        </div>
                        <div className="mt-1">
                          <div className="text-sm font-medium line-clamp-2">
                            {language === 'jp' 
                              ? (ev.nameJp || ev.name || getEventLabel(ev.type))
                              : (ev.name || ev.nameJp || getEventLabel(ev.type))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatRange(ev.startDate.getTime(), ev.endDate.getTime())}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Panel: Calendar Grid */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl">
                {monthYearText}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                month={month}
                onMonthChange={setMonth}
                modifiers={{
                  hasEvents: datesWithEvents,
                }}
                modifiersClassNames={{
                  hasEvents: 'relative before:absolute before:bottom-1 before:left-1/2 before:-translate-x-1/2 before:w-1 before:h-1 before:bg-primary before:rounded-full',
                }}
                onDayClick={handleDayClick}
                captionLayout="dropdown"
                fromDate={dateRange.min}
                toDate={dateRange.max}
                className="rounded-lg border p-3"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                  ),
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: cn(
                    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
                    "[&:has([data-hasEvents])]:font-semibold"
                  ),
                  day: cn(
                    "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
                  ),
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Day Events Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-2xl">
          {selectedDate && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {language === 'jp' 
                    ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日のイベント`
                    : `Events on ${selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event) => (
                    <Card
                      key={event.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedDate(null);
                        setSelectedEvent(event);
                      }}
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getEventColor(event.type)}>
                              {getEventLabel(event.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">ID: {event.id}</span>
                          </div>
                          
                          {(event.name || event.nameJp) && (
                            <h3 className="font-semibold">
                              {language === 'jp' 
                                ? event.nameJp || event.name 
                                : event.name || event.nameJp}
                            </h3>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDate(event.startDate)}</span>
                            <span>→</span>
                            <span>{formatDate(event.endDate)}</span>
                            <span>
                              ({Math.ceil((event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60 * 60 * 24))} {language === 'jp' ? '日間' : 'days'})
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline" className={getEventColor(selectedEvent.type)}>
                    {getEventLabel(selectedEvent.type)}
                  </Badge>
                  {(selectedEvent.name || selectedEvent.nameJp) 
                    ? (language === 'jp' ? selectedEvent.nameJp || selectedEvent.name : selectedEvent.name || selectedEvent.nameJp)
                    : (language === 'jp' ? 'イベント' : 'Event')}
                </DialogTitle>
                <DialogDescription>
                  ID: {selectedEvent.id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{language === 'jp' ? '期間' : 'Duration'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{language === 'jp' ? '開始' : 'Start'}</p>
                      <p className="font-medium">{selectedEvent.startDate.toLocaleString(language === 'jp' ? 'ja-JP' : 'en-US')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{language === 'jp' ? '終了' : 'End'}</p>
                      <p className="font-medium">{selectedEvent.endDate.toLocaleString(language === 'jp' ? 'ja-JP' : 'en-US')}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {Math.ceil((selectedEvent.endDate.getTime() - selectedEvent.startDate.getTime()) / (1000 * 60 * 60 * 24))} {language === 'jp' ? '日間' : 'days'}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">{language === 'jp' ? '生データ' : 'Raw Data'}</h4>
                  <ScrollArea className="h-[300px] rounded-md border p-4">
                    <pre className="text-xs">
                      <code>{JSON.stringify(selectedEvent.data, null, 2)}</code>
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
