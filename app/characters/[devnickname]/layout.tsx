import { Metadata } from 'next';
import { Character } from '@/lib/character-parser';

interface CharacterLayoutProps {
  children: React.ReactNode;
  params: { devnickname: string };
}

async function getCharacter(devnickname: string): Promise<Character | null> {
  try {
    // Fetch from the API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/characters?lang=both`, {
      cache: 'no-store',
    });
    const data = await response.json();
    const chars = data.characters || [];
    return chars.find((c: Character) => c.faceCode === devnickname) || null;
  } catch (error) {
    console.error('Error loading character for metadata:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { devnickname: string };
}): Promise<Metadata> {
  const character = await getCharacter(params.devnickname);

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

  return {
    title: `${fullTitle} - WF Facemaker`,
    description: metaDescription.substring(0, 160),
    openGraph: {
      title: fullTitle,
      description: metaDescription.substring(0, 160),
      type: 'profile',
      images: [
        {
          url: `/data/datalist/character/face/${character.faceCode}.png`,
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
      images: [`/data/datalist/character/face/${character.faceCode}.png`],
    },
  };
}

export default function CharacterLayout({ children }: CharacterLayoutProps) {
  return <>{children}</>;
}
