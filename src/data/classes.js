// Character classes. Every fighter in a match is built from one of these
// (see makeFighter in src/game/fighter.js).
//   maxHp:  health at the start of a round
//   weapon: a key of WEAPONS in src/data/weapons.js
export const CLASSES = {
  archer: { name: 'Archer', maxHp: 100, weapon: 'bow' },
};

export const DEFAULT_CLASS = 'archer';
