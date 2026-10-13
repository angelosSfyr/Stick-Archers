// Character classes. Every fighter in a match is built from one of these
// (see makeFighter / makeMinion in src/game/fighter.js).
//   maxHp:      health at the start of a round
//   weapon:     main weapon, a key of WEAPONS in src/data/weapons.js
//   secondary:  weapon switched to with □ (optional)
//   shield:     a key of SHIELDS in src/data/weapons.js, held up with ○ (optional)
//   ultimate:   charges with damage dealt; △ arms it and the next main-weapon shot uses `shot`
//               (same fields as a power-up's shot: arrow, spread)
//   potions:    how many a fighter starts each round with (✕ drinks one), up to maxPotions
//   moveSpeed:  walking, px/s;  jumpHeight: px
//   cooldown:   seconds before the same action works again
//   size:       body scale (1 = an archer)
//   minion:     a small helper on a team; doesn't count for winning a round
export const CLASSES = {
  archer: {
    name: 'Archer', maxHp: 100, weapon: 'bow', secondary: 'stones', shield: 'buckler',
    ultimate: { name: 'TRIPLE ARROW', charge: 150, shot: { spread: [-5, 0, 5] } },
    potions: 3, maxPotions: 5, potionHeal: 35,
    moveSpeed: 330, jumpHeight: 420,   // high enough to jump onto the 2 v 2 platform (PLATFORM_RISE)
    cooldown: { shot: 0.6, swap: 0.3, potion: 1.5 },
  },
  minion: {
    name: 'Minion', maxHp: 60, weapon: 'stone', size: 0.6, minion: true,
    moveSpeed: 135, jumpHeight: 0,
    cooldown: { shot: 2.2 },
  },
};

export const DEFAULT_CLASS = 'archer';
export const MINION_CLASS = 'minion';
