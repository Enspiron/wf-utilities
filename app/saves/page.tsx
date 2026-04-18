'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Visibility = 'private' | 'unlisted' | 'public';

type SaveShareRow = {
  id: string;
  slug: string;
  visibility: Visibility;
  expires_at: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
};

type SaveSharesResponse = {
  ok?: boolean;
  error?: string;
  saveShares?: SaveShareRow[];
};

const SAVE_EDITOR_LOCALSTORAGE_KEY = 'wf-save-editor-state-v1';

function SaveShareRowSkeleton() {
  return (
    <div className='rounded-md border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='space-y-1'>
          <Skeleton className='h-4 w-44' />
          <Skeleton className='h-3 w-56' />
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Skeleton className='h-8 w-24' />
          <Skeleton className='h-8 w-[200px]' />
        </div>
      </div>
      <div className='mt-3 flex flex-wrap gap-2'>
        <Skeleton className='h-8 w-24' />
        <Skeleton className='h-8 w-28' />
        <Skeleton className='h-8 w-24' />
        <Skeleton className='h-8 w-20' />
      </div>
    </div>
  );
}

function toDatetimeLocalValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function toIsoFromLocal(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function SavesPage() {
  const [rows, setRows] = useState<SaveShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveJsonText, setSaveJsonText] = useState('');
  const [createVisibility, setCreateVisibility] = useState<Visibility>('private');
  const [createExpiresAt, setCreateExpiresAt] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const refreshList = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/save-shares', { cache: 'no-store' });
      const payload = (await response.json()) as SaveSharesResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Failed to load your save shares.');
        setRows([]);
        return;
      }
      setRows(payload.saveShares || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your save shares.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshList();
  }, []);

  const loadFromEditorLocalState = () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(SAVE_EDITOR_LOCALSTORAGE_KEY);
    if (!raw) {
      setError('No local save-editor session found.');
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { saveDocument?: unknown };
      if (!parsed || typeof parsed !== 'object' || !parsed.saveDocument) {
        setError('Local save-editor session exists but has no save document.');
        return;
      }
      setSaveJsonText(JSON.stringify(parsed.saveDocument, null, 2));
      setNotice('Loaded save JSON from local Save Editor session.');
    } catch {
      setError('Could not parse local save-editor session.');
    }
  };

  const createShare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    setWarnings([]);

    try {
      const saveJson = JSON.parse(saveJsonText);
      const response = await fetch('/api/save-shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          saveJson,
          visibility: createVisibility,
          expiresAt: toIsoFromLocal(createExpiresAt) ?? undefined,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        warnings?: string[];
        slug?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Failed to create save share.');
        return;
      }

      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
      setNotice(`Created share ${payload.slug || ''}.`);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create save share.');
    } finally {
      setSaving(false);
    }
  };

  const updateShare = async (slug: string, patch: { visibility?: Visibility; expiresAt?: string | null }) => {
    setError(null);
    const response = await fetch(`/api/save-shares/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string; saveShare?: SaveShareRow };
    if (!response.ok || !payload.ok || !payload.saveShare) {
      setError(payload.error || 'Failed to update share.');
      return;
    }
    setRows((current) => current.map((row) => (row.slug === slug ? payload.saveShare! : row)));
  };

  const deleteShare = async (slug: string) => {
    if (!window.confirm(`Delete share ${slug}?`)) return;
    setError(null);
    const response = await fetch(`/api/save-shares/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.error || 'Failed to delete share.');
      return;
    }
    setRows((current) => current.filter((row) => row.slug !== slug));
  };

  const downloadShare = async (slug: string) => {
    setError(null);
    const response = await fetch(`/api/save-shares/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const payload = (await response.json()) as { ok?: boolean; error?: string; save?: unknown };
    if (!response.ok || !payload.ok || !payload.save) {
      setError(payload.error || 'Failed to download share.');
      return;
    }
    const blob = new Blob([JSON.stringify(payload.save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shared_${slug}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const cloneToEditor = (slug: string) => {
    window.location.href = `/save-editor?importShare=${encodeURIComponent(slug)}`;
  };

  const copyLink = async (slug: string) => {
    const href =
      typeof window === 'undefined'
        ? `/save-editor?importShare=${encodeURIComponent(slug)}`
        : `${window.location.origin}/save-editor?importShare=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(href);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug((current) => (current === slug ? null : current)), 1500);
    } catch {
      setError('Could not copy share link.');
    }
  };

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rows]
  );

  return (
    <div className='mx-auto w-full max-w-6xl space-y-4 p-4'>
      <Card>
        <CardHeader>
          <CardTitle>Save Shares</CardTitle>
          <CardDescription>Upload sanitized saves, manage visibility, and remix links back into Save Editor.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap gap-2'>
            <Link href='/save-editor'>
              <Button variant='outline'>Open Save Editor</Button>
            </Link>
            <Button variant='outline' onClick={loadFromEditorLocalState}>
              Load From Local Editor
            </Button>
            <Button variant='outline' onClick={() => void refreshList()} disabled={loading}>
              {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <RefreshCw className='mr-2 h-4 w-4' />}
              Refresh
            </Button>
          </div>

          <form className='space-y-3' onSubmit={createShare}>
            <textarea
              className='min-h-48 w-full rounded-md border bg-background p-2 text-xs'
              value={saveJsonText}
              onChange={(event) => setSaveJsonText(event.target.value)}
              placeholder='Paste save JSON here...'
            />
            <div className='flex flex-wrap items-end gap-2'>
              <label className='space-y-1'>
                <span className='text-xs text-muted-foreground'>Visibility</span>
                <select
                  className='h-9 rounded-md border bg-background px-2 text-sm'
                  value={createVisibility}
                  onChange={(event) => setCreateVisibility(event.target.value as Visibility)}
                >
                  <option value='private'>Private</option>
                  <option value='unlisted'>Unlisted</option>
                  <option value='public'>Public</option>
                </select>
              </label>

              <label className='space-y-1'>
                <span className='text-xs text-muted-foreground'>Expires At (optional)</span>
                <Input
                  type='datetime-local'
                  value={createExpiresAt}
                  onChange={(event) => setCreateExpiresAt(event.target.value)}
                  className='w-[220px]'
                />
              </label>

              <Button type='submit' disabled={saving || !saveJsonText.trim()}>
                {saving ? 'Creating...' : 'Create Share'}
              </Button>
            </div>
          </form>

          {error ? <p className='text-sm text-destructive'>{error}</p> : null}
          {notice ? <p className='text-sm text-emerald-400'>{notice}</p> : null}
          {warnings.length > 0 ? (
            <div className='rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200'>
              {warnings.map((warning, index) => (
                <p key={`${warning}-${index}`}>- {warning}</p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Shares</CardTitle>
          <CardDescription>Private shares are owner-only. Unlisted shares require the link.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {loading ? (
            <div className='space-y-3'>
              {Array.from({ length: 4 }).map((_, index) => (
                <SaveShareRowSkeleton key={`save-share-skeleton-${index}`} />
              ))}
            </div>
          ) : (
            <>
              {sortedRows.length === 0 ? (
                <p className='text-sm text-muted-foreground'>No shares yet. Create your first one above.</p>
              ) : null}

              {sortedRows.map((row) => (
                <div key={row.id} className='rounded-md border p-3'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div>
                      <p className='font-mono text-sm'>{row.slug}</p>
                      <p className='text-xs text-muted-foreground'>
                        Created {new Date(row.created_at).toLocaleString()} | Downloads {row.download_count}
                      </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <select
                        className='h-8 rounded-md border bg-background px-2 text-xs'
                        value={row.visibility}
                        onChange={(event) => void updateShare(row.slug, { visibility: event.target.value as Visibility })}
                      >
                        <option value='private'>Private</option>
                        <option value='unlisted'>Unlisted</option>
                        <option value='public'>Public</option>
                      </select>
                      <Input
                        type='datetime-local'
                        className='h-8 w-[200px] text-xs'
                        value={toDatetimeLocalValue(row.expires_at)}
                        onChange={(event) => {
                          const expiresAtIso = toIsoFromLocal(event.target.value);
                          void updateShare(row.slug, { expiresAt: expiresAtIso });
                        }}
                      />
                    </div>
                  </div>

                  <div className='mt-3 flex flex-wrap gap-2'>
                    <Button variant='outline' size='sm' onClick={() => void copyLink(row.slug)}>
                      {copiedSlug === row.slug ? <CheckCircle2 className='mr-1 h-4 w-4 text-emerald-400' /> : <Copy className='mr-1 h-4 w-4' />}
                      Copy Link
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => cloneToEditor(row.slug)}>
                      <Link2 className='mr-1 h-4 w-4' />
                      Clone To Editor
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => void downloadShare(row.slug)}>
                      <Download className='mr-1 h-4 w-4' />
                      Download
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      className='border-destructive/40 text-destructive hover:bg-destructive/10'
                      onClick={() => void deleteShare(row.slug)}
                    >
                      <Trash2 className='mr-1 h-4 w-4' />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
