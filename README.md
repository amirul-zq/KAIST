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

Status: structure and starter files only — the game itself is not implemented yet.
