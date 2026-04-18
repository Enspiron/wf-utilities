import { getCatalogEntriesForApi } from '@/lib/item-catalog';
import { normalizeEliyaCompToken } from '@/lib/community/eliya';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

type CharacterAllPayload = {
  chars?: Array<Record<string, unknown>>;
};

type CompTokenMaps = {
  characterIdByToken: Record<string, number>;
  characterTokenById: Record<number, string>;
  equipmentIdByToken: Record<string, number>;
  equipmentTokenById: Record<number, string>;
};

let compTokenMapsPromise: Promise<CompTokenMaps> | null = null;
let equipmentRegionsPromise: Promise<Record<string, string[]>> | null = null;

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

function extractFaceCode(value: unknown): string {
  if (Array.isArray(value)) {
    if (typeof value[0] === 'string') return value[0];
    if (Array.isArray(value[0]) && typeof value[0][0] === 'string') return value[0][0];
  }
  return '';
}

export async function getCompTokenMaps(): Promise<CompTokenMaps> {
  if (compTokenMapsPromise) return compTokenMapsPromise;

  compTokenMapsPromise = (async () => {
    const [characterIndexPayload, charactersAllPayload, itemCatalog] = await Promise.all([
      loadJsonFromData('character.json'),
      loadJsonFromData('characters_all.json'),
      getCatalogEntriesForApi(),
    ]);

    const characterIndex = (characterIndexPayload || {}) as Record<string, unknown>;
    const charactersAll = (charactersAllPayload || {}) as CharacterAllPayload;

    const faceCodeToId: Record<string, number> = {};
    for (const [rawId, rawRow] of Object.entries(characterIndex)) {
      const parsedId = Number.parseInt(rawId, 10);
      if (!Number.isFinite(parsedId) || parsedId <= 0) continue;
      const faceCode = normalizeEliyaCompToken(extractFaceCode(rawRow));
      if (!faceCode) continue;
      if (!faceCodeToId[faceCode]) {
        faceCodeToId[faceCode] = parsedId;
      }
    }

    const characterIdByToken: Record<string, number> = {};
    const characterTokenById: Record<number, string> = {};

    for (const entry of charactersAll.chars ?? []) {
      const devNickname = normalizeEliyaCompToken(String(entry.DevNicknames || ''));
      if (!devNickname) continue;
      const mappedId = faceCodeToId[devNickname];
      if (!mappedId) continue;

      characterIdByToken[devNickname] = mappedId;
      if (!characterTokenById[mappedId]) {
        characterTokenById[mappedId] = devNickname;
      }

      const rawAliases = String(entry.OtherCommonNames || '');
      if (rawAliases) {
        for (const alias of rawAliases.split(',').map((token) => normalizeEliyaCompToken(token)).filter(Boolean)) {
          if (!characterIdByToken[alias]) {
            characterIdByToken[alias] = mappedId;
          }
        }
      }
    }

    const equipmentIdByToken: Record<string, number> = {};
    const equipmentTokenById: Record<number, string> = {};

    for (const item of itemCatalog) {
      if (item.type !== 'equipment') continue;
      const parsedId = Number.parseInt(item.id, 10);
      if (!Number.isFinite(parsedId) || parsedId <= 0) continue;

      const primaryToken = normalizeEliyaCompToken(item.devname || '');
      if (primaryToken) {
        equipmentIdByToken[primaryToken] = parsedId;
        if (!equipmentTokenById[parsedId]) {
          equipmentTokenById[parsedId] = primaryToken;
        }
      }

      const nameToken = normalizeEliyaCompToken(item.name || '').replace(/\s+/g, '_');
      if (nameToken && !equipmentIdByToken[nameToken]) {
        equipmentIdByToken[nameToken] = parsedId;
      }
    }

    return {
      characterIdByToken,
      characterTokenById,
      equipmentIdByToken,
      equipmentTokenById,
    };
  })();

  return compTokenMapsPromise;
}

export async function getEquipmentRegionsById(): Promise<Record<string, string[]>> {
  if (equipmentRegionsPromise) return equipmentRegionsPromise;

  equipmentRegionsPromise = (async () => {
    const catalog = await getCatalogEntriesForApi();
    const regionsById: Record<string, string[]> = {};

    for (const entry of catalog) {
      if (entry.type !== 'equipment') continue;
      const regions = Array.isArray(entry.sheetRegions) ? entry.sheetRegions.filter(Boolean) : [];
      regionsById[entry.id] = regions;
    }

    return regionsById;
  })();

  return equipmentRegionsPromise;
}
