// Power-up balloons: pop one with an arrow and the shooter gets it.
//   color, label: the balloon (and the badge over a fighter carrying it)
//   name:         shown when it's popped
//   sound:        a key of SFX in src/audio/sfx.js
// A power-up either changes the fighter's next bow shot (`shot`) or does something
// right away (`apply`).
//   shot.arrow:  projectile type for the next shot (a key of ARROWS in src/data/weapons.js)
//   shot.spread: shoot several arrows, at these angle offsets in degrees
export const POWERUPS = {
  triple:  { color: '#3d82d6', label: '×3',    name: 'TRIPLE SHOT', sound: 'powerup', shot: { spread: [-4, 0, 4] } },
  bomb:    { color: '#e2742b', label: 'BOMB',  name: 'BOMB ARROW',  sound: 'powerup', shot: { arrow: 'bomb' } },
  heavy:   { color: '#8452bd', label: 'HEAVY', name: 'HEAVY ARROW', sound: 'powerup', shot: { arrow: 'heavy' } },
  potion:  { color: '#2c9e4b', label: '+1 ✚', name: '+1 POTION', sound: 'heal',
             apply: f => { f.potions = Math.min(f.cls.maxPotions || 0, f.potions + 1); } },
  barrier: { color: '#c99a12', label: 'BARRIER', name: 'BARRIER', sound: 'powerup',
             apply: f => { f.barrier = true; } },
};

// What a fighter's next shot looks like: its weapon, plus a power-up and the ultimate
// for weapons that take them.
export function nextShot(f) {
  const w = f.weapon;
  if (!w.takesPowerups) return { arrow: w.arrow, spread: w.spread || [0] };
  const shot = (f.nextShot && POWERUPS[f.nextShot].shot) || {};
  const ult = f.ultArmed ? f.cls.ultimate.shot : {};
  return { arrow: ult.arrow || shot.arrow || w.arrow, spread: ult.spread || shot.spread || w.spread || [0] };
}
