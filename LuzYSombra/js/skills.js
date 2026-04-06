import { SKILLS } from './constants.js';
import { S } from './state.js';

export function getSkillLevel(key) {
    return S.skills[key] || 0;
}

export function getSkillEffect(key) {
    const lvl = getSkillLevel(key);
    if (lvl === 0 || !SKILLS[key]) return {};
    return SKILLS[key].effect(lvl);
}

export function getAllEffects() {
    const merged = {};
    for (const key of Object.keys(SKILLS)) {
        const fx = getSkillEffect(key);
        for (const [prop, val] of Object.entries(fx)) {
            merged[prop] = (merged[prop] || 0) + val;
        }
    }
    return merged;
}

export function canLearnSkill(key) {
    const skill = SKILLS[key];
    if (!skill) return false;
    return getSkillLevel(key) < skill.maxLevel && S.skillPoints >= skill.cost;
}

export function learnSkill(key) {
    if (!canLearnSkill(key)) return false;
    const skill = SKILLS[key];
    S.skillPoints -= skill.cost;
    S.skills[key] = getSkillLevel(key) + 1;
    return true;
}

export function getSkillPointsOnLevelUp(level) {
    return level % 5 === 0 ? 2 : 1;
}
