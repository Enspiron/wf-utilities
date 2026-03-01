import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface Item {
  id: string;
  devname: string;
  name: string;
  description: string;
  icon: string;
  rarity: number;
  category: string;
  type: 'item' | 'equipment';
  flavorText?: string;
  thumbnail?: string;
}

type ItemData = string[];
type DataMap = Record<string, ItemData>;
const DATA_FALLBACK_BASE = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

async function loadDataMap(relativePath: string): Promise<DataMap> {
  const localPath = path.join(process.cwd(), 'public', 'data', ...relativePath.split('/'));

  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf-8')) as DataMap;
  }

  const remoteUrl = `${DATA_FALLBACK_BASE}/${relativePath}`;
  const response = await fetch(remoteUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${remoteUrl} (${response.status})`);
  }

  return (await response.json()) as DataMap;
}

export async function GET() {
  try {
    const [itemsData, equipmentData] = await Promise.all([
      loadDataMap('datalist_en/item/item.json'),
      loadDataMap('datalist_en/item/equipment.json'),
    ]);

    const items: Item[] = [];

    // Parse items
    Object.entries(itemsData).forEach(([id, data]) => {
      if (Array.isArray(data)) {
        const categoryCode = data[14];
        const subcategoryCode = data[15];
        
        // Determine category based on codes
        let category = 'Other';
        if (categoryCode === '2') {
          if (subcategoryCode === '9') category = 'Elements';
          else if (subcategoryCode === '8') category = 'Skill Materials';
          else category = 'Materials';
        } else if (categoryCode === '1') {
          category = 'Currency';
        } else if (categoryCode === '3') {
          category = 'Consumables';
        } else if (categoryCode === '7') {
          category = 'Tickets';
        }

        items.push({
          id,
          devname: data[0] || '',
          name: data[1] || 'Unknown',
          description: data[4] || '',
          icon: data[2] || '',
          rarity: parseInt(data[17]) || 1,
          category,
          type: 'item'
        });
      }
    });

    // Parse equipment (orbs)
    Object.entries(equipmentData).forEach(([id, data]) => {
      if (Array.isArray(data)) {
        items.push({
          id,
          devname: data[0] || '',
          name: data[1] || 'Unknown',
          description: data[7] || '',
          flavorText: data[5] || '',
          icon: data[6] || data[3] || '',
          thumbnail: data[4] || '',
          rarity: parseInt(data[11]) || 5,
          category: 'Equipment',
          type: 'equipment'
        });
      }
    });

    return NextResponse.json({
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Error loading items:', error);
    return NextResponse.json(
      { error: 'Failed to load items' },
      { status: 500 }
    );
  }
}
