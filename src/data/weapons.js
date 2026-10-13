// Weapons, the projectiles they shoot, and shields.

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
const scaled = k => Object.fromEntries(Object.entries(DMG).map(([part, v]) => [part, Math.round(v * k)]));

// What each weapon does. A fighter gets its weapon from its class (src/data/classes.js).
//   damage:        damage per body part hit
//   minSpeed:      projectile speed at 0% draw
//   maxSpeed:      speed at 100% draw, as a share of the bow's (which depends on the distance between the teams)
//   drawTime:      seconds of holding RT to reach full power
//   arrow:         the projectile type it shoots when no power-up says otherwise
//   spread:        shoots several at once, at these angle offsets in degrees
//   takesPowerups: balloon power-ups change its shots (the class's ultimate always does)
//   powerArrows:   its own version of a power-up's projectile (by ARROWS key), e.g. a fire bomb instead of a bomb arrow
//   throws:        thrown by hand instead of shot from a bow (pose and drawing)
//   sound:         a key of SFX in src/audio/sfx.js
export const WEAPONS = {
  bow:    { name: 'Bow', damage: DMG, minSpeed: 250, maxSpeed: 1, drawTime: 1.0, arrow: 'normal',
            takesPowerups: true, sound: 'shoot' },
  stone:  { name: 'Stone', damage: scaled(0.35), minSpeed: 200, maxSpeed: 0.7, drawTime: 0.8, arrow: 'stone',
            throws: true, sound: 'throw' },
  fireball: { name: 'Fireball', damage: scaled(0.6), minSpeed: 250, maxSpeed: 0.9, drawTime: 1.0, arrow: 'fireball',
              takesPowerups: true, powerArrows: { heavy: 'heavyFireball', bomb: 'fireBomb' },
              throws: true, sound: 'fireball' },
  boulder: { name: 'Boulder', damage: scaled(1.2), minSpeed: 220, maxSpeed: 0.9, drawTime: 1.4, arrow: 'boulder',
             takesPowerups: true, powerArrows: { heavy: 'heavyBoulder', bomb: 'bombBoulder' },
             throws: true, sound: 'boulder' },
};

// Projectile types. Everything is optional; leaving a field out means "like a normal arrow".
//   damageMul:     multiplies body-part damage (not instant headshot kills)
//   alwaysKnocks:  knocks the target back even on a weak shot
//   knock:         how hard it knocks the target back (0: never)
//   blast:         explodes where it lands, hurting enemies within `radius`
//   noStick:       doesn't stay stuck in bodies or the ground
//   noInstantKill: a headshot does head damage even when headshots kill instantly
//   burn:          sets the ground on fire where it lands (or under whoever it hits) for `time` seconds,
//                  `radius` px each way; enemies who touch it burn for `dps` damage/s, and keep
//                  burning `after` seconds once they're out of it
//   hitRadius:     hits with its whole body (px), not just its centre
//   ko:            knocks out whoever it hits unshielded; a shield takes it instead (see shieldTakes in combat.js)
//   crush:         flattens minions and keeps going
//   look:          how it's drawn: arrowhead size, shaft width, a bomb on the tip, a stone of radius `stone`,
//                  a boulder of radius `boulder`, or a fireball of radius `fireball`
export const ARROWS = {
  normal: {},
  heavy:  { damageMul: 1.5, alwaysKnocks: true, knock: 1.3, look: { head: 17, half: 7, width: 4.5 } },
  bomb:   { blast: { radius: 150, damage: 45 }, look: { bomb: true } },
  stone:  { knock: 0, noStick: true, noInstantKill: true, look: { stone: 5 } },
  fireball: { knock: 0, noStick: true, noInstantKill: true, burn: { radius: 90, time: 3, dps: 12, after: 2 },
              look: { fireball: 9 } },
  // the pyromancer's power-ups: still fireballs, so they can't headshot either
  heavyFireball: { damageMul: 1.5, alwaysKnocks: true, knock: 1.3, noStick: true, noInstantKill: true,
                   burn: { radius: 90, time: 3, dps: 12, after: 2 }, look: { fireball: 13 } },
  fireBomb:      { blast: { radius: 150, damage: 45 }, knock: 0, noStick: true, noInstantKill: true,
                   burn: { radius: 150, time: 3, dps: 12, after: 2 }, look: { fireball: 12 } },
  // the giant's: no headshots either
  boulder:      { knock: 1.4, noStick: true, noInstantKill: true, hitRadius: 18, look: { boulder: 20 } },
  heavyBoulder: { damageMul: 1.5, alwaysKnocks: true, knock: 1.8, noStick: true, noInstantKill: true, hitRadius: 24,
                  look: { boulder: 27 } },
  bombBoulder:  { blast: { radius: 150, damage: 45 }, knock: 0, noStick: true, noInstantKill: true, hitRadius: 18,
                  look: { boulder: 20, bomb: true } },
  megaBoulder:  { ko: true, crush: true, alwaysKnocks: true, knock: 2, noStick: true, noInstantKill: true, hitRadius: 62,
                  look: { boulder: 66 } },
};

// Shields, raised with ○. They stop everything coming from the front.
// A held shield soaks up the damage until `durability` runs out; then it breaks for the rest of the round.
//   regen: durability regained per second while not blocking
// A burst shield (`burst`) can't be held: pressing ○ raises it for `burst` seconds, and it burns up
// whatever hits it then. It never breaks; the class's `cooldown.block` says how often it works.
// A hand (`takes`) is held like a shield and never breaks, but lets `takes` of the damage through
// (`koTakes` of the fighter's max health from a knock-out shot). `guard`: blocks with the arms
// lifted in front of the head instead of holding something up.
export const SHIELDS = {
  buckler:  { name: 'Buckler', durability: 90, regen: 5 },
  fireWard: { name: 'Fire Ward', burst: 0.35 },
  hand:     { name: 'Hand', takes: 0.1, koTakes: 0.2, guard: true },
};
