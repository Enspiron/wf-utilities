'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MailCheck, MailX, Shield, UserRound } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type TeamStatusCounts = {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  archived: number;
};

type SaveShareStatus = {
  total: number;
  private: number;
  unlisted: number;
  public: number;
  downloads: number;
};

type ReportStatus = {
  total: number;
  open: number;
};

type ProfilePayload = {
  userId: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  displayName: string;
  avatarUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
  emailVerified: boolean;
};

type ProfileResponse = {
  ok?: boolean;
  error?: string;
  profile?: ProfilePayload;
  status?: {
    authenticated: boolean;
    teams: TeamStatusCounts;
    saveShares: SaveShareStatus;
    reports: ReportStatus;
  };
};

function ProfilePageSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Skeleton className='h-6 w-20 rounded-full' />
        <Skeleton className='h-6 w-32 rounded-full' />
        <Skeleton className='h-6 w-28 rounded-full' />
      </div>

      <div className='grid gap-3 md:grid-cols-2'>
        <Card className='border-border/70'>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-24' />
          </CardHeader>
          <CardContent className='space-y-2'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-11/12' />
            <Skeleton className='h-4 w-10/12' />
            <Skeleton className='h-4 w-9/12' />
            <Skeleton className='h-4 w-8/12' />
          </CardContent>
        </Card>

        <Card className='border-border/70'>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-32' />
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
          </CardContent>
        </Card>

        <Card className='border-border/70'>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-24' />
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-2'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='col-span-2 h-4 w-28' />
          </CardContent>
        </Card>

        <Card className='border-border/70'>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-20' />
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-16' />
          </CardContent>
        </Card>
      </div>

      <Card className='border-border/70'>
        <CardHeader className='pb-2'>
          <Skeleton className='h-5 w-36' />
          <Skeleton className='h-4 w-56' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
            <Skeleton className='h-16 w-16' />
            <div className='grid flex-1 gap-3'>
              <div className='space-y-1'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-10 w-full' />
              </div>
              <div className='space-y-1'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-10 w-full' />
              </div>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Skeleton className='h-10 w-28' />
            <Skeleton className='h-10 w-20' />
          </div>
        </CardContent>
      </Card>

      <div className='flex flex-wrap gap-2'>
        <Skeleton className='h-10 w-24' />
        <Skeleton className='h-10 w-40' />
        <Skeleton className='h-10 w-20' />
      </div>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [status, setStatus] = useState<ProfileResponse['status'] | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [avatarUrlDraft, setAvatarUrlDraft] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [avatarPreviewBroken, setAvatarPreviewBroken] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const payload = (await response.json()) as ProfileResponse;
      if (!response.ok || !payload.ok || !payload.profile || !payload.status) {
        setError(payload.error || 'Failed to load profile.');
        setProfile(null);
        setStatus(null);
        return;
      }
      setProfile(payload.profile);
      setStatus(payload.status);
      setDisplayNameDraft(payload.profile.displayName);
      setAvatarUrlDraft(payload.profile.avatarUrl || '');
      setSaveError(null);
      setSaveMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
      setProfile(null);
      setStatus(null);
      setDisplayNameDraft('');
      setAvatarUrlDraft('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const roleLabel = useMemo(() => {
    if (!profile) return '';
    if (profile.role === 'admin') return 'Admin';
    if (profile.role === 'moderator') return 'Moderator';
    return 'User';
  }, [profile]);

  const hasProfileChanges = useMemo(() => {
    if (!profile) return false;
    return displayNameDraft.trim() !== profile.displayName || avatarUrlDraft.trim() !== (profile.avatarUrl || '');
  }, [avatarUrlDraft, displayNameDraft, profile]);

  const avatarPreviewUrl = avatarUrlDraft.trim();

  useEffect(() => {
    setAvatarPreviewBroken(false);
  }, [avatarPreviewUrl]);

  const resetProfileForm = () => {
    if (!profile) return;
    setDisplayNameDraft(profile.displayName);
    setAvatarUrlDraft(profile.avatarUrl || '');
    setSaveError(null);
    setSaveMessage(null);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    setSaveLoading(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: displayNameDraft.trim(),
          avatarUrl: avatarUrlDraft.trim() || null,
        }),
      });

      const payload = (await response.json()) as ProfileResponse & { issues?: unknown };
      if (!response.ok || !payload.ok || !payload.profile) {
        setSaveError(payload.error || 'Failed to update profile.');
        return;
      }

      setProfile(payload.profile);
      setDisplayNameDraft(payload.profile.displayName);
      setAvatarUrlDraft(payload.profile.avatarUrl || '');
      setSaveMessage('Profile updated.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 p-4'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UserRound className='h-5 w-5' />
            Profile
          </CardTitle>
          <CardDescription>Account info and community/save-sharing status.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {loading ? <ProfilePageSkeleton /> : null}
          {error ? <p className='text-sm text-destructive'>{error}</p> : null}

          {!loading && !profile ? (
            <div className='flex flex-wrap items-center gap-2'>
              <Link href='/login'>
                <Button>Login</Button>
              </Link>
              <Link href='/register'>
                <Button variant='outline'>Register</Button>
              </Link>
            </div>
          ) : null}

          {profile && status ? (
            <>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary' className='gap-1'>
                  <Shield className='h-3.5 w-3.5' />
                  {roleLabel}
                </Badge>
                <Badge variant={profile.emailVerified ? 'default' : 'destructive'} className='gap-1'>
                  {profile.emailVerified ? <MailCheck className='h-3.5 w-3.5' /> : <MailX className='h-3.5 w-3.5' />}
                  {profile.emailVerified ? 'Email Verified' : 'Email Not Verified'}
                </Badge>
                <Badge variant='outline' className='gap-1'>
                  <CheckCircle2 className='h-3.5 w-3.5' />
                  Authenticated
                </Badge>
              </div>

              <div className='grid gap-3 md:grid-cols-2'>
                <Card className='border-border/70'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>Account</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-1 text-sm text-muted-foreground'>
                    <p>
                      <span className='font-medium text-foreground'>Display:</span> {profile.displayName}
                    </p>
                    <p>
                      <span className='font-medium text-foreground'>Email:</span> {profile.email}
                    </p>
                    <p>
                      <span className='font-medium text-foreground'>User ID:</span> {profile.userId}
                    </p>
                    <p>
                      <span className='font-medium text-foreground'>Created:</span> {formatDate(profile.createdAt)}
                    </p>
                    <p>
                      <span className='font-medium text-foreground'>Updated:</span> {formatDate(profile.updatedAt)}
                    </p>
                    <p>
                      <span className='font-medium text-foreground'>Last Sign In:</span> {formatDate(profile.lastSignInAt)}
                    </p>
                  </CardContent>
                </Card>

                <Card className='border-border/70'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>Team Submissions</CardTitle>
                  </CardHeader>
                  <CardContent className='grid grid-cols-2 gap-2 text-sm'>
                    <p>Total: {status.teams.total}</p>
                    <p>Draft: {status.teams.draft}</p>
                    <p>Pending: {status.teams.pending}</p>
                    <p>Approved: {status.teams.approved}</p>
                    <p>Rejected: {status.teams.rejected}</p>
                    <p>Archived: {status.teams.archived}</p>
                  </CardContent>
                </Card>

                <Card className='border-border/70'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>Save Shares</CardTitle>
                  </CardHeader>
                  <CardContent className='grid grid-cols-2 gap-2 text-sm'>
                    <p>Total: {status.saveShares.total}</p>
                    <p>Private: {status.saveShares.private}</p>
                    <p>Unlisted: {status.saveShares.unlisted}</p>
                    <p>Public: {status.saveShares.public}</p>
                    <p className='col-span-2'>Downloads: {status.saveShares.downloads}</p>
                  </CardContent>
                </Card>

                <Card className='border-border/70'>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>Reports</CardTitle>
                  </CardHeader>
                  <CardContent className='grid grid-cols-2 gap-2 text-sm'>
                    <p>Total Filed: {status.reports.total}</p>
                    <p>Open: {status.reports.open}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className='border-border/70'>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base'>Customize Profile</CardTitle>
                  <CardDescription>Set how your profile appears in community pages.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className='space-y-4' onSubmit={(event) => void saveProfile(event)}>
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
                      <div className='flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/20'>
                        {avatarPreviewUrl && !avatarPreviewBroken ? (
                          <img
                            src={avatarPreviewUrl}
                            alt='Avatar preview'
                            className='h-full w-full object-cover'
                            onError={() => setAvatarPreviewBroken(true)}
                          />
                        ) : (
                          <UserRound className='h-8 w-8 text-muted-foreground' />
                        )}
                      </div>
                      <div className='grid flex-1 gap-3'>
                        <div className='space-y-1'>
                          <label className='text-xs text-muted-foreground'>Display Name</label>
                          <Input
                            value={displayNameDraft}
                            onChange={(event) => setDisplayNameDraft(event.target.value)}
                            minLength={2}
                            maxLength={40}
                            required
                            placeholder='Your display name'
                          />
                        </div>
                        <div className='space-y-1'>
                          <label className='text-xs text-muted-foreground'>Avatar URL</label>
                          <Input
                            value={avatarUrlDraft}
                            onChange={(event) => setAvatarUrlDraft(event.target.value)}
                            placeholder='https://...'
                          />
                        </div>
                      </div>
                    </div>

                    {saveError ? <p className='text-sm text-destructive'>{saveError}</p> : null}
                    {saveMessage ? <p className='text-sm text-emerald-400'>{saveMessage}</p> : null}

                    <div className='flex flex-wrap gap-2'>
                      <Button type='submit' disabled={saveLoading || !hasProfileChanges}>
                        {saveLoading ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button type='button' variant='outline' disabled={saveLoading || !hasProfileChanges} onClick={resetProfileForm}>
                        Reset
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className='flex flex-wrap gap-2'>
                <Link href='/community/new'>
                  <Button variant='outline'>Submit Team</Button>
                </Link>
                <Link href='/saves'>
                  <Button variant='outline'>Manage Save Shares</Button>
                </Link>
                <Button variant='destructive' onClick={() => void signOut()} disabled={signingOut}>
                  {signingOut ? 'Signing Out...' : 'Sign Out'}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
