# KAIST
This is an online program where several tasks have assigned and this repo will contain the completed tasks.

## Yutnori 3D Game

A browser-based 3D Yutnori game (HTML, CSS, vanilla JavaScript, Three.js — no React, no backend, no build step). See [`PRD.md`](./PRD.md) for the full design and [`EVALUATION.md`](./EVALUATION.md) for the assignment checklist.

### Running it locally

Opening `index.html` directly from the filesystem (`file://`) will not work, since ES module imports and the Three.js import map require an HTTP origin. Serve the folder with any simple local static server instead, for example:

```bash
# Python 3 (built in on most systems)
python -m http.server 8000

# or, if you have Node.js installed
npx serve .
```

Then open `http://localhost:8000` (or whichever port/URL the tool prints) in a modern browser.

### Project files

- `index.html`, `style.css` — page shell and styling
- `main.js` — entry point; wires up the Three.js scene, game state, and UI
- `gameLogic.js` — game rules and state (no DOM, no Three.js)
- `boardData.js` — board graph/coordinates only (no rules)
- `ui.js` — DOM/HUD rendering (no game logic, no Three.js)
- `i18n.js` — English/Korean text strings
- `assets/`, `pieces/` — textures, sounds, images, and piece-face assets

### Developer test panel (DEBUG_MODE)

`main.js` has a `DEBUG_MODE` constant near the top of the file. When set to `true`, an on-screen developer panel appears (top-left, clearly marked "DEVELOPER TEST PANEL") with one button per Yut throw outcome (Do, Gae, Geol, Yut, Mo, Back Do), letting you force a specific result instead of waiting on randomness while testing. Forced throws run through the exact same processing pipeline as a real throw (`gameLogic.js`'s `forceThrowResult()` shares its result-computation logic with `throwSticks()`), so it cannot behave differently from normal play — it only changes which stick sides happen to be dealt.

**Before submitting, `DEBUG_MODE` must be `false`** (this is also its default). To verify:

```bash
grep -n "DEBUG_MODE" main.js
```

should show `const DEBUG_MODE = false;` with no other assignment overriding it. With it `false`, `renderDebugPanel()` is never called — the panel doesn't exist in the DOM at all, not merely hidden.

## Current Progress

Implementation is complete through **Phase 7**.

**Completed features**
- Phase 1 — Three.js scene: renderer, tilted camera, lighting, responsive resize handling.
- Phase 2 — 3D board: 25-node graph (outer ring + diagonal shortcuts + center) generated entirely from `boardData.js`, with corner/shortcut/plain space markers and path lines.
- Phase 3 — Yut sticks and throwing: Do/Gae/Geol/Yut/Mo/Back Do, correct Do-vs-Back-Do disambiguation via the marked stick, throw animation, bonus-throw chaining.
- Phase 4 — 3D pieces: 4 blue + 4 red pieces, waiting areas, hover/select/lift interaction.
- Phase 5 — Piece movement: entering the board, moving one visible space at a time with animation, both diagonal shortcuts (activating only on landing exactly on a corner, not on pass-through), Back-Do, overshoot completion, a dedicated finish area, turn-flow rules (no movement until bonus throws finish, no turn switch while results remain pending, forfeited Back-Do when no piece can use it).
- Phase 6 — Catching (landing on an opponent's piece or stack sends it back to start and grants a bonus throw) and stacking (landing on your own piece merges them into one unit that moves/catches/completes together).
- Phase 7 — Win detection (first player to get all 4 pieces Home wins immediately, all further input blocked), a victory camera-zoom + lighting-pulse effect distinct from ordinary move/catch animations, a winner banner with "Play Again", and a persistent Restart control (with a confirmation step when restarting mid-game; no confirmation needed from a fresh or already-finished game).
- Developer test panel (`DEBUG_MODE` in `main.js`) for forcing throw results during testing — see below.

**Remaining phases**
- Pre-game setup screen (nickname, language, piece-face selection) — currently a placeholder stub.
- Sound effects and the Korean-language UI toggle (strings exist in `i18n.js`, but no language-switch control is wired up yet).
- Accessibility features (keyboard operability, screen-reader support) per `PRD.md` §24.
- Bonus features (AI opponent, custom face textures, etc.).

**Known bugs**
- None currently outstanding. Phase 7 was verified with a 27-assertion headless test script (exact-landing win, overshoot win, winner latching, restart from mid-game, restart from game-over) plus a full browser session confirming the win banner, victory camera/light effect, input lockout after game-over, and both restart paths (with/without confirmation) all work through real UI interaction, with zero console errors.
- Minor, non-functional: a couple of JSDoc comments in `boardData.js` and `gameLogic.js` still say direction/route resolution is "a later phase's job," left over from before Phase 5 implemented it. Doesn't affect behavior.

**Next milestone**
Sound effects and the Korean-language toggle — the last remaining features before accessibility and bonus/stretch work.
