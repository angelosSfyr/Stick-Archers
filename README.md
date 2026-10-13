# Stick Archers

A real-time couch archery game for up to 4 players on controllers (PS5 layout) or the keyboard.
Each player picks a class in the lobby (△): the **Archer** with bow and shield, or the
**Pyromancer**, who throws fireballs that leave the ground burning (anyone who touches it catches
fire) and has a fire shield that can't be held, only timed. Fireballs never headshot, and the
pyromancer's ultimate calls up a small fire minion instead of a special shot. Bots get a random class.
Two teams stand on either side of a canyon or hill, each with stone-throwing minions
(5 by default, set in Settings). Playing alone, you face one bot, or team up with a bot against
two (Settings → Single player).

## Controls

| Action | Controller | Keyboard |
| --- | --- | --- |
| Walk | left stick or d-pad ← → | ← → |
| Jump | ✕ | J |
| Drop down from a ledge | ↓ + ✕ | ↓ + J |
| Crouch | stick or d-pad ↓ | ↓ |
| Aim (sweeps up and down while held; each new press reverses) | LT | A |
| Draw (hold), shoot (release) | RT | D |
| Drink a potion (3 per round, +35) | □ | L |
| Block with the shield (hold; pyromancer: tap just before a hit) | ○ | K |
| Arm the ultimate (when the meter is full) | △ | I |
| Pause (continue, restart, quit) | OPTIONS (start) | Esc |

Menus use only LT / RT: tap to move or change, hold both to confirm. In the lobby, △ changes your class.
The pause menu also takes ↑ ↓ to pick, ✕ to choose and ○ or START to continue.
Every arena has more than one level: steps in the ground are too steep to walk up, so jump
them, and trees and wooden ledges can be jumped onto from below. Get knocked off one and you take
fall damage.
The archer's shield soaks up damage from the front, slowly refills while lowered, and stays broken for
the rest of the round once it breaks. The pyromancer's fire ward flares up for a moment on each tap,
burns up whatever hits it from the front, never breaks, and needs a moment to recharge. The ultimate fills slowly on its own, faster with damage you deal (minions too) and damage you take, or all at once from the ULT balloon.
A round is won when the other team's players are down; minions don't count.

## Running it

The game is split into JavaScript modules, which browsers won't load from a `file://` page.
Serve the folder and open it in Chrome or Edge:

```sh
python3 -m http.server 8000      # or: npx serve
# then open http://localhost:8000
```

## Layout

```
index.html              page markup; loads config/damage.js, then src/main.js
css/style.css           settings screen and buttons
config/damage.js        damage per body part (plain script, edit and reload)

src/
  main.js               frame loop: input -> update current screen -> audio -> draw
  config.js             shared tunables (gravity, aiming, timings, colors)
  util.js               math helpers

  data/                 content: add new things here
    classes.js          character classes (health, weapon, shield, ultimate, potions, cooldowns), minions
    weapons.js          weapons (damage, draw time, speed), projectiles (heavy, bomb, stone), shields
    powerups.js         balloon power-ups
    arenas.js           terrain shapes, trees and ledges, and what splits the middle (canyon or hill)

  core/                 settings (saved in localStorage), controller/keyboard input, clock
  screens/              settings screen, lobby (join, pick spots, ready), pause menu, screen switching
  game/                 the match: rounds (match.js), fighters and movement, controls (what each
                        button does), combat, bot AI (players and minions), balloons, terrain,
                        particles, sky
  render/               canvas, camera, and drawing for the lobby, the match and the HUD
  audio/                synthesized sound effects and music (no sound files)
```

`game/match.js` owns `M`, the running match. Other game modules import it and read or change it.
Drawing code only reads game state and never changes it.

## Adding content

**An arena:** add an entry to `ARENAS` in `src/data/arenas.js`. `height(u, m, D)` returns the
ground height at a point; `cliff` makes a step too steep to walk up (a wall you jump). `ledges(D)`
lists trees and wooden ledges on team 1's side (mirrored onto team 2's); they become one-way
platforms in `M.platforms`. The middle has to split the two sides: either set `middle: 'canyon'`
or put a hill there in `height`. The arena shows up in the settings automatically.

**An arrow type:** add an entry to `ARROWS` in `src/data/weapons.js`. You can set `damageMul`,
`alwaysKnocks`, `knock`, `blast`, `burn` (leaves burning ground), `noStick`, `noInstantKill`, and how it looks (`look`). To give it new behavior, add a
field there and handle it in `hitFighter` / `arrowCollides` in `src/game/combat.js`.

**A power-up:** add an entry to `POWERUPS` in `src/data/powerups.js`. Use `shot` to change the
next shot (`arrow`, `spread`) or `apply(f)` for an instant effect. A weapon that isn't a bow maps
a new `arrow` to its own version in `powerArrows` (the fireball turns `bomb` into `fireBomb`).

**A weapon:** add an entry to `WEAPONS` in `src/data/weapons.js` and point a class's `weapon`
at it. Fighters read `f.weapon` for damage, draw time, speed and spread. Set
`throws: true` for a thrown weapon (it gets the throwing pose). One that fires some other way
would need its own pose in `getPose` (`src/game/fighter.js`) and its own drawing in
`drawStickman` (`src/render/draw-common.js`).

**A shield:** add an entry to `SHIELDS` in `src/data/weapons.js` (`durability`, `regen` for a held
shield, or `burst` for one that flares up on each press, with the class's `cooldown.block`) and
point a class's `shield` at it.

**A character class:** add an entry to `CLASSES` in `src/data/classes.js` (the fields are listed
at the top of that file: health, weapon, shield, ultimate, potions, speed, jump, cooldowns).
`makeFighter` builds every fighter from its roster entry's `cls`. Every class without `minion` is in
`PLAYABLE`, so players can pick it in the lobby (△) and bots can get it. Set `hat` to tell it apart.

**Minions:** each team gets `settings.minions` fighters of the `minion` class
(`src/data/classes.js`), built by `makeMinion` in `src/game/fighter.js` and driven by `botInput`
in `src/game/bot.js`. They're ordinary fighters with `f.minion` set: combat works on them as on
anyone, damage dealt to them charges the ultimate, and `roundEnding` in `src/game/match.js` leaves
them out when deciding who won. A different kind of helper or monster is another class with
`minion: true`; an ultimate with `summon` calls one up mid-round (`summonMinion`, like the
pyromancer's `pyroMinion`).
