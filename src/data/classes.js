// Character classes. Every fighter in a match is built from one of these
// (see makeFighter / makeMinion in src/game/fighter.js).
//   maxHp:      health at the start of a round
//   weapon:     a key of WEAPONS in src/data/weapons.js
//   shield:     a key of SHIELDS in src/data/weapons.js, held up with ○ (optional)
//   ultimate:   charges with damage dealt (and `fromTaken` × damage taken, so whoever is
//               losing catches up); △ arms it and the next shot uses `shot`
//               (same fields as a power-up's shot: arrow, spread)
//   potions:    how many a fighter starts each round with (□ drinks one), up to maxPotions
//   moveSpeed:  walking, px/s;  jumpHeight: px
//   cooldown:   seconds before the same action works again (shot, potion, block for burst shields)
//   size:       body scale (1 = an archer)
//   hat:        drawn on the head so classes can be told apart ('wizard')
//   minion:     a small helper on a team; doesn't count for winning a round
export const CLASSES = {
  archer: {
    name: 'Archer', maxHp: 100, weapon: 'bow', shield: 'buckler',
    ultimate: { name: 'TRIPLE ARROW', charge: 100, fromTaken: 0.5, shot: { spread: [-5, 0, 5] } },
    potions: 3, maxPotions: 5, potionHeal: 35,
    moveSpeed: 330, jumpHeight: 420,   // high enough to jump onto the 2 v 2 platform (PLATFORM_RISE)
    cooldown: { shot: 0.6, potion: 1.5 },
  },
  pyromancer: {
    name: 'Pyromancer', maxHp: 100, weapon: 'fireball', shield: 'fireWard', hat: 'wizard',
    ultimate: { name: 'INFERNO', charge: 100, fromTaken: 0.5, shot: { arrow: 'inferno' } },
    potions: 3, maxPotions: 5, potionHeal: 35,
    moveSpeed: 320, jumpHeight: 420,
    cooldown: { shot: 0.9, potion: 1.5, block: 1.5 },
  },
  minion: {
    name: 'Minion', maxHp: 60, weapon: 'stone', size: 0.6, minion: true,
    moveSpeed: 135, jumpHeight: 0,
    cooldown: { shot: 2.2 },
  },
};

export const DEFAULT_CLASS = 'archer';
export const MINION_CLASS = 'minion';
// what players (and bots) can pick in the lobby, in the order △ steps through them
export const PLAYABLE = Object.keys(CLASSES).filter(k => !CLASSES[k].minion);
