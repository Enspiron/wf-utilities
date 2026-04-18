'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type TeamRow = {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  publish_status: string;
  boss_label: string | null;
  created_at: string;
  owner_id: string;
};

function ModerationQueueCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-5 w-2/3' />
        <Skeleton className='h-4 w-1/2' />
      </CardHeader>
      <CardContent className='space-y-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-4/5' />
        <div className='flex flex-wrap gap-2'>
          <Skeleton className='h-8 w-16' />
          <Skeleton className='h-8 w-20' />
          <Skeleton className='h-8 w-16' />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunityModerationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/community/teams?status=pending', { cache: 'no-store' });
      const payload = (await response.json()) as { ok?: boolean; teams?: TeamRow[]; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Failed to load moderation queue.');
        return;
      }
      setTeams(payload.teams || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPending();
  }, []);

  const decide = async (teamId: string, action: 'approve' | 'reject') => {
    const note = window.prompt(action === 'approve' ? 'Optional approval note' : 'Rejection reason');
    if (note === null) return;

    const response = await fetch(`/api/moderation/teams/${teamId}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      window.alert(payload.error || `Failed to ${action} team.`);
      return;
    }

    setTeams((current) => current.filter((team) => team.id !== teamId));
  };

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>Moderation Queue</h1>
          <p className='text-sm text-muted-foreground'>Approve or reject pending community team submissions.</p>
        </div>
        <Link href='/community'>
          <Button variant='outline'>Back</Button>
        </Link>
      </div>

      {error ? <p className='text-sm text-destructive'>{error}</p> : null}

      <div className='grid gap-3'>
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <ModerationQueueCardSkeleton key={`moderation-skeleton-${index}`} />)
          : teams.map((team) => (
              <Card key={team.id}>
                <CardHeader>
                  <CardTitle className='text-base'>{team.title}</CardTitle>
                  <CardDescription>
                    {team.source_type} - owner {team.owner_id.slice(0, 8)} - {new Date(team.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-2'>
                  {team.description ? <p className='text-sm text-muted-foreground'>{team.description}</p> : null}
                  {team.boss_label ? <p className='text-xs text-muted-foreground'>Target: {team.boss_label}</p> : null}
                  <div className='flex flex-wrap gap-2'>
                    <Link href={`/community/${team.id}`}>
                      <Button variant='outline' size='sm'>
                        Open
                      </Button>
                    </Link>
                    <Button variant='secondary' size='sm' onClick={() => void decide(team.id, 'approve')}>
                      Approve
                    </Button>
                    <Button variant='outline' size='sm' className='text-destructive' onClick={() => void decide(team.id, 'reject')}>
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {!loading && !error && teams.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No pending teams.</p>
      ) : null}
    </div>
  );
}
