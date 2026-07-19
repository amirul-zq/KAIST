# Handoff

Status: implementation complete through **Phase 6** (catching and stacking). Branch `yutnori-game`.

## Today's work

1. **Phase 6** — implemented catching (landing on an opponent sends them back to `WAITING` and grants a bonus throw) and stacking (landing on your own piece merges them into one unit that moves, is caught, and completes together from then on) in `gameLogic.js`'s `applyMove`, now catch/stack-aware and taking `allPieces` so it can see occupants at the destination.
2. **Found and fixed a real, severe pre-existing bug** while wiring the catch bonus throw: `main.js`'s `canThrowNow()` only checked `pendingResults.length === 0`, but a bonus result (Yut/Mo) sits *in* `pendingResults` the instant it's earned — so the Throw Sticks button became permanently disabled the moment a player actually rolled Yut or Mo, deadlocking the game via real UI clicks (the DEBUG_MODE introspection hook bypassed the disabled button by calling the JS function directly, which is why Phase 5's testing never caught it). Fixed to `chainActive || pendingResults.length === 0`.
3. Generalized the piece-movement animation from a single piece to a group (`animateGroupMove`), since a stack now needs every member's mesh moved in lockstep from one click.
4. Added an independent knockback animation for caught pieces flying back to their waiting slot, and `applyStackVisualOffsets()` to arrange same-node pieces in a small non-overlapping cluster after every move.
5. **Found and fixed a second bug I introduced myself** while building the above: gating the throw button on `knockbackAnimations.length > 0` is correct, but nothing re-evaluated the button once that animation finished asynchronously on its own — so the button could get stuck disabled again, right after fixing bug #2. Fixed by calling `refreshPendingResultUI()` when the knockback queue drains to empty.
6. Verified with a 95-assertion headless test script (catching for every movement value, catching via Back-Do and while entering, stacking for every movement value, catching a stack, stacking three-way, completing a stack together, bonus-throw granting) and a full browser end-to-end session via the DEBUG_MODE panel + real "Throw Sticks" clicks, confirming the button-deadlock fix specifically under real play, not just the debug hook.

## Completed features

- **Scene** (Phase 1), **Board** (Phase 2), **Yut sticks & throwing** (Phase 3), **Pieces** (Phase 4), **Movement** (Phase 5) — see prior handoffs; unchanged this session except for the two bugs above.
- **Catching & stacking** (Phase 6): landing on an opponent's piece or stack sends every piece at that node back to `WAITING` and grants one bonus throw, regardless of stack size; landing on your own piece or stack merges everyone at that node into a shared `stackId` (a deterministic sort-and-join of member piece ids — no counter, nothing to reset on restart) that then moves, is caught, and completes as one unit; visually, stacked pieces arrange in a small non-overlapping ring around their node, and caught pieces get an independent "knocked back" flight to their waiting slot.

## Current architecture

Same flat file structure as before (see prior handoffs for the full breakdown). Notable changes this session:

- **`gameLogic.js`**: `applyMove(piece, throwResult, allPieces)` now takes the full piece list (both players) so it can resolve catches/stacks at the destination; added `stackMembers(piece, allPieces)` (every piece sharing a stackId, or just `[piece]`) and `grantBonusThrow(session)` (sets `chainActive = true` — reused verbatim from the Yut/Mo bonus machinery, no separate "interrupt the queue" code path needed, since `chainActive` already blocks movement and hides the pending-result selector).
- **`main.js`**: `pieceMoveAnimation` generalized from one `pieceId` to a `members` array so a whole stack animates in lockstep from a single click; added a second, independent animation queue (`knockbackAnimations`) for caught pieces; added `applyStackVisualOffsets()` (recomputed from scratch after every move, cheap at ≤8 pieces) for the non-overlapping cluster look.
- **`ui.js`**: added `renderMoveOutcomePanel`/`updateMoveOutcome` (reports "Caught X — bonus throw!" / "Stacked: X, Y"); `updatePieceSelectionDisplay` now takes an optional stack-size argument.

## Remaining work

(Unchanged from Phase 5's handoff — nothing here was touched this session.)

- Pre-game setup screen (nickname, language, piece-face) — `ui.js`'s `showSetupScreen` is a placeholder stub.
- Win detection, victory banner/effect, and Restart.
- Sound effects; wiring the Korean-language toggle.
- Accessibility (keyboard operability, screen-reader support) per `PRD.md` §24.
- Bonus features (AI opponent, custom face textures).

## Important implementation decisions

- **A stack's id is derived, not counter-based**: `stackKey(pieceIds)` sorts the member ids and joins them (`"blue-0+blue-1"`), so merge order never matters and there's no external registry to keep in sync or reset on restart. A stack growing (a third piece joining) or being caught (cleared entirely) just computes a new key or clears the field — no incremental bookkeeping.
- **Catching and stacking share one occupant scan**: since stacked pieces always have identical `position` (they only ever move/get caught/complete together), filtering `allPieces` by raw `position === destination` already captures every member of any stack sitting there — no need to separately expand via `stackId`.
- **The catch-triggered bonus throw reuses `chainActive` verbatim**, rather than a separate "insert at front of queue" mechanism. Because `isPieceMovableNow` already refuses to let *any* piece move while `chainActive` is true, and the pending-result selector already hides itself in that state, setting `chainActive = true` on a catch automatically reproduces PRD.md §18's "resolve the bonus throw immediately, interrupting the remaining pending-move queue" — for free, with the exact same code path Yut/Mo already used.
- **Two real animation-gating bugs were found and fixed this session** (see "Today's work" #2 and #5 above) — both were "the button's `disabled` attribute is a cached DOM property, not a live-derived one, and something async finished without anyone re-deriving it." Any *future* animation state added to gate `canThrowNow()`/`isPieceMovableNow()` needs the same treatment: whatever loop drains that state to empty must itself call `refreshPendingResultUI()` when it does.
- **Visual stack offsets are recomputed from scratch after every move** (`applyStackVisualOffsets`), not tracked incrementally — simpler, and cheap enough at a maximum of 8 pieces on the board.

## Known bugs

None currently outstanding. This session found and fixed two real ones (see above); post-fix, verified via:
- 95-assertion headless test script covering catching (every throw value, Back-Do, entering, a full stack caught at once), stacking (every throw value, three-way merges, moving/completing together), and bonus-throw granting.
- Full browser session (DEBUG_MODE panel + real "Throw Sticks" button clicks) confirming the button never gets stuck disabled through a catch → bonus-throw → resolve cycle, and that knockback/stack-offset visuals render correctly.
- `DEBUG_MODE` confirmed back to `false` before this handoff; no debug panel or console errors on a clean reload.

## Next prompt to use tomorrow

```
Implement Phase 7: win detection and restart.

Requirements:
- detect when a player's 4th piece reaches HOME and declare that player the winner
- stop accepting further throws/moves once there's a winner (gameState.turnPhase = 'GAME_OVER')
- show a win banner/UI (ui.js's showWinnerBanner exists as a console.log stub — build the real UI:
  nickname + a distinct victory effect per PRD.md §26, not just the ordinary move/catch animations)
- add a "Restart" control, visible at all times, that resets piece positions, turn order (back to
  Player 1), the throw session, and all animation state — without a page reload
- keep gameLogic.js pure (no DOM/Three.js); win detection and restart's state reset belong there,
  the banner/effect/control belong in ui.js + main.js

After implementation:
1. test winning via a normal move landing exactly on home
2. test winning via an overshoot move that completes home
3. test that no further throws/moves are possible after game over
4. test Restart from both a mid-game state and a game-over state
5. wait for approval
```
