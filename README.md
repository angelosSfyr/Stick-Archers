# Stick Archers

A couch artillery game for up to 4 players on controllers (LT / RT only) or the keyboard (A / D).

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
    classes.js          character classes (health, weapon)
    weapons.js          weapons (damage, draw time, speed) and arrow types (heavy, bomb)
    powerups.js         balloon power-ups
    arenas.js           terrain shapes

  core/                 settings (saved in localStorage), controller/keyboard input, clock
  screens/              settings screen, lobby (join, pick spots, ready), screen switching
  game/                 the match: rounds and turns (match.js), fighters, combat,
                        bot AI, balloons, terrain, particles, sky
  render/               canvas, camera, and drawing for the lobby, the match and the HUD
  audio/                synthesized sound effects and music (no sound files)
```

`game/match.js` owns `M`, the running match. Other game modules import it and read or change it.
Drawing code only reads game state and never changes it.

## Adding content

**An arena:** add an entry to `ARENAS` in `src/data/arenas.js`. `height(u, m, D)` returns the
ground height at a point. The arena shows up in the settings automatically.

**An arrow type:** add an entry to `ARROWS` in `src/data/weapons.js`. You can set `damageMul`,
`alwaysKnocks`, `knock`, `blast`, and how it looks (`look`). To give it new behavior, add a
field there and handle it in `hitFighter` / `arrowCollides` in `src/game/combat.js`.

**A power-up:** add an entry to `POWERUPS` in `src/data/powerups.js`. Use `shot` to change the
next shot (`arrow`, `spread`) or `apply(f)` for an instant effect.

**A weapon:** add an entry to `WEAPONS` in `src/data/weapons.js` and point a class at it.
Fighters read `f.weapon` for damage, draw time, speed and reload. A weapon that isn't a bow
(one that throws, or fires straight) would also need its own pose in `getPose`
(`src/game/fighter.js`) and its own drawing in `drawStickman` (`src/render/draw-common.js`).

**A character class:** add an entry to `CLASSES` in `src/data/classes.js`. `makeFighter` builds
every fighter from its roster entry's `cls`. For now the lobby gives everyone `DEFAULT_CLASS`.
Letting players choose means adding a picker to `src/screens/lobby.js` and
`src/render/draw-lobby.js`, and putting the choice in each roster entry.

**Monsters / minions:** these can be fighters that aren't on a player's team. Build them with
`makeFighter` (or your own maker with the same fields), give them a `team` such as `'monsters'`,
and drive them with an AI like `botInput` in `src/game/bot.js`. Combat already works on anything
in `M.fighters` (hit zones, `hurt`, `knock`, blasts, `isEnemy`). The parts to decide are:
- `roundEnding` in `src/game/match.js` counts the teams still alive, so decide whether
  monsters count towards that.
- Turn order (`nextTurn`) and spawning (`startRound`) go in `src/game/match.js`.
- A different body shape needs its own `getPose` / `hitZone` and its own drawing.
