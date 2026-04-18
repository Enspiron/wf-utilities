# Facebuilder Page — Data References

All JSON files, URLs, and API calls used specifically by `app/facebuilder/page.tsx`.

---

## JSON Files Loaded on Startup

Each file is tried in order — local first, GitHub fallback second.

### `faces.json`
List of all face identifiers (character names used as folder keys).

| Priority | URL |
|---|---|
| 1 (local) | `/data/faces.json` |
| 2 (fallback) | `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/faces.json` |

### `face-ui.json`
Maps each face name to its available UI and story asset file lists. Drives the expression/base selectors.

| Priority | URL |
|---|---|
| 1 (local) | `/data/face-ui.json` |
| 2 (fallback) | `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/face-ui.json` |

### `character.json`
Maps character IDs to name arrays. Used to match face names to characters.

| Priority | URL |
|---|---|
| 1 (local) | `/data/character.json` |
| 2 (fallback) | `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/character.json` |

### `full_shot_image_attribute.json`
Per-character, per-variant crop/offset attributes for full-shot images.

| Priority | URL |
|---|---|
| 1 (local) | `/data/full_shot_image_attribute.json` |
| 2 (fallback) | `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/full_shot_image_attribute.json` |

### `trimmed_image.json`
Trim rectangles `[x, y, canvasWidth, canvasHeight]` keyed by asset path (e.g. `character/{face}/ui/story/{stem}`). Used to correctly crop and align story sprites on the compose canvas.

| Priority | URL |
|---|---|
| 1 (local, JP datalist) | `/data/datalist/generated/trimmed_image.json` |
| 2 (local, EN datalist) | `/data/datalist_en/generated/trimmed_image.json` |
| 3 (fallback, JP) | `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/datalist/generated/trimmed_image.json` |
| 4 (fallback, EN) | `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/datalist_en/generated/trimmed_image.json` |

---

## Internal API Calls

| Endpoint | Purpose |
|---|---|
| `/api/character-text?lang=jp` | Character name/text data in Japanese |
| `/api/character-text?lang=en` | Character name/text data in English |
| `/api/assets/image?url=<encoded>` | Image proxy — all CDN images are routed through this |

---

## CDN Image URLs (Bunny CDN)

Base: `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/`

All image requests are proxied through `/api/assets/image?url=<encoded>`.

| Asset | URL Pattern |
|---|---|
| Story sprite (expression/base) | `…/{faceName}/ui/story/{file}.png` |
| Story sprite (URL-encoded face) | `…/{encodedFace}/ui/story/{encodedFile}.png` |
| UI file (non-story) | `…/{faceName}/ui/{file}.png` |
| Full-shot image | `…/{faceName}/ui/full_shot_1440_1920_{variant}.png` |
| Character list thumbnail | `…/{faceName}/ui/battle_member_status_0.png` |

> **Playable character detection**: a face is considered "playable" if `battle_member_status_0` exists in its UI file list; otherwise it is classified as NPC.

---

## Constant Values

```ts
// GitHub raw fallback base
const DATA_FALLBACK_BASE = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

// Expression stems treated as "other part" (additive/toggleable, not exclusive)
const OTHER_PART_EXPRESSION_STEMS = ['shame', 'sweat', 'unknown'];
const OTHER_PART_EXPRESSION_PREFIXES = ['hibi_', 'guardian'];

// Special case: 'cheek' is also an "other part" for character 'zegura'

// Default compose canvas size when no trim data is available
{ width: 512, height: 512 }
```

---

## Base File Resolution Order

When selecting the base sprite for compose mode, files are resolved by this priority:

| `selectedBase` | Preference order |
|---|---|
| `'0'` | `base_0` → `base` → `base_0_right` |
| `'1'` | `base_1` → `base_b` → `base_1_right` → `base_b_right` → `base` |

Falls back to the first file without `_right` in the name, then to `availableBaseFiles[0]`.
