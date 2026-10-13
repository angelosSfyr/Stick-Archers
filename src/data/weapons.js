// Weapons and the projectiles they shoot.

// Damage per body part, out of 100 health. It comes from config/damage.js (a plain
// script, so it can be edited without touching the code); these defaults are used
// if that file is missing or broken.
export const DMG = { head: 50, torso: 35, arm: 15, leg: 20 };
export const damageLoaded = typeof globalThis.DAMAGE === 'object' && globalThis.DAMAGE !== null;
if (damageLoaded) {
  for (const part of Object.keys(DMG)) {
    const v = Number(globalThis.DAMAGE[part]);
    if (Number.isFinite(v) && v >= 0) DMG[part] = v;
  }
}

// What each weapon does. A fighter gets its weapon from its class (src/data/classes.js).
//   damage:     damage per body part hit
//   minSpeed:   projectile speed at 0% draw (100% depends on the distance between the teams)
//   drawTime:   seconds of holding RT to reach full power
//   reloadTime: "everyone at the same time" mode: wait between shots
//   arrow:      the projectile type it shoots when no power-up says otherwise
export const WEAPONS = {
  bow: { name: 'Bow', damage: DMG, minSpeed: 250, drawTime: 1.0, reloadTime: 0.6, arrow: 'normal' },
};

// Projectile types. Everything is optional; leaving a field out means "like a normal arrow".
//   damageMul:    multiplies body-part damage (not instant headshot kills)
//   alwaysKnocks: knocks the target back even on a weak shot
//   knock:        how hard it knocks the target back
//   blast:        explodes where it lands, hurting enemies within `radius`
//   look:         how it's drawn: arrowhead size, shaft width, a bomb on the tip
export const ARROWS = {
  normal: {},
  heavy:  { damageMul: 1.5, alwaysKnocks: true, knock: 1.3, look: { head: 17, half: 7, width: 4.5 } },
  bomb:   { blast: { radius: 150, damage: 45 }, look: { bomb: true } },
};
