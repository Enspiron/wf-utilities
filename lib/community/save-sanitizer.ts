import crypto from 'node:crypto';
import { getEquipmentRegionsById } from '@/lib/community/catalog';
import type { SaveDocument } from '@/lib/community/types';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const SAVE_MAX_BYTES = 3 * 1024 * 1024;

let allowedDataKeysPromise: Promise<Set<string>> | null = null;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function looksLikeSaveData(value: JsonObject): boolean {
  const markers = ['user_info', 'item_list', 'user_character_list', 'user_equipment_list'];
  return markers.some((marker) => Object.prototype.hasOwnProperty.call(value, marker));
}

function normalizeSaveInput(input: unknown): { ok: true; value: SaveDocument; removedRootKeys: string[] } | { ok: false; error: string } {
  if (!isObject(input)) {
    return { ok: false, error: 'Top-level JSON must be an object.' };
  }

  if (isObject(input.data)) {
    const rootKeys = Object.keys(input);
    const removedRootKeys = rootKeys.filter((key) => key !== 'data' && key !== 'data_headers');

    return {
      ok: true,
      value: {
        data_headers: isObject(input.data_headers) ? cloneJson(input.data_headers) : {},
        data: cloneJson(input.data) as Record<string, unknown>,
      },
      removedRootKeys,
    };
  }

  if (looksLikeSaveData(input)) {
    return {
      ok: true,
      value: {
        data_headers: {},
        data: cloneJson(input),
      },
      removedRootKeys: [],
    };
  }

  return {
    ok: false,
    error: 'JSON must include either a top-level data object or look like save data content.',
  };
}

async function loadJsonFromData(relativePath: string): Promise<unknown> {
  if (USE_CDN) {
    const response = await fetch(`${CDN_BASE_URL}/${relativePath}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${relativePath} (${response.status})`);
    }
    return response.json();
  }

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const fullPath = path.join(process.cwd(), 'public', 'data', ...relativePath.split('/'));
  const raw = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(raw) as unknown;
}

async function getAllowedDataKeys(): Promise<Set<string>> {
  if (allowedDataKeysPromise) return allowedDataKeysPromise;

  allowedDataKeysPromise = (async () => {
    const freshPayload = (await loadJsonFromData('fresh_save.json')) as { data?: Record<string, unknown> };
    const keys = isObject(freshPayload?.data) ? Object.keys(freshPayload.data) : [];
    return new Set(keys);
  })();

  return allowedDataKeysPromise;
}

function collectMissingSectionWarnings(data: JsonObject): string[] {
  const warnings: string[] = [];
  const required = ['user_info', 'item_list', 'user_character_list', 'user_equipment_list', 'user_party_group_list'];
  for (const key of required) {
    if (!isObject(data[key])) {
      warnings.push(`Missing or invalid section: ${key}.`);
    }
  }
  return warnings;
}

async function collectJpExclusiveWarnings(data: JsonObject): Promise<string[]> {
  const warnings: string[] = [];
  const regionsById = await getEquipmentRegionsById();
  const equipmentList = isObject(data.user_equipment_list) ? (data.user_equipment_list as JsonObject) : {};
  const jpOnlyIds: string[] = [];

  for (const equipmentId of Object.keys(equipmentList)) {
    const regions = regionsById[equipmentId] ?? [];
    if (regions.length === 0) continue;
    const hasJa = regions.includes('ja');
    const hasGl = regions.includes('gl');
    if (hasJa && !hasGl) {
      jpOnlyIds.push(equipmentId);
    }
  }

  if (jpOnlyIds.length > 0) {
    const sample = jpOnlyIds.slice(0, 10).join(', ');
    warnings.push(`JP-only equipment IDs detected for EN mode: ${sample}${jpOnlyIds.length > 10 ? '...' : ''}`);
  }

  return warnings;
}

export async function sanitizeSaveJson(input: unknown): Promise<{
  ok: true;
  sanitized: SaveDocument;
  warnings: string[];
  hash: string;
} | {
  ok: false;
  error: string;
}> {
  const byteLength = Buffer.byteLength(JSON.stringify(input ?? null), 'utf-8');
  if (byteLength > SAVE_MAX_BYTES) {
    return { ok: false, error: `Payload exceeds 3 MB limit (${byteLength} bytes).` };
  }

  const normalized = normalizeSaveInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const doc = cloneJson(normalized.value);
  if (!isObject(doc.data_headers)) {
    doc.data_headers = {};
  }

  const warnings: string[] = [];
  for (const key of normalized.removedRootKeys) {
    warnings.push(`Removed unknown top-level key: ${key}`);
  }
  const allowedKeys = await getAllowedDataKeys();
  const dataKeys = Object.keys(doc.data);

  for (const key of dataKeys) {
    if (!allowedKeys.has(key)) {
      delete doc.data[key];
      warnings.push(`Removed unknown top-level key: data.${key}`);
    }
  }

  warnings.push(...collectMissingSectionWarnings(doc.data));
  warnings.push(...(await collectJpExclusiveWarnings(doc.data)));

  const sanitizedString = JSON.stringify(doc);
  const hash = crypto.createHash('sha256').update(sanitizedString).digest('hex');

  return {
    ok: true,
    sanitized: doc,
    warnings,
    hash,
  };
}
