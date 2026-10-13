# Stick Archers

Browser couch game (canvas + Web Audio), plain ES modules, no build step and no dependencies.
README.md has the folder layout and "how to add X" guides; keep it current when structure changes.

## Running / checking
- Must be served, modules don't load from `file://`: `python3 -m http.server 8000`.
- No test suite. To verify a change, run it in a browser (Playwright's headless Chromium is in
  `~/.cache/ms-playwright`): join with the keyboard (D, then hold A+D), let a match play, and
  watch for page errors. Hold keys for ~100 ms: a press shorter than a frame is never seen.
  `await import('/src/game/match.js')` in the page gives the live `M`, handy for forcing state
  (power-ups, hp, ult charge). A controller can be faked by overriding `navigator.getGamepads`
  in an init script (standard mapping: buttons 0-3 = ✕ ○ □ △, 6/7 = LT/RT, 12-15 = d-pad).

## Architecture rules
- Content lives in `src/data/` as registries (`CLASSES`, `WEAPONS`, `ARROWS`, `SHIELDS`, `POWERUPS`, `ARENAS`).
  Prefer adding a data field + handling it once in game code over `if (kind === 'x')` checks.
- `M` (the running match) is owned by `src/game/match.js`; other modules import it and mutate its
  properties, but only match.js reassigns it. Same pattern for `screen` (screens/screens.js),
  `T` (core/clock.js), `countdownT` (screens/lobby.js) — ES live bindings.
- Modules import each other in cycles (match ↔ fighter ↔ combat ↔ ...). That's fine as long as
  imported bindings are only used inside functions, never at module top level.
- `src/render/` only reads game state; updates happen in `src/game/` and `src/screens/`.
- Fighter health is `f.maxHp` (from the class), never a hard-coded 100. Weapon stats come from
  `f.weapon` (one per class). Cooldowns, potions, move
  speed and the ultimate are class fields too: per-class numbers go in `CLASSES`, not config.js.
- Minions are ordinary fighters (`f.minion`, class `minion`) driven by the bot. They count for
  ultimate charge but not for winning a round (`roundEnding` in match.js).
- Bots press the same inputs as players: `botInput` returns the same object as `padInput`
  (see `NO_INPUT` in game/controls.js), so new actions need handling in both.
- `config/damage.js` is deliberately a classic script setting a global `DAMAGE`, so a typo in it
  falls back to defaults instead of breaking the game. Don't turn it into a module.

## Game constraints
- Real time: everyone plays at once, no turns. Each action has a short per-class cooldown.
- Controls (PS5 layout, standard gamepad mapping; input.js names buttons by what they do):
  left stick / d-pad = walk, ↓ crouch; LT aim, RT draw/shoot; ✕ jump (↓ + ✕ drops off a ledge), ○ block (held),
  □ potion, △ arm ultimate, START (button 9) pause. Keyboard: A / D = LT / RT, ← → ↑ ↓ = stick,
  J ✕ · K ○ · L □ · I △ · Esc START. Menus (settings, lobby) still only use LT / RT gestures: tap LT,
  tap RT, hold both. The pause menu (`M.paused`, screens/pause.js) also takes ↑ ↓ / ✕ / ○.
- Fighters always face the other side and never turn around. They walk only inside `f.zone`:
  up to `MID_STOP` from the middle and `EDGE_OUT` behind their start. Every arena needs a
  visible split in the middle: a deadly canyon (`middle: 'canyon'`) or a hill in its height().
- Every arena has several levels: steep steps in the ground are walls (`wallAhead` in terrain.js,
  checked in moveFighter) that must be jumped, and `ledges()` (trees, wooden ledges) are one-way
  platforms in `M.platforms`, same as the 2 v 2 start platforms (`start: true`). Ledges are
  mirrored so neither side gets better ground; keep each level within the archer's jump (420).
- Free-for-all is switched off (no `mode` row in settings; `settings.mode` stays 'teams'):
  with enemies on both sides it's undecided which way fighters should face. The ffa code paths
  (`M.ffa`, scores per player, lobby messages) are kept for when that's decided.
- Settings are saved in localStorage and validated against `SETTINGS_DEF` options on load, so
  renaming an option value silently resets it to the default.
- All sound is synthesized (`src/audio/`); there are no asset files.

## Git
- Never run git commands that change history or the remote (commit, push, branch, merge, rebase, stash...):
  the developer does all of that. Read-only git (status, diff, log) is fine.
- When done with a change, suggest a short commit message (one line) for the developer to use.

## Style
- Match existing code: short comments explaining *why*, compact one-line object literals,
  `const` arrow helpers, no classes.
- User-facing text in-game is plain and short, uppercase for popups/banners.
