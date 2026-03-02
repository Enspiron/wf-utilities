"use client";
import React from "react";
import UnitEditDialog from "./UnitEditDialog";
import character_id from './character.json';
import jsonnet from 'jsonnet';

const json_link = "https://github.com/blead/eliyabot-assets/blob/master/src/characters.jsonnet"



interface CharacterId {
    [key: string]: string[];
}

interface UserCharacterList {
    [key: string]: any;
}

interface Character {
    devnickname: string;
    id: string;
    code: string;
}

interface Props {
    userlist?: {
        data: {
            user_character_list: Record<string, any>;
        };
    };
}

const characterId: CharacterId = character_id as unknown as CharacterId;

const searchDevNameById = (id: string): string | undefined => {
    return characterId[id]?.[0];
};

const hasMB2 = (id: string): boolean => {
    //check if index 31 is true
    return characterId[id]?.[characterId[id].length-1] === "6,6,6,6,6,6";
}

const checkOwnedCharacters = (userList: UserCharacterList = {}): Record<string, string> => {
    const ownedChars: Record<string, string> = {};
    for (const key in userList) {
        const devName = searchDevNameById(key);
        if (devName) {
            ownedChars[devName] = key;
        }
    }
    return ownedChars;
};

export default function Characters({ userlist }: Props) {
    const userCharacterList = userlist?.data?.user_character_list;
    
    if (!userCharacterList) {
        console.warn("userlist, userlist.data, or userlist.data.user_character_list is undefined");
        return <div>No data available</div>;
    }

    const ownedCharacters = checkOwnedCharacters(userCharacterList);

    const makeCharacterList = (): Character[] => {
        return Object.keys(characterId).map(key => ({
            devnickname: characterId[key]?.[0] || '',
            id: key,
            code: key
        }));
    };

    const characterList = makeCharacterList();

    //use json
    const fetch_json = async () => {
        const response = await fetch(json_link);
        const data = await response.json();
        console.log(data);
    }

    fetch_json()

    

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                minHeight: '100vh',
                padding: '30px 0',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(15, 1fr)',
                    boxSizing: 'border-box',
                    justifyContent: 'center',
                }}
            >
                {characterList.map(character => (
                    <div key={character.id}>
                        <UnitEditDialog 
                            devnickname={character.devnickname} 
                            characterId={character.id} 
                            ownedunits={ownedCharacters} 
                            code={character.code}
                            userlist={userlist}
                            mb2={hasMB2(character.id)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
