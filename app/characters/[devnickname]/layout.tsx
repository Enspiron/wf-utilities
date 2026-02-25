import { Metadata } from 'next';
import { Character, parseCharacterAllData } from '@/lib/character-parser';

interface CharacterLayoutProps {
  children: React.ReactNode;
  params: Promise<{ devnickname: string }>;
}

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

async function getCharacter(devnickname: string): Promise<Character | null> {
  try {
    let characterData;

    if (USE_CDN) {
      // Fetch from CDN in production
      const characterUrl = `${CDN_BASE_URL}/characters_all.json`;
      const response = await fetch(characterUrl, { next: { revalidate: 3600 } });
      characterData = await response.json();
    } else {
      // Use local files in development
      const fs = await import('fs');
      const path = await import('path');
      const characterPath = path.join(process.cwd(), 'public', 'data', 'characters_all.json');
      characterData = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));
    }

    const characters = parseCharacterAllData(characterData);
    return characters.find((c: Character) => c.faceCode === devnickname) || null;
  } catch (error) {
    console.error('Error loading character for metadata:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ devnickname: string }>;
}): Promise<Metadata> {
  const { devnickname } = await params;
  const character = await getCharacter(devnickname);

  if (!character) {
    return {
      title: 'Character Not Found - WF Facemaker',
      description: 'Character not found in the database.',
    };
  }

  const name = character.nameEN || character.nameJP || 'Unknown Character';
  const title = character.titleEN || character.titleJP || '';
  const description = character.descriptionEN || character.descriptionJP || '';
  
  const fullTitle = title ? `${name} - ${title}` : name;
  const metaDescription = description || `${fullTitle} - ${character.attribute} ${character.weaponType} character from World Flipper`;

  // Use absolute URL for images (required for Discord/social media embeds)
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  const imageUrl = `${baseUrl}/data/datalist/character/face/${character.faceCode}.png`;

  return {
    title: `${fullTitle} - WF Facemaker`,
    description: metaDescription.substring(0, 160),
    openGraph: {
      title: fullTitle,
      description: metaDescription.substring(0, 160),
      type: 'profile',
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
          alt: name,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title: fullTitle,
      description: metaDescription.substring(0, 160),
      images: [imageUrl],
    },
  };
}

export default function CharacterLayout({ children }: CharacterLayoutProps) {
  return <>{children}</>;
}
