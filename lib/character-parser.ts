// Character parser for WF character data

export interface Character {
  id: string;
  faceCode: string;
  // From character.json (array indices)
  attribute: string; // [1]: 1=Fire, 2=Water, 3=Wind, 4=Thunder, 5=Light, 6=Dark
  rarity: string; // [3]: 0-5 (0-indexed, so add 1 for actual rarity)
  race: string; // [4]
  weaponType: string; // [6]: 0=Slash, 1=Strike, 2=Thrust, 3=Shot (0-indexed)
  gender: string; // [7]
  stance: string; // [26]: Balance, Attacker, Tank, etc.
  
  // From character_text.json (array indices)
  nameJP: string; // [0]
  nameEN?: string; // from datalist_en
  subNameJP: string; // [1]
  subNameEN?: string;
  descriptionJP: string; // [2]
  descriptionEN?: string;
  titleJP: string; // [3]
  titleEN?: string;
  skillNameJP: string; // [4]
  skillNameEN?: string;
  skillDescriptionJP: string; // [5]
  skillDescriptionEN?: string;
  leaderAbilityNameJP: string; // [8]
  leaderAbilityNameEN?: string;
  voiceActorJP: string; // [9]
  voiceActorEN?: string;
  // Legacy fields for backwards compatibility
  description: string;
  title: string;
  skillName: string;
  skillDescription: string;
  leaderAbilityName: string;
  voiceActor: string;
}

export interface CharacterFilters {
  attribute?: string;
  weaponType?: string;
  race?: string[];
  gender?: string;
  rarity?: string;
  stance?: string;
  search?: string;
  voiceActor?: string;
}

const attributeNames: { [key: string]: string } = {
  '1': 'Fire',
  '2': 'Water',
  '3': 'Wind',
  '4': 'Thunder',
  '5': 'Light',
  '6': 'Dark',
};

const weaponNames: { [key: string]: string } = {
  '0': 'Slash',
  '1': 'Strike',
  '2': 'Thrust',
  '3': 'Shot',
};

export function parseCharacterData(
  characterData: Record<string, unknown[]>,
  characterTextData: Record<string, unknown[]>,
  characterTextDataEN?: Record<string, unknown[]>
): Character[] {
  const characters: Character[] = [];

  for (const [id, data] of Object.entries(characterData)) {
    const textData = characterTextData[id];
    const textDataEN = characterTextDataEN?.[id];
    
    if (!textData || !Array.isArray(data)) continue;

    // Handle both old format (direct array) and new format (array of arrays)
    // New format: "10": [["white_tiger", "1", ...]]
    // Old format: "10": ["white_tiger", "1", ...]
    const characterArray = Array.isArray(data[0]) && typeof data[0][0] === 'string' ? data[0] : data;

    const character: Character = {
      id,
      faceCode: String(characterArray[0] || ''),
      attribute: attributeNames[String(characterArray[1])] || String(characterArray[1]),
      rarity: String((parseInt(String(characterArray[3])) || 0) + 1),
      race: String(characterArray[4] || ''),
      weaponType: weaponNames[String(characterArray[6])] || String(characterArray[6]),
      gender: String(characterArray[7] || ''),
      stance: String(characterArray[26] || ''),
      nameJP: String(textData[0] || ''),
      nameEN: textDataEN ? String(textDataEN[0] || '') : undefined,
      subNameJP: String(textData[1] || ''),
      subNameEN: textDataEN ? String(textDataEN[1] || '') : undefined,
      descriptionJP: String(textData[2] || ''),
      descriptionEN: textDataEN ? String(textDataEN[2] || '') : undefined,
      titleJP: String(textData[3] || ''),
      titleEN: textDataEN ? String(textDataEN[3] || '') : undefined,
      skillNameJP: String(textData[4] || ''),
      skillNameEN: textDataEN ? String(textDataEN[4] || '') : undefined,
      skillDescriptionJP: String(textData[5] || ''),
      skillDescriptionEN: textDataEN ? String(textDataEN[5] || '') : undefined,
      leaderAbilityNameJP: String(textData[8] || ''),
      leaderAbilityNameEN: textDataEN ? String(textDataEN[8] || '') : undefined,
      voiceActorJP: String(textData[9] || ''),
      voiceActorEN: textDataEN ? String(textDataEN[9] || '') : undefined,
      // Legacy fields for backwards compatibility
      description: String(textData[2] || ''),
      title: String(textData[3] || ''),
      skillName: String(textData[4] || ''),
      skillDescription: String(textData[5] || ''),
      leaderAbilityName: String(textData[8] || ''),
      voiceActor: String(textData[9] || ''),
    };

    characters.push(character);
  }

  return characters;
}

export function filterCharacters(
  characters: Character[],
  filters: CharacterFilters
): Character[] {
  return characters.filter((char) => {
    if (filters.attribute && char.attribute !== filters.attribute) return false;
    if (filters.weaponType && char.weaponType !== filters.weaponType) return false;
    if (filters.race && filters.race.length > 0) {
      const charRaces = char.race.split(' / ').map(r => r.trim());
      // All selected races must be present in the character's races (AND logic)
      const hasAllRaces = filters.race.every(selectedRace => charRaces.includes(selectedRace));
      if (!hasAllRaces) return false;
    }
    if (filters.gender && char.gender !== filters.gender) return false;
    if (filters.rarity && char.rarity !== filters.rarity) return false;
    if (filters.stance && char.stance !== filters.stance) return false;
    if (filters.voiceActor && !char.voiceActorJP.includes(filters.voiceActor)) return false;
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesJP = char.nameJP.toLowerCase().includes(searchLower) ||
        char.subNameJP.toLowerCase().includes(searchLower) ||
        char.titleJP.toLowerCase().includes(searchLower) ||
        char.faceCode.toLowerCase().includes(searchLower);
      const matchesEN = char.nameEN?.toLowerCase().includes(searchLower) ||
        char.subNameEN?.toLowerCase().includes(searchLower) ||
        char.titleEN?.toLowerCase().includes(searchLower);
      
      if (!matchesJP && !matchesEN) return false;
    }

    return true;
  });
}

export function searchCharacters(
  characters: Character[],
  searchTerm: string
): Character[] {
  if (!searchTerm) return characters;
  
  const term = searchTerm.toLowerCase();
  
  return characters.filter((char) =>
    char.nameJP.toLowerCase().includes(term) ||
    char.nameEN?.toLowerCase().includes(term) ||
    char.subNameJP.toLowerCase().includes(term) ||
    char.subNameEN?.toLowerCase().includes(term) ||
    char.titleJP.toLowerCase().includes(term) ||
    char.titleEN?.toLowerCase().includes(term) ||
    char.descriptionJP.toLowerCase().includes(term) ||
    char.descriptionEN?.toLowerCase().includes(term) ||
    char.faceCode.toLowerCase().includes(term) ||
    char.voiceActorJP.toLowerCase().includes(term) ||
    char.voiceActorEN?.toLowerCase().includes(term) ||
    char.skillNameJP.toLowerCase().includes(term) ||
    char.skillNameEN?.toLowerCase().includes(term)
  );
}

export function getUniqueValues(
  characters: Character[],
  field: keyof Character
): string[] {
  const values = new Set<string>();
  
  characters.forEach((char) => {
    const value = char[field];
    if (value && typeof value === 'string') {
      // Handle slash-separated values (like races: "Human / Beast")
      if (value.includes(' / ')) {
        value.split(' / ').forEach(v => values.add(v.trim()));
      } else {
        values.add(value);
      }
    }
  });
  
  return Array.from(values).filter(v => v && v !== '(None)' && v !== '').sort();
}

// Parser for the alternative character data format (characters_all.json)
interface CharacterAllFormat {
  chars: Array<{
    DevNicknames: string;
    Attribute: string;
    Rarity: number;
    Race: string;
    Role: string;
    Gender: string;
    Stance: string;
    JPName: string;
    ENName: string;
    SubName: string;
    va: string;
    Skill: string;
    LeaderBuff: string;
    [key: string]: unknown;
  }>;
}

const weaponRoleMap: Record<string, string> = {
  'Sword': 'Slash',
  'Bow': 'Shot',
  'Gun': 'Shot',
  'Fist': 'Strike',
  'Staff': 'Thrust',
  'Katana': 'Slash',
  'Spear': 'Thrust',
  'Axe': 'Strike',
};

export function parseCharacterAllData(data: CharacterAllFormat): Character[] {
  return data.chars.map((char, index) => {
    // Extract title from EN name (format: "[Title]\nName")
    const enNameParts = char.ENName?.split('\n') || [];
    const titleEN = enNameParts[0]?.replace(/[\[\]]/g, '') || '';
    const nameEN = enNameParts[1] || char.JPName;

    const character: Character = {
      id: String(index + 1),
      faceCode: char.DevNicknames || '',
      attribute: char.Attribute || '',
      rarity: String(char.Rarity || 5),
      race: char.Race || '',
      weaponType: weaponRoleMap[char.Role] || char.Role || '',
      gender: char.Gender || '',
      stance: char.Stance || '',
      nameJP: char.JPName || '',
      nameEN: nameEN,
      subNameJP: char.SubName || '',
      subNameEN: titleEN,
      descriptionJP: '',
      descriptionEN: '',
      titleJP: char.SubName || '',
      titleEN: titleEN,
      skillNameJP: '',
      skillNameEN: '',
      skillDescriptionJP: char.Skill || '',
      skillDescriptionEN: char.Skill || '',
      leaderAbilityNameJP: '',
      leaderAbilityNameEN: '',
      voiceActorJP: char.va || '',
      voiceActorEN: char.va || '',
      // Legacy fields
      description: '',
      title: titleEN || char.SubName || '',
      skillName: '',
      skillDescription: char.Skill || '',
      leaderAbilityName: '',
      voiceActor: char.va || '',
    };

    return character;
  });
}
