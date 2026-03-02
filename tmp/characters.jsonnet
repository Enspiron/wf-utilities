local abilities = import '../../wf-assets/orderedmap/ability/ability.json';
local leaderAbilities = import '../../wf-assets/orderedmap/ability/leader_ability.json';
local characters = import '../../wf-assets/orderedmap/character/character.json';
local characterStats = import '../../wf-assets/orderedmap/character/character_status.json';
local characterTexts = import '../../wf-assets/orderedmap/character/character_text.json';
local characterSkills = import '../../wf-assets/orderedmap/skill/action_skill.json';
local keywords = import './ability/keywords.libsonnet';
local abilityParser = import './ability/parser.libsonnet';
local banners = import './banners.jsonnet';
local elements = import './elements.json';
local overrides = import './overrides/characters.jsonnet';

local MAX_LV_BONUS = [null, 12 * 0.004, 10 * 0.005, 8 * 0.008, 6 * 0.015, 4 * 0.03];
local AWAKEN_STATS = [null, [30, 150], [40, 200], [50, 250], [54, 270], [60, 300]];
local ROLES = { '0': 'Sword', '1': 'Fist', '2': 'Bow', '3': 'Support', '4': 'Special' };

local Character(id, data) = if '2' in characterSkills[data[0]] then {
  id: id,
  leaderSkillName:: characterTexts[id][0][8],
  leaderSkillDescription:: if data[17] in leaderAbilities then abilityParser.parseLeaderSkillFormatted(leaderAbilities[data[17]]),
  skillName:: characterTexts[id][0][4],
  upgradedSkillName:: characterTexts[id][0][6],
  skillDescription:: characterTexts[id][0][7],
  banners:: std.filter(function(x) std.member(x.pickup, id), banners),

  DevNicknames: data[0],
  SubName: characterTexts[id][0][3],
  JPName: characterTexts[id][0][1],
  Rarity: std.parseInt(data[2]),
  Attribute: elements[data[3]],
  Role: ROLES[data[6]],
  Race: keywords.race(data[4]),
  Stance: data[26],
  Gender: std.strReplace(data[7], 'Ririi', 'Lily'),
  MaxHP: std.ceil(std.parseInt(characterStats[id]['100'][0][0]) * (1 + MAX_LV_BONUS[self.Rarity])) + AWAKEN_STATS[self.Rarity][1],
  MaxATK: std.ceil(std.parseInt(characterStats[id]['100'][0][1]) * (1 + MAX_LV_BONUS[self.Rarity])) + AWAKEN_STATS[self.Rarity][0],
  SkillWait: characterSkills[data[0]]['2'][0][5],
  SkillIcon: std.strReplace(characterSkills[data[0]]['2'][0][2], 'dynamic/skill/', ''),
  SkillRange: characterSkills[data[0]]['2'][0][8:16],

  ENName:: '[' + self.SubName + ']\n' + self.JPName,
  LeaderBuff: if self.leaderSkillDescription != null then '[' + self.leaderSkillName + ']\n' + self.leaderSkillDescription,
  Skill: '[' + self.skillName + ']\n' + self.skillDescription,
  Obtain: if std.length(self.banners) > 0 && self.banners[0].name == '流星祭ガチャ' then '[Limited] Meteor Festival Gacha',
  Ability1: if data[19] in abilities then abilityParser.parseAbilityFormatted(abilities[data[19]]),
  Ability2: if data[20] in abilities then abilityParser.parseAbilityFormatted(abilities[data[20]]),
  Ability3: if data[21] in abilities then abilityParser.parseAbilityFormatted(abilities[data[21]]),
  Ability4: if data[22] in abilities then abilityParser.parseAbilityFormatted(abilities[data[22]]),
  Ability5: if data[23] in abilities then abilityParser.parseAbilityFormatted(abilities[data[23]]),
  Ability6: if data[24] in abilities then abilityParser.parseAbilityFormatted(abilities[data[24]]),
} + if data[0] in overrides then overrides[data[0]] else {};

std.prune([Character(char.key, char.value[0]) for char in std.objectKeysValues(characters)])
