'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Package, Shield, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type EditorMode = 'item' | 'equipment';
type JsonRecord = Record<string, unknown>;

type PersistedSaveEditorState = {
  version?: number;
  saveDocument?: JsonRecord | null;
  sourceLabel?: string;
  outputFileName?: string;
  rawDirty?: boolean;
  rawDraft?: string | null;
};

type SaveLinkEditorProps = {
  mode: EditorMode;
  entityId: string;
  enhancementOptions?: number[];
};

const SAVE_EDITOR_LOCALSTORAGE_KEY = 'wf-save-editor-state-v1';

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toInteger = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const ensureNestedRecord = (record: JsonRecord, key: string): JsonRecord => {
  const current = record[key];
  if (isRecord(current)) return current;
  const next: JsonRecord = {};
  record[key] = next;
  return next;
};

export default function ItemSaveLinkEditor({ mode, entityId, enhancementOptions = [] }: SaveLinkEditorProps) {
  const [persistedState, setPersistedState] = useState<PersistedSaveEditorState | null>(null);
  const [storageStatus, setStorageStatus] = useState<'checking' | 'ready' | 'missing' | 'invalid'>('checking');
  const [quantityDraft, setQuantityDraft] = useState('0');
  const [feedback, setFeedback] = useState<string>('');
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackTimer = () => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  };

  const setTemporaryFeedback = (message: string) => {
    clearFeedbackTimer();
    setFeedback(message);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback('');
      feedbackTimeoutRef.current = null;
    }, 1700);
  };

  const loadFromLocalStorage = () => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(SAVE_EDITOR_LOCALSTORAGE_KEY);
    if (!raw) {
      setPersistedState(null);
      setStorageStatus('missing');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedSaveEditorState;
      if (!isRecord(parsed) || !isRecord(parsed.saveDocument)) {
        setPersistedState(null);
        setStorageStatus('invalid');
        return;
      }
      setPersistedState(parsed);
      setStorageStatus('ready');
    } catch {
      setPersistedState(null);
      setStorageStatus('invalid');
    }
  };

  useEffect(() => {
    loadFromLocalStorage();
    return () => clearFeedbackTimer();
  }, []);

  const mutatePersistedSave = (mutator: (dataRoot: JsonRecord) => void, successMessage: string) => {
    setPersistedState((current) => {
      if (!current || !isRecord(current.saveDocument)) return current;

      const next = cloneJson(current);
      if (!isRecord(next.saveDocument)) {
        next.saveDocument = { data: {} };
      }

      const saveDocument = next.saveDocument as JsonRecord;
      const dataRoot = ensureNestedRecord(saveDocument, 'data');
      mutator(dataRoot);

      try {
        window.localStorage.setItem(SAVE_EDITOR_LOCALSTORAGE_KEY, JSON.stringify(next));
        setTemporaryFeedback(successMessage);
      } catch {
        setTemporaryFeedback('Could not save changes to local storage.');
      }

      return next;
    });
  };

  const saveDocumentData = useMemo(() => {
    if (!persistedState || !isRecord(persistedState.saveDocument)) return null;
    const data = persistedState.saveDocument.data;
    return isRecord(data) ? data : null;
  }, [persistedState]);

  const itemList = useMemo(() => {
    if (!saveDocumentData) return null;
    const list = saveDocumentData.item_list;
    return isRecord(list) ? list : null;
  }, [saveDocumentData]);

  const equipmentList = useMemo(() => {
    if (!saveDocumentData) return null;
    const list = saveDocumentData.user_equipment_list;
    return isRecord(list) ? list : null;
  }, [saveDocumentData]);

  const currentItemQuantity = useMemo(() => {
    if (!itemList) return 0;
    return Math.max(0, toInteger(itemList[entityId], 0));
  }, [entityId, itemList]);

  useEffect(() => {
    if (mode !== 'item') return;
    setQuantityDraft(String(currentItemQuantity));
  }, [currentItemQuantity, mode]);

  const currentEquipment = useMemo(() => {
    if (!equipmentList) return null;
    const maybeEquipment = equipmentList[entityId];
    return isRecord(maybeEquipment) ? maybeEquipment : null;
  }, [entityId, equipmentList]);

  const currentEquipmentLevelPoint = useMemo(() => {
    if (!currentEquipment) return 0;
    return clamp(toInteger(currentEquipment.level, 1) - 1, 0, 4);
  }, [currentEquipment]);

  const currentEquipmentEnhancementLevel = useMemo(() => {
    if (!currentEquipment) return 0;
    return Math.max(0, toInteger(currentEquipment.enhancement_level, 0));
  }, [currentEquipment]);

  const currentEquipmentStack = useMemo(() => {
    if (!currentEquipment) return 1;
    return Math.max(1, toInteger(currentEquipment.stack, 1));
  }, [currentEquipment]);

  const currentEquipmentProtection = useMemo(() => {
    if (!currentEquipment) return false;
    return Boolean(currentEquipment.protection);
  }, [currentEquipment]);

  const applyItemQuantity = () => {
    const parsed = toInteger(quantityDraft, 0);
    const quantity = Math.max(0, parsed);

    mutatePersistedSave((dataRoot) => {
      const list = ensureNestedRecord(dataRoot, 'item_list');
      if (quantity <= 0) {
        delete list[entityId];
      } else {
        list[entityId] = quantity;
      }
    }, `Item quantity updated to ${quantity}.`);
  };

  const quickSetItemQuantity = (value: number) => {
    setQuantityDraft(String(value));
    mutatePersistedSave((dataRoot) => {
      const list = ensureNestedRecord(dataRoot, 'item_list');
      if (value <= 0) {
        delete list[entityId];
      } else {
        list[entityId] = value;
      }
    }, `Item quantity updated to ${value}.`);
  };

  const addEquipmentToSave = () => {
    mutatePersistedSave((dataRoot) => {
      const list = ensureNestedRecord(dataRoot, 'user_equipment_list');
      if (!isRecord(list[entityId])) {
        list[entityId] = {
          level: 1,
          enhancement_level: 0,
          protection: false,
          stack: 1,
        };
      }
    }, 'Equipment added to save.');
  };

  const removeEquipmentFromSave = () => {
    mutatePersistedSave((dataRoot) => {
      const list = ensureNestedRecord(dataRoot, 'user_equipment_list');
      delete list[entityId];
    }, 'Equipment removed from save.');
  };

  const updateEquipmentField = (field: string, value: number | boolean) => {
    mutatePersistedSave((dataRoot) => {
      const list = ensureNestedRecord(dataRoot, 'user_equipment_list');
      const current = isRecord(list[entityId]) ? (list[entityId] as JsonRecord) : {};
      list[entityId] = current;
      current[field] = value;
    }, 'Equipment updated in save.');
  };

  const sourceLabel =
    persistedState && typeof persistedState.sourceLabel === 'string' && persistedState.sourceLabel.trim()
      ? persistedState.sourceLabel.trim()
      : 'Local save draft';

  return (
    <Card className='border-primary/25 bg-primary/[0.05]'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          {mode === 'item' ? <Package className='h-4 w-4' /> : <Wrench className='h-4 w-4' />}
          Edit In Loaded Save
        </CardTitle>
        <CardDescription>
          Uses your browser-local save state. Last source: <span className='font-medium text-foreground'>{sourceLabel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3 pt-0'>
        {storageStatus === 'checking' && <p className='text-sm text-muted-foreground'>Checking local save state...</p>}

        {storageStatus === 'missing' && (
          <div className='rounded-md border border-border/70 bg-card/60 p-3 text-sm text-muted-foreground'>
            <p>No loaded save found in local storage.</p>
            <Button asChild size='sm' className='mt-3'>
              <Link href='/save-editor'>
                Open Save Editor
                <ExternalLink className='ml-2 h-3.5 w-3.5' />
              </Link>
            </Button>
          </div>
        )}

        {storageStatus === 'invalid' && (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
            Saved draft exists but could not be parsed.
          </div>
        )}

        {storageStatus === 'ready' && mode === 'item' && (
          <div className='space-y-3 rounded-md border border-border/70 bg-card/60 p-3'>
            <div className='flex items-center justify-between gap-2'>
              <span className='text-sm font-medium'>Current quantity</span>
              <Badge variant='secondary'>{currentItemQuantity}</Badge>
            </div>

            <div className='flex items-center gap-2'>
              <Input
                value={quantityDraft}
                inputMode='numeric'
                pattern='[0-9]*'
                onChange={(event) => setQuantityDraft(event.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyItemQuantity();
                  }
                }}
                className='h-9 max-w-[180px]'
              />
              <Button type='button' size='sm' onClick={applyItemQuantity}>
                Apply
              </Button>
            </div>

            <div className='flex flex-wrap gap-2'>
              {[0, 1, 99, 999, 9999].map((amount) => (
                <Button key={amount} type='button' size='sm' variant='outline' onClick={() => quickSetItemQuantity(amount)}>
                  {amount}
                </Button>
              ))}
            </div>
          </div>
        )}

        {storageStatus === 'ready' && mode === 'equipment' && (
          <div className='space-y-3 rounded-md border border-border/70 bg-card/60 p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-sm font-medium'>Ownership</span>
              {currentEquipment ? (
                <Button variant='outline' size='sm' onClick={removeEquipmentFromSave}>
                  Remove From Save
                </Button>
              ) : (
                <Button size='sm' onClick={addEquipmentToSave}>
                  Add To Save
                </Button>
              )}
            </div>

            {!currentEquipment && <p className='text-sm text-muted-foreground'>Not currently owned in loaded save.</p>}

            {currentEquipment && (
              <>
                <div className='grid gap-3 md:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <p className='text-xs uppercase tracking-wide text-muted-foreground'>Level (0/4 to 4/4)</p>
                    <Input
                      type='range'
                      min={0}
                      max={4}
                      step={1}
                      value={currentEquipmentLevelPoint}
                      onChange={(event) => updateEquipmentField('level', clamp(toInteger(event.target.value, 0), 0, 4) + 1)}
                    />
                    <p className='text-xs text-muted-foreground'>{currentEquipmentLevelPoint}/4</p>
                  </div>

                  <div className='space-y-1.5'>
                    <p className='text-xs uppercase tracking-wide text-muted-foreground'>Stack</p>
                    <Input
                      inputMode='numeric'
                      pattern='[0-9]*'
                      value={String(currentEquipmentStack)}
                      onChange={(event) =>
                        updateEquipmentField('stack', Math.max(1, toInteger(event.target.value.replace(/[^\d]/g, ''), 1)))
                      }
                    />
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <p className='text-xs uppercase tracking-wide text-muted-foreground'>Enhancement</p>
                  {enhancementOptions.length > 0 ? (
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant={currentEquipmentEnhancementLevel === 0 ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => updateEquipmentField('enhancement_level', 0)}
                      >
                        Base (0)
                      </Button>
                      {enhancementOptions.map((option) => (
                        <Button
                          key={option}
                          type='button'
                          variant={currentEquipmentEnhancementLevel === option ? 'default' : 'outline'}
                          size='sm'
                          onClick={() => updateEquipmentField('enhancement_level', option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Input
                      inputMode='numeric'
                      pattern='[0-9]*'
                      value={String(currentEquipmentEnhancementLevel)}
                      onChange={(event) =>
                        updateEquipmentField('enhancement_level', Math.max(0, toInteger(event.target.value.replace(/[^\d]/g, ''), 0)))
                      }
                    />
                  )}
                </div>

                <div className='flex items-center justify-between rounded-md border border-border/70 px-3 py-2'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Shield className='h-4 w-4 text-muted-foreground' />
                    Protected
                  </div>
                  <Button
                    type='button'
                    size='sm'
                    variant={currentEquipmentProtection ? 'default' : 'outline'}
                    onClick={() => updateEquipmentField('protection', !currentEquipmentProtection)}
                  >
                    {currentEquipmentProtection ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {feedback && (
          <p className='inline-flex items-center gap-1.5 text-xs text-emerald-400'>
            <CheckCircle2 className='h-3.5 w-3.5' />
            {feedback}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

