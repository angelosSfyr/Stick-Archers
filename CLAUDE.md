# Stick Archers

Browser couch game (canvas + Web Audio), plain ES modules, no build step and no dependencies.
README.md has the folder layout and "how to add X" guides; keep it current when structure changes.

## Running / checking
- Must be served, modules don't load from `file://`: `python3 -m http.server 8000`.
- No test suite. To verify a change, run it in a browser (Playwright's headless Chromium is in
  `~/.cache/ms-playwright`): join with the keyboard (D, then hold A+D), let a match play, and
  watch for page errors. `await import('/src/game/match.js')` in the page gives the live `M`,
  handy for forcing state (power-ups, shields, hp).

## Architecture rules
- Content lives in `src/data/` as registries (`CLASSES`, `WEAPONS`, `ARROWS`, `POWERUPS`, `ARENAS`).
  Prefer adding a data field + handling it once in game code over `if (kind === 'x')` checks.
- `M` (the running match) is owned by `src/game/match.js`; other modules import it and mutate its
  properties, but only match.js reassigns it. Same pattern for `screen` (screens/screens.js),
  `T` (core/clock.js), `countdownT` (screens/lobby.js) — ES live bindings.
- Modules import each other in cycles (match ↔ fighter ↔ combat ↔ ...). That's fine as long as
  imported bindings are only used inside functions, never at module top level.
- `src/render/` only reads game state; updates happen in `src/game/` and `src/screens/`.
- Fighter health is `f.maxHp` (from the class), never a hard-coded 100. Weapon stats come from
  `f.weapon`.
- `config/damage.js` is deliberately a classic script setting a global `DAMAGE`, so a typo in it
  falls back to defaults instead of breaking the game. Don't turn it into a module.

## Game constraints
- Input is only LT / RT per controller (keyboard: A / D = LT / RT). Gestures: tap LT, tap RT,
  hold both. New features must be playable with just that.
- Settings are saved in localStorage and validated against `SETTINGS_DEF` options on load, so
  renaming an option value silently resets it to the default.
- All sound is synthesized (`src/audio/`); there are no asset files.

## Style
- Match existing code: short comments explaining *why*, compact one-line object literals,
  `const` arrow helpers, no classes.
- User-facing text in-game is plain and short, uppercase for popups/banners.
