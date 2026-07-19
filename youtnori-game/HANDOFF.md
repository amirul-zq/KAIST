# Handoff

Status: implementation complete through **Phase 7** (win detection + restart). Branch `yutnori-game`.

## Today's work

1. **Phase 7** — added win detection, the victory camera/light effect, a winner banner, and a persistent Restart control.
2. **gameLogic.js**: `checkWinner(gameState)` — checks whether any player has all 4 pieces `HOME`; if so sets `gameState.winner` and `gameState.turnPhase = 'GAME_OVER'` and returns true (latched: safe to call repeatedly, e.g. after every move). `resetGameState(gameState)` and `resetThrowSession(session)` reset match/session state back to a fresh game in place — same player/piece objects (so main.js's `pieceEntriesById` references stay valid), just their fields reset, per PRD.md §17 ("without requiring a page reload").
3. **main.js**: calls `checkWinner(gameState)` right after every applied move (inside `animateGroupMove`'s completion callback, before granting any catch bonus or pruning pending results — a completing move never also catches, since `applyMove` returns early on `path.completed`). On a win, `handleGameOver()` disables the throw button, clears the pending-result UI, starts the victory effect, and shows the winner banner — then the callback returns early, skipping turn settlement entirely. `canThrowNow()`/`isPieceMovableNow()`/`processThrowResult()` all now short-circuit on `gameState.turnPhase === 'GAME_OVER'`, so no further throws or moves are possible once there's a winner.
4. **Victory effect** (`startVictoryEffect`/`updateVictoryEffect` in main.js): a ~1.8s camera zoom toward the winner's finish area plus an ambient/sun light pulse (brighter + warmer at the peak, back to baseline by the end) — driven every frame from the render loop, independent of the piece-move/knockback animation systems, so it can never be blocked by or block them. Distinct from ordinary move/catch animation per PRD.md §26.
5. **Restart** (`performRestart` in main.js): resets `gameState`/`throwSession` via the new gameLogic.js functions, resets every piece mesh back to its waiting slot, resets stick pose, resets camera framing and light intensities (undoing the victory effect if one was active), hides the winner banner and restart-confirm panel, and refreshes every HUD readout — all without a page reload. A persistent Restart button (top-left, always visible per PRD.md §17) triggers this immediately when the game is fresh or already over; otherwise it shows a custom HUD confirmation panel first (`isRestartSafeWithoutConfirm()` decides which). Deliberately built as an in-HUD confirm panel rather than a native `confirm()` dialog, to stay consistent with the rest of the app's DOM-based HUD (and because native dialogs block scripted/automated interaction).
6. **ui.js**: `renderWinnerBanner`/`showWinnerBanner`/`hideWinnerBanner` (banner now does real work — was a `console.log` stub through Phase 6), `renderRestartControl`, `renderRestartConfirm`/`showRestartConfirm`/`hideRestartConfirm`, `resetHudReadouts()` (clears the throw-result/pending-results/move-outcome/piece-selection text on restart).
7. **i18n.js**: added `playAgain`, `restartConfirmMessage`, `confirmRestart`, `cancel` strings (en/ko) — `restart`/`winnerBanner` already existed from earlier phases.
8. Verified with a 27-assertion headless test script against gameLogic.js directly (win via an exact move, win via an overshoot move — both stop at home rather than wrapping, since `computeForwardSteps` already breaks the walk the instant it reaches `START_NODE_ID` regardless of remaining throw value; winner latching across repeated `checkWinner` calls; restart from a mid-game state; restart from a game-over state) and a full browser session (DEBUG_MODE panel + real mouse clicks) confirming the banner, victory camera/light effect, total input lockout post-game-over, and both restart paths (confirmed vs. skip-confirm) all work end-to-end with zero console errors.

## Completed features

- **Scene** (Phase 1), **Board** (Phase 2), **Yut sticks & throwing** (Phase 3), **Pieces** (Phase 4), **Movement** (Phase 5), **Catching & stacking** (Phase 6) — see prior handoffs (now folded into README.md's Current Progress section); unchanged this session.
- **Win detection, victory effect, and Restart** (Phase 7): see "Today's work" above.

## Current architecture

Same flat file structure as before (see README.md's "Project files" section). Notable changes this session:

- **`gameLogic.js`**: added `checkWinner`, `resetGameState`, `resetThrowSession` (see #2 above). No changes to existing exports.
- **`main.js`**: added the win-check call site inside the move-completion callback; added `victoryEffect` state + `startVictoryEffect`/`updateVictoryEffect`/`resetVictoryEffect`; added `handleGameOver`, `isRestartSafeWithoutConfirm`, `performRestart`, `handleRestartClick`; added the `GAME_OVER` guard to `canThrowNow`, `isPieceMovableNow`, and `processThrowResult`; `updateVictoryEffect(now)` added to the render loop.
- **`ui.js`**: `showWinnerBanner` rewritten from a `console.log` stub into a real render/show/hide flow with a "Play Again" button; added the Restart control and its confirmation panel; added `resetHudReadouts`.

## Remaining work

- Pre-game setup screen (nickname, language, piece-face) — `ui.js`'s `showSetupScreen` is still a placeholder stub.
- Sound effects; wiring the Korean-language toggle.
- Accessibility (keyboard operability, screen-reader support) per `PRD.md` §24.
- Bonus features (AI opponent, custom face textures).

## Important implementation decisions

- **`checkWinner` is latched, not edge-triggered**: once `gameState.winner` is set, every subsequent call returns `true` immediately without re-scanning. Safe to call unconditionally after every move (which is what main.js does) without worrying about it firing twice or needing an external "already checked" flag.
- **A completing move can never also catch or stack in the same `applyMove` call** — `applyMove` returns immediately when `path.completed` is true, before the catch/stack occupant scan runs. This is why main.js's win-check can sit *before* the catch-bonus-throw grant in the move-completion callback without needing to reconcile "did this move both win the game and earn a bonus throw" — that combination is structurally impossible.
- **"Exact landing" and "overshoot" completion share one code path**, by design carried over from Phase 5: `computeForwardSteps` stops the very instant it reaches `START_NODE_ID`, regardless of how many hops the throw value had left. There is nothing Phase-7-specific to branch on between the two cases — both just produce `outcome.completed === true`, which is all `checkWinner` (and the rest of the win/restart flow) ever looks at.
- **Restart resets objects in place rather than replacing them.** `resetGameState`/`resetThrowSession` mutate the existing `gameState`/`throwSession` objects' fields instead of building fresh ones, so main.js's `pieceEntriesById` map (keyed by piece object references established once at startup) never needs to be rebuilt or re-linked on restart — it just keeps pointing at the same (now-reset) piece objects.
- **The victory effect is visually independent of the move/knockback animation systems** (own `victoryEffect` variable, own `update*` function called separately in the render loop) rather than folded into either, since it needs to keep running (camera zoom, light pulse) after `handleGameOver` has already frozen/disabled everything else — it's the one animation still expected to be "live" while the game is otherwise fully locked.
- **Restart confirmation is a custom HUD panel, not `window.confirm()`** — deliberate, both for visual consistency with the rest of the DOM-based HUD (nothing else in the app uses a native browser dialog) and because native dialogs block further scripted interaction, which would have made this exact feature harder to test end-to-end via the DEBUG_MODE hook.

## Known bugs

None currently outstanding. This session's headless test (27 assertions) and full browser session (DEBUG_MODE panel forcing a Geol throw to complete blue's 4th piece, and a Mo throw completing red's 4th piece by 2 spaces of overshoot) found none. One thing worth flagging for whoever picks this up next: while testing through the browser automation harness specifically (not a concern for a normal user), `requestAnimationFrame`-driven animations (the throw-stick tumble, piece-move hops) can stall indefinitely if the tab is genuinely backgrounded/hidden (`document.hidden === true`) during a scripted (non-mouse) interaction — this is standard Chrome background-tab rAF throttling, not an application bug; it resolved immediately once real mouse clicks (which keep the tab foregrounded) were used instead of pure `window.__debug` JS calls.

## Next prompt to use tomorrow

```
Implement the pre-game setup screen: nickname inputs, language toggle (en/ko —
i18n.js already has both string sets), and piece-face selection, replacing
ui.js's showSetupScreen placeholder stub. On "Start Game", pass the chosen
nicknames/language/faceIds into createInitialState's options and skip main.js's
current "gameState.turnPhase = 'THROWING'" bypass line so the setup screen is
what actually kicks off the match. Make it reachable again from the Restart
flow per PRD.md's "shown once before the board loads, and reachable again from
Restart" (§19) — decide whether Restart should always return to setup or only
optionally; check with the user if unclear.

After implementation:
1. test starting a game with custom nicknames and confirm they appear in the
   turn indicator and winner banner
2. test the language toggle actually switches HUD text to Korean
3. test Restart's interaction with the setup screen
4. wait for approval
```
