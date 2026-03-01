'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Sparkles, WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Rarity = 3 | 4 | 5;
type SlotKey = 'slot_a' | 'slot_b';

interface ExAbility {
  id: number;
  devName: string;
  baseKey: string;
  slot: SlotKey;
  rarity: Rarity;
  value: number;
  effectCode: number;
}

interface ExStatus {
  id: number;
  devName: string;
  hp: number;
  atk: number;
  rarity: Rarity;
}

interface ExBoostPayload {
  ex_boost: {
    status_id: number;
    ability_id_list: [number, number];
  };
}

const RARITIES: Rarity[] = [5, 4, 3];

const ABILITY_LABELS: Record<string, string> = {
  atk_self: 'Self ATK +',
  skilldamage_self: 'Self Skill Damage +',
  directdamage_self: 'Self Direct Attack Damage +',
  abilitydagame_self: 'Self Ability Damage +',
  atk_party: 'Party ATK +',
  skilldamage_party: 'Party Skill Damage +',
  directdamage_party: 'Party Direct Attack Damage +',
  abilitydagame_party: 'Party Ability Damage +',
  powerflipdamage: 'Power Flip Damage +',
  hp_self: 'Self HP +',
  atk_buffextend_self: 'Self ATK Buff Duration +',
  skilldamage_buffextend_self: 'Self Skill Damage Buff Duration +',
  directdamage_buffextend_self: 'Self Direct Attack Buff Duration +',
  abilitydagame_buffextend_self: 'Self Ability Buff Duration +',
  powerflipdamage_buffextend: 'Power Flip Buff Duration +',
  piercing_buffextend: 'Penetration Buff Duration +',
  flying_buffextend: 'Float Buff Duration +',
  feverpoint_self: 'Self Fever Gain +',
  fevertime_extend: 'Fever Duration +',
  initial_skillgauge_self: 'Battle Start Skill Gauge +',
  skillgagemax_self: 'Max Skill Gauge +',
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleizeToken(value: string): string {
  return value
    .replace(/_r[345]$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toStatusLabel(devName: string): string {
  return titleizeToken(devName)
    .replace('Higher Atk', 'Higher ATK')
    .replace('Higher Hp', 'Higher HP');
}

function toAbilityLabel(baseKey: string): string {
  return ABILITY_LABELS[baseKey] || titleizeToken(baseKey);
}

function getRarityBadgeTone(rarity: Rarity): string {
  if (rarity === 5) return 'bg-amber-500/20 text-amber-200 border-amber-500/30';
  if (rarity === 4) return 'bg-slate-500/20 text-slate-200 border-slate-500/30';
  return 'bg-orange-700/20 text-orange-200 border-orange-700/30';
}

function findAbility(
  all: ExAbility[],
  slot: SlotKey,
  baseKey: string,
  rarity: Rarity
): ExAbility | undefined {
  return all.find((entry) => entry.slot === slot && entry.baseKey === baseKey && entry.rarity === rarity);
}

export default function ExBoostPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [abilities, setAbilities] = useState<ExAbility[]>([]);
  const [statuses, setStatuses] = useState<ExStatus[]>([]);

  const [statusRarity, setStatusRarity] = useState<Rarity>(5);
  const [statusId, setStatusId] = useState('');
  const [slotARarity, setSlotARarity] = useState<Rarity>(5);
  const [slotBRarity, setSlotBRarity] = useState<Rarity>(5);
  const [slotAKey, setSlotAKey] = useState('');
  const [slotBKey, setSlotBKey] = useState('');

  const [decodeInput, setDecodeInput] = useState('');
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'pretty' | 'compact' | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError(null);

      try {
        const [abilityRes, statusRes] = await Promise.all([
          fetch('/data/datalist/ex_boost/ex_ability.json', { cache: 'no-store' }),
          fetch('/data/datalist/ex_boost/ex_status.json', { cache: 'no-store' }),
        ]);

        if (!abilityRes.ok || !statusRes.ok) {
          throw new Error('Failed to load EX boost data files.');
        }

        const abilityJson = (await abilityRes.json()) as Record<string, string[]>;
        const statusJson = (await statusRes.json()) as Record<string, string[]>;

        const parsedAbilities: ExAbility[] = Object.entries(abilityJson)
          .map(([id, row]) => {
            const abilityId = toNumber(id);
            const devName = String(row[0] || '');
            const rarity = toNumber(row[2]) as Rarity;
            const value = toNumber(row[3]);
            const effectCode = toNumber(row[46]);
            const slot: SlotKey = abilityId <= 30 ? 'slot_a' : 'slot_b';
            const baseKey = devName.replace(/_r[345]$/, '');

            return {
              id: abilityId,
              devName,
              baseKey,
              slot,
              rarity,
              value,
              effectCode,
            };
          })
          .filter((entry) => entry.devName && (entry.rarity === 3 || entry.rarity === 4 || entry.rarity === 5))
          .sort((a, b) => a.id - b.id);

        const parsedStatuses: ExStatus[] = Object.entries(statusJson)
          .map(([id, row]) => ({
            id: toNumber(id),
            devName: String(row[0] || ''),
            hp: toNumber(row[1]),
            atk: toNumber(row[2]),
            rarity: toNumber(row[3]) as Rarity,
          }))
          .filter((entry) => entry.id > 0 && entry.devName && (entry.rarity === 3 || entry.rarity === 4 || entry.rarity === 5))
          .sort((a, b) => {
            if (a.rarity !== b.rarity) return b.rarity - a.rarity;
            return a.id - b.id;
          });

        setAbilities(parsedAbilities);
        setStatuses(parsedStatuses);
      } catch (error) {
        console.error('Failed to load EX boost maker data:', error);
        setLoadError('Could not load EX boost datasets.');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const statusOptions = useMemo(
    () => statuses.filter((status) => status.rarity === statusRarity),
    [statuses, statusRarity]
  );

  const slotAOptions = useMemo(() => {
    const keys = new Set(
      abilities
        .filter((ability) => ability.slot === 'slot_a' && ability.rarity === slotARarity)
        .map((ability) => ability.baseKey)
    );
    return [...keys].sort((a, b) => toAbilityLabel(a).localeCompare(toAbilityLabel(b)));
  }, [abilities, slotARarity]);

  const slotBOptions = useMemo(() => {
    const keys = new Set(
      abilities
        .filter((ability) => ability.slot === 'slot_b' && ability.rarity === slotBRarity)
        .map((ability) => ability.baseKey)
    );
    return [...keys].sort((a, b) => toAbilityLabel(a).localeCompare(toAbilityLabel(b)));
  }, [abilities, slotBRarity]);

  useEffect(() => {
    if (!statusOptions.length) return;
    if (!statusOptions.some((status) => String(status.id) === statusId)) {
      setStatusId(String(statusOptions[0].id));
    }
  }, [statusOptions, statusId]);

  useEffect(() => {
    if (!slotAOptions.length) return;
    if (!slotAOptions.includes(slotAKey)) {
      setSlotAKey(slotAOptions[0]);
    }
  }, [slotAOptions, slotAKey]);

  useEffect(() => {
    if (!slotBOptions.length) return;
    if (!slotBOptions.includes(slotBKey)) {
      setSlotBKey(slotBOptions[0]);
    }
  }, [slotBOptions, slotBKey]);

  const selectedStatus = useMemo(
    () => statusOptions.find((entry) => String(entry.id) === statusId) ?? null,
    [statusOptions, statusId]
  );

  const selectedSlotA = useMemo(
    () => findAbility(abilities, 'slot_a', slotAKey, slotARarity) ?? null,
    [abilities, slotAKey, slotARarity]
  );

  const selectedSlotB = useMemo(
    () => findAbility(abilities, 'slot_b', slotBKey, slotBRarity) ?? null,
    [abilities, slotBKey, slotBRarity]
  );

  const payload = useMemo<ExBoostPayload | null>(() => {
    if (!selectedStatus || !selectedSlotA || !selectedSlotB) return null;
    return {
      ex_boost: {
        status_id: selectedStatus.id,
        ability_id_list: [selectedSlotA.id, selectedSlotB.id],
      },
    };
  }, [selectedStatus, selectedSlotA, selectedSlotB]);

  const prettyOutput = useMemo(() => (payload ? JSON.stringify(payload, null, 2) : ''), [payload]);
  const compactOutput = useMemo(() => (payload ? JSON.stringify(payload) : ''), [payload]);

  const copyToClipboard = async (kind: 'pretty' | 'compact') => {
    if (!payload) return;
    const value = kind === 'pretty' ? prettyOutput : compactOutput;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const decodeFromInput = () => {
    setDecodeError(null);

    try {
      const parsed = JSON.parse(decodeInput) as {
        ex_boost?: { status_id?: number; ability_id_list?: number[] };
      };

      const statusIdValue = parsed?.ex_boost?.status_id;
      const abilityIds = parsed?.ex_boost?.ability_id_list;

      if (!statusIdValue || !Array.isArray(abilityIds) || abilityIds.length < 2) {
        throw new Error('Missing `ex_boost.status_id` or `ability_id_list`.');
      }

      const nextStatus = statuses.find((entry) => entry.id === Number(statusIdValue));
      if (!nextStatus) throw new Error(`Unknown status id: ${statusIdValue}`);

      const slotAAbility = abilities.find((entry) => entry.id === Number(abilityIds[0]));
      const slotBAbility = abilities.find((entry) => entry.id === Number(abilityIds[1]));
      if (!slotAAbility || !slotBAbility) throw new Error('Unknown ability id in ability_id_list.');
      if (slotAAbility.slot !== 'slot_a' || slotBAbility.slot !== 'slot_b') {
        throw new Error('Ability IDs must be [slot_a, slot_b] order.');
      }

      setStatusRarity(nextStatus.rarity);
      setStatusId(String(nextStatus.id));

      setSlotARarity(slotAAbility.rarity);
      setSlotAKey(slotAAbility.baseKey);

      setSlotBRarity(slotBAbility.rarity);
      setSlotBKey(slotBAbility.baseKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid EX boost JSON.';
      setDecodeError(message);
    }
  };

  const resetForm = () => {
    setStatusRarity(5);
    setSlotARarity(5);
    setSlotBRarity(5);
    setDecodeError(null);
    setDecodeInput('');
  };

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='flex items-center gap-3 text-muted-foreground'>
          <Sparkles className='h-5 w-5 animate-pulse' />
          <span>Loading EX boost maker...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className='mx-auto flex min-h-screen max-w-3xl items-center px-4'>
        <Card className='w-full border-destructive/40'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' />
              EX Boost Maker Error
            </CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto max-w-6xl space-y-6 px-4 py-6'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold tracking-tight'>EX Boost Maker</h1>
          <p className='text-sm text-muted-foreground'>
            Build EX boost payloads with status + slot A + slot B and export ready JSON.
          </p>
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <Card className='min-w-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Status</CardTitle>
              <CardDescription>Pick EX status profile and rarity.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Rarity</p>
                <Select value={String(statusRarity)} onValueChange={(value) => setStatusRarity(Number(value) as Rarity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((rarity) => (
                      <SelectItem key={rarity} value={String(rarity)}>
                        {rarity}★
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Status Type</p>
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select status' />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={String(status.id)}>
                        {toStatusLabel(status.devName)} (HP +{status.hp} / ATK +{status.atk})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStatus && (
                <div className='rounded-md border p-3'>
                  <div className='mb-2 flex items-center justify-between gap-2'>
                    <p className='text-sm font-medium'>{toStatusLabel(selectedStatus.devName)}</p>
                    <Badge className={cn('border', getRarityBadgeTone(selectedStatus.rarity))}>
                      {selectedStatus.rarity}★
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>Status ID: {selectedStatus.id}</p>
                  <p className='text-xs text-muted-foreground'>HP +{selectedStatus.hp}</p>
                  <p className='text-xs text-muted-foreground'>ATK +{selectedStatus.atk}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='min-w-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Slot A</CardTitle>
              <CardDescription>Primary offensive EX boost.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Rarity</p>
                <Select value={String(slotARarity)} onValueChange={(value) => setSlotARarity(Number(value) as Rarity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((rarity) => (
                      <SelectItem key={rarity} value={String(rarity)}>
                        {rarity}★
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Ability</p>
                <Select value={slotAKey} onValueChange={setSlotAKey}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select slot A ability' />
                  </SelectTrigger>
                  <SelectContent>
                    {slotAOptions.map((key) => (
                      <SelectItem key={key} value={key}>
                        {toAbilityLabel(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSlotA && (
                <div className='rounded-md border p-3'>
                  <div className='mb-2 flex items-center justify-between gap-2'>
                    <p className='text-sm font-medium'>{toAbilityLabel(selectedSlotA.baseKey)}</p>
                    <Badge className={cn('border', getRarityBadgeTone(selectedSlotA.rarity))}>
                      {selectedSlotA.rarity}★
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>Ability ID: {selectedSlotA.id}</p>
                  <p className='text-xs text-muted-foreground'>Value: +{selectedSlotA.value}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='min-w-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Slot B</CardTitle>
              <CardDescription>Utility/buff duration EX boost.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Rarity</p>
                <Select value={String(slotBRarity)} onValueChange={(value) => setSlotBRarity(Number(value) as Rarity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((rarity) => (
                      <SelectItem key={rarity} value={String(rarity)}>
                        {rarity}★
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Ability</p>
                <Select value={slotBKey} onValueChange={setSlotBKey}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select slot B ability' />
                  </SelectTrigger>
                  <SelectContent>
                    {slotBOptions.map((key) => (
                      <SelectItem key={key} value={key}>
                        {toAbilityLabel(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSlotB && (
                <div className='rounded-md border p-3'>
                  <div className='mb-2 flex items-center justify-between gap-2'>
                    <p className='text-sm font-medium'>{toAbilityLabel(selectedSlotB.baseKey)}</p>
                    <Badge className={cn('border', getRarityBadgeTone(selectedSlotB.rarity))}>
                      {selectedSlotB.rarity}★
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>Ability ID: {selectedSlotB.id}</p>
                  <p className='text-xs text-muted-foreground'>Value: +{selectedSlotB.value}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <Card className='min-w-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Generated JSON</CardTitle>
              <CardDescription>Copy this into save payloads or testing tools.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='rounded-md border bg-muted/30 p-3'>
                <pre className='overflow-x-auto text-xs leading-relaxed'>{prettyOutput || 'Select all fields to build output.'}</pre>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button disabled={!payload} onClick={() => void copyToClipboard('pretty')} className='gap-2'>
                  {copied === 'pretty' ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                  Copy Pretty
                </Button>
                <Button
                  variant='outline'
                  disabled={!payload}
                  onClick={() => void copyToClipboard('compact')}
                  className='gap-2'
                >
                  {copied === 'compact' ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                  Copy Compact
                </Button>
                <Button variant='ghost' onClick={resetForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='min-w-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Decode Existing JSON</CardTitle>
              <CardDescription>Paste existing EX boost object to preload this form.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <textarea
                value={decodeInput}
                onChange={(event) => setDecodeInput(event.target.value)}
                placeholder='{"ex_boost":{"status_id":1,"ability_id_list":[1,31]}}'
                className='h-36 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'
              />
              {decodeError && (
                <p className='text-xs text-destructive'>
                  <AlertTriangle className='mr-1 inline h-3.5 w-3.5' />
                  {decodeError}
                </p>
              )}
              <Button onClick={decodeFromInput} className='gap-2' disabled={!decodeInput.trim()}>
                <WandSparkles className='h-4 w-4' />
                Decode Into Form
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
