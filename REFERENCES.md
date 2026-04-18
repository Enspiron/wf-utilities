# WF Facemaker — Data References

All JSON files, external URLs, and data sources used by the app.

---

## External URLs

### Bunny CDN — `wfjukebox.b-cdn.net`

| Path Pattern | Content |
|---|---|
| `https://wfjukebox.b-cdn.net/music/` | BGM audio files |
| `https://wfjukebox.b-cdn.net/comics/` | Comic episode assets |
| `https://wfjukebox.b-cdn.net/wfjukebox/character/character_art/` | Character art images |
| `https://wfjukebox.b-cdn.net/orderedmaps/` | Ordered map JSON files (gacha, events, etc.) |

### GitHub Raw — `Enspiron/wf-utilities`

Base: `https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/`

All `datalist/` and `datalist_en/` JSON paths below are relative to this base.

### GitHub Raw — `Enspiron/WorldFlipperPlayer`

Base: `https://raw.githubusercontent.com/Enspiron/WorldFlipperPlayer/main/character_unique/`

Used as a fallback source for character unique music/voice assets.

### Google Sheets — Equipment Catalog

Format: `https://docs.google.com/spreadsheets/d/{ID}/pub?output=csv&gid={GID}`

| Region | Spreadsheet ID | GIDs |
|---|---|---|
| Default | `1moWhlsmAFkmItRJPrhhi9qCYu8Y93sXGyS1ZBo2L38c` | `1106788913` (Gacha/Story), `287563936` (Boss/Event) |
| GL | `1zNa_FwDyy-vHzY-bmCbkjjDBFU_-2EKRcHlqRsN6TUg` | same |
| JA | `1FfHbq_ZJpWh7QhMzltAdzoyCSDtYlXXvb7EnboPsitM` | same |

Used by `lib/item-catalog.ts`.

### Eliya Bot

`https://eliya-bot.herokuapp.com/comp/[tokens].png`

Generates party composition images. Used by `lib/community/eliya.ts`.

### Supabase

`https://tbafsbwadqufzjauvzha.supabase.co`

Backend for community features (auth, profiles, save shares, reports, moderation).

---

## Local JSON Files (`/public/data/`)

| File | Purpose |
|---|---|
| `characters_all.json` | Master character list with face codes |
| `characters_all_withjp.json` | Master character list including Japanese names |
| `character.json` | Character index/reference |
| `equips.json` / `equips_en.json` | Equipment catalog (local fallback) |

---

## Remote JSON Files (via `wf-utilities`)

All paths are relative to the GitHub raw base above. `datalist/` = JP data, `datalist_en/` = EN data.

### Character

| Path | Purpose |
|---|---|
| `datalist_en/character/character.json` | Character master data (EN) |
| `datalist_en/character/character_text.json` | Character descriptions/bios (EN) |
| `datalist/character/character_text.json` | Character descriptions/bios (JP) |

### Ability

| Path | Purpose |
|---|---|
| `datalist_en/ability/ability.json` | Ability definitions |
| `datalist_en/ability/ability_soul.json` | Ability soul/enhancement data |
| `datalist/ability/ability_default_statue_group.json` | Default statue group |
| `datalist/ability/ability_statue_group.json` | Statue group definitions |
| `datalist/ability/leader_ability.json` | Leader skill definitions |
| `datalist/ability/leader_ability_iosbundled.json` | Leader skill (iOS bundled) |

### Audio Assets

| Path | Purpose |
|---|---|
| `datalist_en/asset/bgm_asset.json` | BGM track listing (EN) |
| `datalist/asset/bgm_asset_iosbundled.json` | BGM (iOS bundled) |
| `datalist_en/asset/sound_effect_asset.json` | Sound effects (EN) |
| `datalist/asset/sound_effect_asset_iosbundled.json` | Sound effects (iOS bundled) |
| `datalist_en/asset/voice_asset.json` | Voice lines (EN) |
| `datalist/asset/voice_asset_iosbundled.json` | Voice lines (iOS bundled) |

### Mana Board

| Path | Purpose |
|---|---|
| `datalist_en/mana_board/mana_node.json` | Mana board node costs |
| `datalist_en/mana_board/upskill.json` | Upskill definitions |
| `datalist/mana_board/upskill_text.json` | Upskill text (JP) |
| `datalist/mana_board/upskill_text_iosbundled.json` | Upskill text (iOS bundled) |
| `datalist/mana_board/level_required_mana_node.json` | Level requirements per node |
| `datalist/mana_board/board_open_condition.json` | Board unlock conditions |

### Equipment / Items

| Path | Purpose |
|---|---|
| `datalist_en/item/equipment_status.json` | Equipment stat definitions |
| `datalist_en/item/item.json` | Item master list |
| `datalist_en/item/equipment.json` | Equipment master list |
| `datalist_en/equipment_enhancement/equipment_enhancement.json` | Enhancement definitions |
| `datalist_en/equipment_enhancement/equipment_enhancement_config.json` | Enhancement config |
| `datalist_en/equipment_enhancement/equipment_enhancement_status.json` | Enhancement status |
| `datalist_en/equipment_enhancement/equipment_enhancement_shop.json` | Enhancement shop |

### Rewards / Shops

| Path | Purpose |
|---|---|
| `datalist_en/reward/clear_reward.json` | Stage clear rewards |
| `datalist_en/reward/periodic_reward.json` | Periodic reward definitions |
| `datalist_en/reward/periodic_reward_point.json` | Periodic reward points |
| `datalist_en/reward/rare_score_reward.json` | Rare score rewards |
| `datalist_en/reward/score_reward.json` | Score reward definitions |
| `datalist_en/shop/general_shop.json` | General shop items |
| `datalist_en/shop/boss_coin_shop.json` | Boss coin shop |
| `datalist_en/shop/event_item_shop.json` | Event item shop |
| `datalist_en/shop/star_grain_shop.json` | Star grain shop |
| `datalist_en/shop/star_crumb_exchange.json` | Star crumb exchange |

### Feature Timeline / Ordered Maps

| Path | Purpose |
|---|---|
| `datalist/feature_banner/feature_banner.json` | Feature banner entries |
| `datalist/feature_announcement/feature_announcement.json` | Feature announcements |
| `datalist_en/feature_guide_dialog/feature_guide_dialog.json` | Guide dialog text |
| `datalist{_en}/gacha/*.json` | Gacha ordered maps (dynamic) |
| `datalist{_en}/event/*.json` | Event ordered maps (dynamic) |
| `datalist{_en}/campaign/*.json` | Campaign ordered maps (dynamic) |
| `manifest.json` / `manifest_{lang}.json` | File manifests for ordered maps and quests |

### Misc

| Path | Purpose |
|---|---|
| `datalist_en/achievement/achievement.json` | Achievement definitions |
| `datalist/active_mission/active_mission.json` | Active mission data |

---

## Internal API Endpoints

| Endpoint | Source Data | Purpose |
|---|---|---|
| `/api/characters` | `characters_all.json`, `character.json` | Character list with face codes |
| `/api/character-detail` | Multiple character datafiles | Full character profile |
| `/api/character-text` | `character_text.json` | Character descriptions |
| `/api/character-theme` | `bgm_asset.json` | Character unique themes |
| `/api/items` | Item catalog sources | Game items catalog |
| `/api/comics` | CDN metadata | Comic episode metadata |
| `/api/music` | `bgm_asset.json` | BGM track listings |
| `/api/manaboard/list` | Mana board datafiles | Character mana board list |
| `/api/manaboard/character` | Mana board datafiles | Individual mana board |
| `/api/quests/list` | Manifest files | Quest file listing |
| `/api/orderedmap/list` | Manifest files | Ordered map category listing |
| `/api/orderedmap/data` | Dynamic JSON files | Ordered map data |
| `/api/feature-timeline` | Ordered map datafiles | Feature banner timeline |
| `/api/assets/image` | Proxies CDN / GitHub images | Image proxy |
| `/api/assets/probe` | Probes `wfjukebox.b-cdn.net` | Audio availability check |
| `/api/local-assets` | `E:\WFDatamine\output\assets\` | Local asset fallback (dev only) |

---

## Notes

- **Production vs Dev**: When `VERCEL=1`, data is fetched from CDN/GitHub. Otherwise, `/public/data/` local files are used.
- **Cache policy**: Most fetches use `revalidate: 3600` (1hr) or `revalidate: 86400` (24hr).
- **Allowed image domains**: `wfjukebox.b-cdn.net`, `raw.githubusercontent.com` (proxied via `/api/assets/image`).
- **Local asset path** in `/api/local-assets` is hardcoded to `E:\WFDatamine\output\assets\` — only valid in local dev on Windows.
