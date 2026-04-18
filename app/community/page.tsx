'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type ContentTarget = {
  id: number;
  kind: string;
  slug: string;
  label: string;
};

type TeamRow = {
  id: string;
  title: string;
  description: string | null;
  source_type: 'save_slot' | 'eliya_link' | 'custom';
  publish_status: string;
  visibility: string;
  boss_label: string | null;
  created_at: string;
  content_targets?: { label?: string; kind?: string; slug?: string } | null;
  tags?: string[];
  raw_snapshot?: Record<string, unknown>;
};

function CommunityTeamCardSkeleton() {
  return (
    <Card className='border-border/70'>
      <CardHeader className='pb-2'>
        <Skeleton className='h-5 w-2/3' />
        <Skeleton className='h-4 w-1/2' />
      </CardHeader>
      <CardContent className='space-y-3'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
        <div className='flex flex-wrap gap-1'>
          <Skeleton className='h-5 w-14' />
          <Skeleton className='h-5 w-16' />
          <Skeleton className='h-5 w-12' />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Skeleton className='h-8 w-14' />
          <Skeleton className='h-8 w-24' />
          <Skeleton className='h-8 w-16' />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunityPage() {
  const [loading, setLoading] = useState(true);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [targets, setTargets] = useState<ContentTarget[]>([]);
  const [query, setQuery] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const fetchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', 'approved');
      if (query.trim()) params.set('q', query.trim());
      if (sourceType) params.set('sourceType', sourceType);
      if (targetId) params.set('targetId', targetId);
      if (tagFilter.trim()) params.set('tag', tagFilter.trim().toLowerCase());

      const response = await fetch(`/api/community/teams?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as { ok?: boolean; teams?: TeamRow[]; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Failed to load teams.');
        return;
      }
      setTeams(payload.teams || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async () => {
    setTargetsLoading(true);
    try {
      const response = await fetch('/api/community/content-targets', { cache: 'force-cache' });
      const payload = (await response.json()) as { ok?: boolean; targets?: ContentTarget[] };
      if (response.ok && payload.ok) {
        setTargets(payload.targets || []);
      }
    } catch {
      // non-blocking
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTargets();
  }, []);

  useEffect(() => {
    void fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, targetId, tagFilter]);

  const sourceLabel = useMemo(() => {
    return sourceType || 'all sources';
  }, [sourceType]);

  const submitReport = async (teamId: string) => {
    const reason = window.prompt('Report reason');
    if (!reason) return;

    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityType: 'team', entityId: teamId, reason }),
    });

    if (!response.ok) {
      window.alert('Could not submit report. You may need to log in.');
      return;
    }

    window.alert('Report submitted.');
  };

  return (
    <div className='mx-auto w-full max-w-6xl space-y-4 p-4'>
      <Card>
        <CardHeader>
          <CardTitle>Community Teams</CardTitle>
          <CardDescription>Browse approved team submissions by boss/content and source type.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap gap-2'>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search title, description, boss...'
              className='min-w-[220px] flex-1'
            />
            <select
              className='h-10 rounded-md border bg-background px-3 text-sm'
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value=''>All Sources</option>
              <option value='save_slot'>Save Import</option>
              <option value='eliya_link'>Eliya Link</option>
              <option value='custom'>Custom</option>
            </select>
            {targetsLoading ? (
              <Skeleton className='h-10 w-[150px]' />
            ) : (
              <select
                className='h-10 rounded-md border bg-background px-3 text-sm'
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value=''>All Targets</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            )}
            <Input
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder='Tag'
              className='w-32'
            />
            <Button onClick={() => void fetchTeams()}>Search</Button>
            <Link href='/community/new'>
              <Button variant='secondary'>New Team</Button>
            </Link>
            <Link href='/community/moderation'>
              <Button variant='outline'>Moderation</Button>
            </Link>
            <Link href='/saves'>
              <Button variant='outline'>Save Shares</Button>
            </Link>
          </div>

          <p className='text-xs text-muted-foreground'>Showing {teams.length} teams ({sourceLabel}).</p>

          {error ? <p className='text-sm text-destructive'>{error}</p> : null}

          <div className='grid gap-3 md:grid-cols-2'>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => <CommunityTeamCardSkeleton key={`community-team-skeleton-${index}`} />)
              : teams.map((team) => {
              const maybeLink = typeof team.raw_snapshot?.link === 'string' ? String(team.raw_snapshot.link) : null;
              return (
                <Card key={team.id} className='border-border/70'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>{team.title}</CardTitle>
                    <CardDescription>
                      {team.content_targets?.label || team.boss_label || 'No target'} - {team.source_type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-2'>
                    {team.description ? <p className='text-sm text-muted-foreground'>{team.description}</p> : null}
                    <div className='flex flex-wrap gap-1'>
                      {(team.tags || []).map((tag) => (
                        <span key={tag} className='rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Link href={`/community/${team.id}`}>
                        <Button variant='outline' size='sm'>
                          Open
                        </Button>
                      </Link>
                      {maybeLink ? (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => navigator.clipboard.writeText(maybeLink).catch(() => undefined)}
                        >
                          Copy Eliya
                        </Button>
                      ) : null}
                      <Button variant='outline' size='sm' onClick={() => void submitReport(team.id)}>
                        Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!loading && !error && teams.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No teams matched the current filters.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
