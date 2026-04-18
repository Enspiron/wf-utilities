'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type TeamBuild = {
  mainUnitIds: number[];
  unisonUnitIds: number[];
  equipmentIds: number[];
  soulIds: number[];
  slotMeta?: Record<string, unknown>;
};

type ContentTarget = {
  id: number;
  kind: string;
  slug: string;
  label: string;
};

const EMPTY_BUILD: TeamBuild = {
  mainUnitIds: [0, 0, 0],
  unisonUnitIds: [0, 0, 0],
  equipmentIds: [0, 0, 0],
  soulIds: [0, 0, 0],
};

function parseTriplet(input: string): number[] {
  const values = input
    .split(',')
    .map((token) => Number.parseInt(token.trim(), 10))
    .map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  return [values[0] || 0, values[1] || 0, values[2] || 0];
}

export default function NewCommunityTeamPage() {
  const [targets, setTargets] = useState<ContentTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [mode, setMode] = useState<'save' | 'eliya' | 'custom'>('save');
  const [saveJsonText, setSaveJsonText] = useState('');
  const [groupId, setGroupId] = useState('1');
  const [slotId, setSlotId] = useState('1');
  const [eliyaLink, setEliyaLink] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState('');
  const [bossLabel, setBossLabel] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [submitNow, setSubmitNow] = useState(true);

  const [mainText, setMainText] = useState('0,0,0');
  const [unisonText, setUnisonText] = useState('0,0,0');
  const [equipmentText, setEquipmentText] = useState('0,0,0');
  const [soulText, setSoulText] = useState('0,0,0');

  const [build, setBuild] = useState<TeamBuild>(EMPTY_BUILD);
  const [rawSnapshot, setRawSnapshot] = useState<Record<string, unknown>>({ source: 'custom' });
  const [sourceType, setSourceType] = useState<'save_slot' | 'eliya_link' | 'custom'>('custom');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setTargetsLoading(true);
      try {
        const response = await fetch('/api/community/content-targets');
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
    void run();
  }, []);

  const handleSaveFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setSaveJsonText(text);
    } finally {
      event.target.value = '';
    }
  };

  const handleImportFromSave = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setWarnings([]);

    try {
      const saveJson = JSON.parse(saveJsonText);
      const response = await fetch('/api/community/teams/import/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ saveJson, groupId, slotId }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        title?: string;
        sourceType?: 'save_slot' | 'eliya_link' | 'custom';
        build?: TeamBuild;
        rawSnapshot?: Record<string, unknown>;
        warnings?: string[];
      };

      if (!response.ok || !payload.ok || !payload.build || !payload.sourceType) {
        setError(payload.error || 'Import failed.');
        return;
      }

      setTitle(payload.title || title);
      setBuild(payload.build);
      setRawSnapshot(payload.rawSnapshot || {});
      setSourceType(payload.sourceType);
      setWarnings(payload.warnings || []);
      setMessage('Imported team from save slot.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromEliya = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setWarnings([]);

    try {
      const response = await fetch('/api/community/teams/import/eliya', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ link: eliyaLink }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        title?: string;
        sourceType?: 'save_slot' | 'eliya_link' | 'custom';
        build?: TeamBuild;
        rawSnapshot?: Record<string, unknown>;
        warnings?: string[];
      };

      if (!response.ok || !payload.ok || !payload.build || !payload.sourceType) {
        setError(payload.error || 'Import failed.');
        return;
      }

      setTitle(payload.title || title);
      setBuild(payload.build);
      setRawSnapshot(payload.rawSnapshot || {});
      setSourceType(payload.sourceType);
      setWarnings(payload.warnings || []);
      setMessage('Imported team from Eliya link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustom = () => {
    const nextBuild: TeamBuild = {
      mainUnitIds: parseTriplet(mainText),
      unisonUnitIds: parseTriplet(unisonText),
      equipmentIds: parseTriplet(equipmentText),
      soulIds: parseTriplet(soulText),
      slotMeta: { source: 'custom' },
    };
    setBuild(nextBuild);
    setRawSnapshot({ source: 'custom' });
    setSourceType('custom');
    setMessage('Applied custom team build values.');
    setWarnings([]);
    setError(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/community/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          sourceType,
          targetId: targetId ? Number.parseInt(targetId, 10) : undefined,
          bossLabel: bossLabel || undefined,
          tags: tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          build,
          rawSnapshot,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; team?: { id: string } };
      if (!response.ok || !payload.ok || !payload.team?.id) {
        setError(payload.error || 'Failed to create team.');
        return;
      }

      if (submitNow) {
        const submitResponse = await fetch(`/api/community/teams/${payload.team.id}/submit`, { method: 'POST' });
        const submitPayload = (await submitResponse.json()) as { ok?: boolean; error?: string };
        if (!submitResponse.ok || !submitPayload.ok) {
          setError(submitPayload.error || 'Team created, but submission failed.');
          return;
        }
        setMessage('Team created and submitted for moderation.');
      } else {
        setMessage('Team created as draft.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Submit Community Team</h1>
        <Link href='/community'>
          <Button variant='outline'>Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Source</CardTitle>
          <CardDescription>Choose save slot import, Eliya import, or custom build.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap gap-2'>
            <Button variant={mode === 'save' ? 'default' : 'outline'} onClick={() => setMode('save')}>
              Save Slot
            </Button>
            <Button variant={mode === 'eliya' ? 'default' : 'outline'} onClick={() => setMode('eliya')}>
              Eliya Link
            </Button>
            <Button variant={mode === 'custom' ? 'default' : 'outline'} onClick={() => setMode('custom')}>
              Custom
            </Button>
          </div>

          {mode === 'save' ? (
            <div className='space-y-2'>
              <textarea
                className='min-h-40 w-full rounded-md border bg-background p-2 text-xs'
                value={saveJsonText}
                onChange={(event) => setSaveJsonText(event.target.value)}
                placeholder='Paste save JSON here...'
              />
              <div className='flex flex-wrap items-center gap-2'>
                <Input type='file' accept='.json,application/json' onChange={handleSaveFile} className='max-w-xs' />
                <Input value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder='Group ID' className='w-24' />
                <Input value={slotId} onChange={(event) => setSlotId(event.target.value)} placeholder='Slot ID' className='w-24' />
                <Button onClick={() => void handleImportFromSave()} disabled={loading || !saveJsonText.trim()}>
                  Import Save Slot
                </Button>
              </div>
            </div>
          ) : null}

          {mode === 'eliya' ? (
            <div className='flex flex-wrap items-center gap-2'>
              <Input
                value={eliyaLink}
                onChange={(event) => setEliyaLink(event.target.value)}
                placeholder='https://eliya-bot.herokuapp.com/comp/...'
                className='min-w-[280px] flex-1'
              />
              <Button onClick={() => void handleImportFromEliya()} disabled={loading || !eliyaLink.trim()}>
                Import Eliya
              </Button>
            </div>
          ) : null}

          {mode === 'custom' ? (
            <div className='grid gap-2 sm:grid-cols-2'>
              <Input value={mainText} onChange={(event) => setMainText(event.target.value)} placeholder='Main IDs: a,b,c' />
              <Input value={unisonText} onChange={(event) => setUnisonText(event.target.value)} placeholder='Unison IDs: a,b,c' />
              <Input
                value={equipmentText}
                onChange={(event) => setEquipmentText(event.target.value)}
                placeholder='Equipment IDs: a,b,c'
              />
              <Input value={soulText} onChange={(event) => setSoulText(event.target.value)} placeholder='Soul IDs: a,b,c' />
              <div className='sm:col-span-2'>
                <Button onClick={handleApplyCustom}>Apply Custom Build</Button>
              </div>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className='space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200'>
              {warnings.map((warning, index) => (
                <p key={`${warning}-${index}`}>- {warning}</p>
              ))}
            </div>
          ) : null}

          <p className='text-xs text-muted-foreground'>
            Build preview: main [{build.mainUnitIds.join(', ')}], unison [{build.unisonUnitIds.join(', ')}], equipment [{build.equipmentIds.join(', ')}], souls [{build.soulIds.join(', ')}]
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className='space-y-3' onSubmit={handleCreate}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder='Team title' required />
            <textarea
              className='min-h-24 w-full rounded-md border bg-background p-2 text-sm'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder='Describe this team and strategy...'
            />
            <div className='grid gap-2 sm:grid-cols-2'>
              {targetsLoading ? (
                <Skeleton className='h-10 w-full' />
              ) : (
                <select
                  className='h-10 rounded-md border bg-background px-3 text-sm'
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  <option value=''>Select target (optional)</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
              )}
              <Input value={bossLabel} onChange={(event) => setBossLabel(event.target.value)} placeholder='Boss/content fallback label' />
            </div>
            <Input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder='Tags (comma separated)' />

            <label className='flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={submitNow} onChange={(event) => setSubmitNow(event.target.checked)} />
              Submit immediately for moderation
            </label>

            {error ? <p className='text-sm text-destructive'>{error}</p> : null}
            {message ? <p className='text-sm text-emerald-400'>{message}</p> : null}

            <div className='flex flex-wrap gap-2'>
              <Button type='submit' disabled={loading}>
                {loading ? 'Saving...' : 'Create Team'}
              </Button>
              <Link href='/community'>
                <Button type='button' variant='outline'>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
