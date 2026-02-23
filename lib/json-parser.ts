export interface ParsedItem {
  id: string;
  label: string;
  imageUrl?: string;
  data: Record<string, unknown>;
}

// Helper function to detect if a string looks like a file path
function isFilePath(str: string): boolean {
  if (typeof str !== 'string' || !str.trim()) return false;
  
  // Must contain forward slashes
  if (!str.includes('/')) return false;
  
  // Should not contain spaces (paths don't have spaces)
  if (str.includes(' ')) return false;
  
  // Should not be a URL (already complete)
  if (str.startsWith('http://') || str.startsWith('https://')) return false;
  
  // Should have at least 2 path segments (e.g., "folder/file")
  const segments = str.split('/').filter(s => s.length > 0);
  if (segments.length < 2) return false;
  
  return true;
}

export function parseOrderedMapJson(jsonData: unknown, category?: string): ParsedItem[] {
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
      if (isFilePath(key)) {
        // The key is the file path
        assetPath = key;
      } else {
        // Look for asset paths in the array (fields containing file paths)
        for (const val of value) {
          if (isFilePath(val)) {
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

      // Construct image URL only if we found an actual asset path in the data
      if (assetPath) {
        item.imageUrl = `${cdnBaseUrl}${assetPath}.png`;
      }

      items.push(item);
    } else if (typeof value === 'object' && value !== null) {
      // Check if this is a nested structure (object containing objects/arrays)
      const objEntries = Object.entries(value);
      const isNestedStructure = objEntries.length > 0 && 
        objEntries.every(([, val]) => typeof val === 'object' && val !== null);
      
      if (isNestedStructure) {
        // This is a nested structure like bonus files - expand it
        objEntries.forEach(([subKey, subValue]) => {
          if (Array.isArray(subValue)) {
            const item: ParsedItem = {
              id: `${key}.${subKey}`,
              label: `${key} - ${subKey}`,
              data: {},
            };

            // Extract data from array
            subValue.forEach((val, idx) => {
              item.data[`field_${idx}`] = val;
            });

            // Look for asset paths
            let assetPath: string | null = null;
            for (const val of subValue) {
              if (isFilePath(val)) {
                assetPath = val;
                break;
              }
            }

            // Try to find a better label
            const firstValue = subValue[0];
            const secondValue = subValue[1];
            if (typeof firstValue === 'string' && firstValue.trim() && !firstValue.includes('/')) {
              item.label = `${key} - ${subKey}: ${firstValue}`;
            }

            // Construct image URL
            if (assetPath) {
              item.imageUrl = `${cdnBaseUrl}${assetPath}.png`;
            }

            items.push(item);
          }
        });
      } else {
        // Regular object (not nested)
        const item: ParsedItem = {
          id: key,
          label: key,
          data: value as Record<string, unknown>,
        };

        // Try to find image-related fields and asset paths
        const objData = value as Record<string, unknown>;
        
        // Look for a file path in any field
        let assetPath: string | null = null;
        for (const [fieldKey, fieldValue] of Object.entries(objData)) {
          if (isFilePath(fieldValue as string)) {
            assetPath = fieldValue as string;
            break;
          }
        }
        
        // Try to find a good label
        const potentialIdFields = ['id', 'character_id', 'asset_id', 'name', 'key', 'title'];
        for (const field of potentialIdFields) {
          if (objData[field] && typeof objData[field] === 'string') {
            item.label = objData[field] as string;
            break;
          }
        }
        
        // Construct image URL only if we found an actual asset path
        if (assetPath) {
          item.imageUrl = `${cdnBaseUrl}${assetPath}.png`;
        }

        items.push(item);
      }
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
