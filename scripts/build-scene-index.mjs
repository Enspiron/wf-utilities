import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const INDEX_VERSION = 1;

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function humanize(value) {
  return String(value || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function walkFiles(root, predicate, relative = '') {
  let entries = [];
  try {
    entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const entryRelative = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, predicate, entryRelative));
    } else if (entry.isFile() && predicate(entry.name, entryRelative)) {
      files.push(entryRelative.replace(/\\/g, '/'));
    }
  }
  return files;
}

function getStoryCategory(assetPath) {
  const parts = assetPath.split('/');
  if (parts[0] !== 'story') return 'story';
  return parts[1] || 'story';
}

function getStoryTitle(assetPath) {
  const parts = assetPath.split('/');
  const scenarioIndex = parts.lastIndexOf('scenario');
  const usefulParts = parts.slice(1, scenarioIndex >= 0 ? scenarioIndex : undefined);
  return usefulParts.length ? usefulParts.map(humanize).join(' / ') : humanize(assetPath);
}

async function buildStoryIndex(publicDataRoot, assetRoot) {
  const byPath = new Map();

  for (const lang of ['en', 'jp']) {
    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    const storyRoot = path.join(publicDataRoot, dataFolder, 'story');
    const scenarioFiles = await walkFiles(storyRoot, (name) => name === 'scenario.json');

    for (const file of scenarioFiles) {
      const scenarioPath = `story/${file.replace(/\.json$/i, '')}`;
      const sceneDir = scenarioPath.replace(/\/scenario$/i, '');
      const current = byPath.get(scenarioPath) || {
        id: scenarioPath,
        path: scenarioPath,
        title: getStoryTitle(scenarioPath),
        category: getStoryCategory(scenarioPath),
        langs: [],
        movie: false,
        movieBase: `${sceneDir}/sprite_sheet`,
      };

      if (!current.langs.includes(lang)) current.langs.push(lang);

      if (assetRoot) {
        const assetDir = path.join(assetRoot, ...sceneDir.split('/'));
        current.movie = await fileExists(path.join(assetDir, 'sprite_sheet.png')) &&
          await fileExists(path.join(assetDir, 'sprite_sheet.atlas.json')) &&
          await fileExists(path.join(assetDir, 'movie.timeline.json'));
      }

      byPath.set(scenarioPath, current);
    }
  }

  return Array.from(byPath.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function parseFieldParts(fieldId, value) {
  if (!Array.isArray(value)) return [];
  const labels = [
    'background',
    'foreground',
    'added',
    'overlay 1',
    'overlay 2',
    'overlay 3',
    'overlay 4',
    'gate',
    'transit pod',
    'fever gauge',
  ];

  return value
    .map((assetPath, index) => ({
      label: labels[index] || `layer ${index + 1}`,
      path: typeof assetPath === 'string' ? assetPath : '',
      role: labels[index] || `layer-${index + 1}`,
    }))
    .filter((entry) => entry.path && entry.path !== '(None)');
}

async function buildBattleIndex(publicDataRoot) {
  const fieldDataPath = path.join(publicDataRoot, 'datalist', 'battle', 'field_data.json');
  const fieldPath = path.join(publicDataRoot, 'datalist', 'battle', 'field.json');

  let fieldData = {};
  let fields = {};
  try {
    fieldData = JSON.parse(await fs.readFile(fieldDataPath, 'utf8'));
    fields = JSON.parse(await fs.readFile(fieldPath, 'utf8'));
  } catch {
    return [];
  }

  return Object.entries(fieldData)
    .map(([id, row]) => {
      const values = Array.isArray(row) ? row : [];
      const fieldId = String(values[0] || '');
      const terrain = String(values[1] || '');
      const zoneId = String(values[2] || id);
      const layers = parseFieldParts(fieldId, fields[fieldId]);

      return {
        id,
        title: humanize(id),
        fieldId,
        terrain,
        zoneId,
        category: fieldId.split('_').slice(0, 2).join('_') || 'battle',
        thumbnail: layers[0]?.path || '',
        layerCount: layers.length,
      };
    })
    .filter((entry) => entry.fieldId)
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function main() {
  const publicDataRoot = path.resolve(getArg('--data') || path.join(process.cwd(), 'public', 'data'));
  const assetRoot = path.resolve(
    getArg('--assets') ||
      process.env.WF_ASSET_ROOT ||
      path.join(process.cwd(), '..', 'WFDatamine', 'output', 'assets')
  );
  const outputPath = path.join(publicDataRoot, 'scene-index.json');

  const [storyScenes, battleFields] = await Promise.all([
    buildStoryIndex(publicDataRoot, assetRoot),
    buildBattleIndex(publicDataRoot),
  ]);

  const payload = {
    version: INDEX_VERSION,
    builtAt: new Date().toISOString(),
    storyScenes,
    battleFields,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
  console.log(`${storyScenes.length} story scenes, ${battleFields.length} battle fields`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
