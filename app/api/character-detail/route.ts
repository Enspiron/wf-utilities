import { NextRequest, NextResponse } from 'next/server';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const CACHE_TTL_MS = 10 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

interface CharactersAllEntry {
  DevNicknames?: string;
  JPName?: string;
  ENName?: string;
  SubName?: string;
  Attribute?: string;
  Role?: string;
  Race?: string;
  Gender?: string;
  Stance?: string;
  Rarity?: number;
  MaxHP?: number;
  MaxATK?: number;
  SkillWait?: string | number;
  LeaderBuff?: string;
  Skill?: string;
  SkillIcon?: string;
  SkillRange?: unknown[];
  Ability1?: string;
  Ability2?: string;
  Ability3?: string;
  Ability4?: string;
  Ability5?: string;
  Ability6?: string;
  HitCount?: string | number;
  FeverGain?: string | number;
  Gauges?: JsonRecord;
  MaxGauges?: JsonRecord;
  ManaBoard2?: boolean;
  InTaiwan?: boolean;
  Obtain?: string;
  Choice?: string;
  OtherCommonNames?: string;
  va?: string;
  songs?: unknown[];
}

interface CharactersAllFile {
  chars?: CharactersAllEntry[];
}

interface CharacterDatasets {
  charactersAll: CharactersAllFile;
  characterMapEN: JsonRecord;
  characterMapJP: JsonRecord;
  characterTextEN: JsonRecord;
  characterTextJP: JsonRecord;
  characterStatusEN: JsonRecord;
  characterStatusJP: JsonRecord;
  characterSpeechEN: JsonRecord;
  characterSpeechJP: JsonRecord;
  gachaSoundEN: JsonRecord;
  gachaSoundJP: JsonRecord;
  fullShotEN: JsonRecord;
  fullShotJP: JsonRecord;
}

let datasetsCache: { loadedAt: number; data: CharacterDatasets } | null = null;

const weaponRoleMap: Record<string, string> = {
  Sword: 'Slash',
  Bow: 'Shot',
  Gun: 'Shot',
  Fist: 'Strike',
  Staff: 'Thrust',
  Katana: 'Slash',
  Spear: 'Thrust',
  Axe: 'Strike',
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

function normalizeRow(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  if (Array.isArray(value[0])) {
    return Array.isArray(value[0]) ? (value[0] as unknown[]) : [];
  }
  return value;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text === '(None)') return '';
  return text;
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEnName(enName: string): { title: string; name: string } {
  if (!enName) return { title: '', name: '' };
  const parts = enName.split('\n').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) return { title: '', name: parts[0] };
  const title = parts[0].replace(/^\[/, '').replace(/\]$/, '').trim();
  const name = parts.slice(1).join(' ').trim();
  return { title, name };
}

function parseGrowth(statusValue: unknown): Array<{ level: number; hp: number; atk: number }> {
  if (!statusValue || typeof statusValue !== 'object' || Array.isArray(statusValue)) {
    return [];
  }

  return Object.entries(statusValue as JsonRecord)
    .map(([level, values]) => {
      const hp = Array.isArray(values) ? toNumber(values[0]) : null;
      const atk = Array.isArray(values) ? toNumber(values[1]) : null;
      return {
        level: Number(level),
        hp: hp ?? 0,
        atk: atk ?? 0,
      };
    })
    .filter((entry) => Number.isFinite(entry.level) && entry.hp > 0 && entry.atk > 0)
    .sort((a, b) => a.level - b.level);
}

function parseSpeechLines(raw: unknown): Array<{ index: number; text: string; cue: string }> {
  const row = normalizeRow(raw);
  if (!row.length) return [];

  const lines: Array<{ index: number; text: string; cue: string }> = [];

  for (let i = 0; i + 4 < row.length; i += 5) {
    const text = cleanText(row[i + 3]);
    const cue = cleanText(row[i + 4]);
    if (!text && !cue) continue;
    lines.push({
      index: lines.length + 1,
      text,
      cue,
    });
  }

  return lines;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }
  const single = cleanText(value);
  return single ? [single] : [];
}

function findCharacterId(devnickname: string, characterMapEN: JsonRecord, characterMapJP: JsonRecord): string | null {
  const target = devnickname.toLowerCase();

  for (const map of [characterMapEN, characterMapJP]) {
    for (const [id, raw] of Object.entries(map)) {
      const row = normalizeRow(raw);
      if (!row.length) continue;
      const primary = cleanText(row[0]).toLowerCase();
      const secondary = cleanText(row[8]).toLowerCase();
      if (primary === target || secondary === target) {
        return id;
      }
    }
  }

  return null;
}

async function loadJson(relativePath: string): Promise<unknown> {
  if (USE_CDN) {
    const url = `${CDN_BASE_URL}/${relativePath}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${relativePath}: ${response.status}`);
    }
    return response.json();
  }

  const fs = await import('fs/promises');
  const path = await import('path');
  const fullPath = path.join(process.cwd(), 'public', 'data', ...relativePath.split('/'));
  const file = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(file);
}

async function loadDatasets(): Promise<CharacterDatasets> {
  if (datasetsCache && Date.now() - datasetsCache.loadedAt < CACHE_TTL_MS) {
    return datasetsCache.data;
  }

  const [
    charactersAll,
    characterMapEN,
    characterMapJP,
    characterTextEN,
    characterTextJP,
    characterStatusEN,
    characterStatusJP,
    characterSpeechEN,
    characterSpeechJP,
    gachaSoundEN,
    gachaSoundJP,
    fullShotEN,
    fullShotJP,
  ] = await Promise.all([
    loadJson('characters_all_withjp.json').catch(() => loadJson('characters_all.json')),
    loadJson('datalist_en/character/character.json'),
    loadJson('datalist/character/character.json'),
    loadJson('datalist_en/character/character_text.json'),
    loadJson('datalist/character/character_text.json'),
    loadJson('datalist_en/character/character_status.json'),
    loadJson('datalist/character/character_status.json'),
    loadJson('datalist_en/character/character_speech.json'),
    loadJson('datalist/character/character_speech.json'),
    loadJson('datalist_en/character/character_gacha_sound.json'),
    loadJson('datalist/character/character_gacha_sound.json'),
    loadJson('datalist_en/character/full_shot_image_attribute.json'),
    loadJson('datalist/character/full_shot_image_attribute.json'),
  ]);

  const data: CharacterDatasets = {
    charactersAll: asRecord(charactersAll) as CharactersAllFile,
    characterMapEN: asRecord(characterMapEN),
    characterMapJP: asRecord(characterMapJP),
    characterTextEN: asRecord(characterTextEN),
    characterTextJP: asRecord(characterTextJP),
    characterStatusEN: asRecord(characterStatusEN),
    characterStatusJP: asRecord(characterStatusJP),
    characterSpeechEN: asRecord(characterSpeechEN),
    characterSpeechJP: asRecord(characterSpeechJP),
    gachaSoundEN: asRecord(gachaSoundEN),
    gachaSoundJP: asRecord(gachaSoundJP),
    fullShotEN: asRecord(fullShotEN),
    fullShotJP: asRecord(fullShotJP),
  };

  datasetsCache = { loadedAt: Date.now(), data };
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const devnickname = request.nextUrl.searchParams.get('devnickname');

    if (!devnickname) {
      return NextResponse.json({ error: 'devnickname parameter is required' }, { status: 400 });
    }

    const needle = devnickname.trim().toLowerCase();
    if (!needle) {
      return NextResponse.json({ error: 'devnickname parameter is empty' }, { status: 400 });
    }

    const datasets = await loadDatasets();
    const allCharacters = Array.isArray(datasets.charactersAll.chars) ? datasets.charactersAll.chars : [];
    const baseCharacter = allCharacters.find(
      (entry) => cleanText(entry.DevNicknames).toLowerCase() === needle
    );

    if (!baseCharacter) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const characterId = findCharacterId(needle, datasets.characterMapEN, datasets.characterMapJP);
    const textEN = characterId ? normalizeRow(datasets.characterTextEN[characterId]) : [];
    const textJP = characterId ? normalizeRow(datasets.characterTextJP[characterId]) : [];
    const growth = parseGrowth(
      characterId
        ? (datasets.characterStatusEN[characterId] ?? datasets.characterStatusJP[characterId])
        : undefined
    );
    const speechLines = parseSpeechLines(
      characterId
        ? (datasets.characterSpeechEN[characterId] ?? datasets.characterSpeechJP[characterId])
        : undefined
    );
    const gachaSounds = parseStringArray(
      characterId ? (datasets.gachaSoundEN[characterId] ?? datasets.gachaSoundJP[characterId]) : undefined
    );

    const parsedEnName = parseEnName(cleanText(baseCharacter.ENName));
    const fullShotAttributes = asRecord(
      characterId ? (datasets.fullShotEN[characterId] ?? datasets.fullShotJP[characterId]) : undefined
    );
    const fullShotVariants = Object.keys(fullShotAttributes).sort((a, b) => Number(a) - Number(b));
    const assetBasePath = `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/${baseCharacter.DevNicknames}/ui`;

    const galleryUrls = Array.from(
      new Set([
        `${assetBasePath}/square_0.png`,
        `${assetBasePath}/square_1.png`,
        `${assetBasePath}/battle_member_status_0.png`,
        ...fullShotVariants.map((variant) => `${assetBasePath}/full_shot_1440_1920_${variant}.png`),
      ])
    );

    const abilities = [
      cleanText(baseCharacter.Ability1),
      cleanText(baseCharacter.Ability2),
      cleanText(baseCharacter.Ability3),
      cleanText(baseCharacter.Ability4),
      cleanText(baseCharacter.Ability5),
      cleanText(baseCharacter.Ability6),
    ].filter(Boolean);

    const skillWait = toNumber(baseCharacter.SkillWait);
    const maxHP = toNumber(baseCharacter.MaxHP);
    const maxATK = toNumber(baseCharacter.MaxATK);
    const hitCount = toNumber(baseCharacter.HitCount);
    const feverGain = toNumber(baseCharacter.FeverGain);

    return NextResponse.json({
      character: {
        id: characterId ?? '',
        faceCode: cleanText(baseCharacter.DevNicknames),
        nameEN: cleanText(textEN[0]) || parsedEnName.name || cleanText(baseCharacter.JPName),
        nameJP: cleanText(textJP[0]) || cleanText(baseCharacter.JPName),
        titleEN: cleanText(textEN[3]) || parsedEnName.title,
        titleJP: cleanText(textJP[3]) || cleanText(baseCharacter.SubName),
        descriptionEN: cleanText(textEN[2]),
        descriptionJP: cleanText(textJP[2]),
        skillNameEN: cleanText(textEN[4]),
        skillNameJP: cleanText(textJP[4]),
        leaderAbilityNameEN: cleanText(textEN[8]),
        leaderAbilityNameJP: cleanText(textJP[8]),
        voiceActor: cleanText(baseCharacter.va) || cleanText(textEN[9]) || cleanText(textJP[9]),
        attribute: cleanText(baseCharacter.Attribute),
        role: cleanText(baseCharacter.Role),
        weaponType: weaponRoleMap[cleanText(baseCharacter.Role)] || cleanText(baseCharacter.Role),
        race: cleanText(baseCharacter.Race),
        gender: cleanText(baseCharacter.Gender),
        stance: cleanText(baseCharacter.Stance),
        rarity: toNumber(baseCharacter.Rarity) ?? 0,
        maxHP: maxHP ?? 0,
        maxATK: maxATK ?? 0,
        skillWait: skillWait ?? 0,
        skillIcon: cleanText(baseCharacter.SkillIcon),
        skillRange: Array.isArray(baseCharacter.SkillRange)
          ? baseCharacter.SkillRange.map((value) => String(value))
          : [],
        skill: cleanText(baseCharacter.Skill),
        leaderBuff: cleanText(baseCharacter.LeaderBuff),
        abilities,
        hitCount: hitCount ?? 0,
        feverGain: feverGain ?? 0,
        gauges: asRecord(baseCharacter.Gauges),
        maxGauges: asRecord(baseCharacter.MaxGauges),
        manaBoard2: Boolean(baseCharacter.ManaBoard2),
        inTaiwan: Boolean(baseCharacter.InTaiwan),
        obtain: cleanText(baseCharacter.Obtain),
        choice: cleanText(baseCharacter.Choice),
        otherCommonNames: cleanText(baseCharacter.OtherCommonNames),
        songs: parseStringArray(baseCharacter.songs),
      },
      growth,
      speechLines,
      gachaSounds,
      art: {
        galleryUrls,
        fullShotAttributes,
      },
    });
  } catch (error) {
    console.error('Error loading character detail:', error);
    return NextResponse.json({ error: 'Failed to load character detail data' }, { status: 500 });
  }
}
