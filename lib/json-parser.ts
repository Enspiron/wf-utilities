export interface ParsedItem {
  id: string;
  label: string;
  imageUrl?: string;
  data: Record<string, unknown>;
}

export function parseOrderedMapJson(jsonData: unknown): ParsedItem[] {
  if (!jsonData || typeof jsonData !== 'object') {
    return [];
  }

  const items: ParsedItem[] = [];
  const cdnBaseUrl = 'https://wfjukebox.b-cdn.net/';

  // Handle object with numeric keys (like the ability.json structure)
  const entries = Object.entries(jsonData);

  entries.forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const item: ParsedItem = {
        id: key,
        label: key,
        data: {},
      };

      // Try to extract meaningful data from the array
      value.forEach((val, idx) => {
        item.data[`field_${idx}`] = val;
      });

      // Check if the key itself is a file path (for asset JSONs like bgm_asset, sound_effect_asset, voice_asset)
      let assetPath: string | null = null;
      if (key.includes('/')) {
        // The key is the file path
        assetPath = key;
      } else {
        // Look for asset paths in the array (fields containing forward slashes)
        for (const val of value) {
          if (typeof val === 'string' && val.includes('/') && !val.includes(' ')) {
            // This looks like a path (has slashes, no spaces)
            assetPath = val;
            break;
          }
        }
      }

      // Look for potential label (usually first or second field)
      const firstValue = value[0];
      const secondValue = value[1];
      const thirdValue = value[2];
      
      // Try to find a good label (prefer non-empty string fields early in the array)
      if (typeof thirdValue === 'string' && thirdValue.trim() && !thirdValue.includes('/')) {
        item.label = thirdValue;
      } else if (typeof secondValue === 'string' && secondValue.trim() && !secondValue.includes('/')) {
        item.label = secondValue;
      } else if (typeof firstValue === 'string' && firstValue.trim()) {
        item.label = firstValue;
      }

      // Construct image URL from asset path or character ID
      if (assetPath) {
        // All paths are now at CDN root
        item.imageUrl = `${cdnBaseUrl}${assetPath}.png`;
      } else if (typeof firstValue === 'string' && firstValue.match(/^[a-z0-9_-]+$/i)) {
        // Fall back to character pattern
        item.imageUrl = `${cdnBaseUrl}character/character_art/${firstValue}/face.png`;
      }

      items.push(item);
    } else if (typeof value === 'object' && value !== null) {
      const item: ParsedItem = {
        id: key,
        label: key,
        data: value as Record<string, unknown>,
      };

      // Try to find image-related fields
      const objData = value as Record<string, unknown>;
      const potentialIdFields = ['id', 'character_id', 'asset_id', 'name', 'key'];
      
      for (const field of potentialIdFields) {
        if (objData[field] && typeof objData[field] === 'string') {
          item.label = objData[field] as string;
          item.imageUrl = `${cdnBaseUrl}character/character_art/${objData[field]}/face.png`;
          break;
        }
      }

      items.push(item);
    }
  });

  return items;
}

export function searchItems(items: ParsedItem[], searchTerm: string): ParsedItem[] {
  if (!searchTerm) return items;

  const lowerSearch = searchTerm.toLowerCase();
  return items.filter(item => {
    // Search in label
    if (item.label.toLowerCase().includes(lowerSearch)) return true;
    
    // Search in ID
    if (item.id.toLowerCase().includes(lowerSearch)) return true;

    // Search in data values
    return Object.values(item.data).some(val => 
      String(val).toLowerCase().includes(lowerSearch)
    );
  });
}
