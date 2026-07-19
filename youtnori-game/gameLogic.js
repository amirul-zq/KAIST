// gameLogic.js
//
// Pure game rules and state: throws, movement, catching, stacking, turn flow, win
// detection. No DOM access and no Three.js here — this module should be testable
// headlessly (see PRD.md §27). Rendering (main.js/render code) only ever reads this
// state; it never mutates it directly.
//
// Board topology comes from boardData.js and is only ever read here, not redefined.

import { START_NODE_ID, PLAIN_RING_NEXT, CORNER_SHORTCUT_ENTRY, DIAGONAL_FORWARD } from "./boardData.js";

/**
 * @typedef {'DO'|'GAE'|'GEOL'|'YUT'|'MO'|'BACKDO'} ThrowType
 * @typedef {Object} ThrowResult
 * @property {ThrowType} type
 * @property {number} value      spaces to move; negative for BACKDO
 * @property {boolean} isBonus   true for YUT and MO (see PRD.md §5-7)
 */

/** @typedef {'WAITING'|'ACTIVE'|'HOME'} PieceState */
export const PieceState = Object.freeze({
  WAITING: "WAITING", // begins outside the board (Phase 4) — not yet thrown into play
  ACTIVE: "ACTIVE", // on a board node
  HOME: "HOME", // completed its lap
});

/**
 * @typedef {Object} Piece
 * @property {string} id
 * @property {'blue'|'red'} player
 * @property {PieceState} state
 * @property {string|null} route     which path branch this piece is following
 *   once on board (e.g. a specific diagonal shortcut) — unset until movement
 *   is implemented; exists now so the field never has to be bolted on later
 * @property {string|null} position  board node id while ACTIVE; null while
 *   WAITING or HOME
 * @property {boolean} completed     true once state is HOME
 * @property {string|null} stackId   shared id with any pieces it's stacked
 *   with (PRD.md §15) — a deterministic function of the member piece ids
 *   (see stackKey below), so it never needs a counter or external registry.
 *   null while WAITING, HOME, or ACTIVE-but-alone.
 */

/**
 * Builds a fresh game state for a new match.
 * See PRD.md §22 for the full state shape this is expected to grow into.
 *
 * @param {{ nicknames?: [string, string], language?: 'en'|'ko' }} [options]
 */
export function createInitialState(options = {}) {
  const [nicknameBlue = "Blue", nicknameRed = "Red"] = options.nicknames ?? [];

  return {
    settings: {
      language: options.language ?? "en",
      aiEnabled: false,
    },
    players: [
      { id: "blue", nickname: nicknameBlue, faceId: null, isAI: false, pieces: makeStartingPieces("blue") },
      { id: "red", nickname: nicknameRed, faceId: null, isAI: false, pieces: makeStartingPieces("red") },
    ],
    currentPlayerIndex: 0,
    turnPhase: "SETUP", // 'SETUP' | 'THROWING' | 'APPLYING_MOVES' | 'GAME_OVER'
    throwQueue: [],
    pendingMoves: [],
    winner: null,
    log: [],
  };
}

/** @returns {Piece[]} */
function makeStartingPieces(ownerId) {
  return Array.from({ length: 4 }, (_, i) => ({
    id: `${ownerId}-${i}`,
    player: ownerId,
    state: PieceState.WAITING,
    route: null,
    position: null,
    completed: false,
    stackId: null,
  }));
}

// Index (0-3) of the one stick that carries the Back-Do mark. Shared with
// main.js so the visual "marked" stick and the rule-determining "marked"
// stick can never drift apart — see PRD.md §5's Do-vs-Back-Do note.
export const BACK_DO_STICK_INDEX = 3;

/**
 * The single place that turns 4 stick sides into a ThrowResult. Every throw
 * — real (throwSticks) or forced by the developer test panel
 * (forceThrowResult) — passes through this exact function, so the debug
 * panel can never compute a result by different rules than a real throw.
 * @param {boolean[]} stickStates  stickStates[i] is true when stick i is flat-up
 * @returns {ThrowResult & { stickStates: boolean[] }}
 */
function computeThrowResult(stickStates) {
  const flatCount = stickStates.filter(Boolean).length;

  let type;
  let value;
  let isBonus;

  if (flatCount === 0) {
    type = "MO";
    value = 5;
    isBonus = true;
  } else if (flatCount === 4) {
    type = "YUT";
    value = 4;
    isBonus = true;
  } else if (flatCount === 1) {
    const isMarkedStickFlat = stickStates[BACK_DO_STICK_INDEX];
    type = isMarkedStickFlat ? "BACKDO" : "DO";
    value = isMarkedStickFlat ? -1 : 1;
    isBonus = false;
  } else if (flatCount === 2) {
    type = "GAE";
    value = 2;
    isBonus = false;
  } else {
    type = "GEOL";
    value = 3;
    isBonus = false;
  }

  return { type, value, isBonus, stickStates };
}

/**
 * Randomly throws the 4 yut sticks. Each stick independently lands flat-up
 * or round-up; the *count* of flat-up sticks gives Do/Gae/Geol/Yut/Mo,
 * except when exactly one stick is flat: then it's Do unless that one flat
 * stick is specifically the marked (Back-Do) stick, in which case it's
 * Back-Do instead (PRD.md §5) — see computeThrowResult above.
 * @returns {ThrowResult & { stickStates: boolean[] }} stickStates[i] is true
 *   when stick i landed flat-up — the renderer uses this to show the exact
 *   sides that produced the result, never an independent random animation.
 */
export function throwSticks() {
  const stickStates = Array.from({ length: 4 }, () => Math.random() < 0.5);
  return computeThrowResult(stickStates);
}

/**
 * DEVELOPER-ONLY: picks a plausible set of stick sides for a given forced
 * outcome, then runs it through the exact same computeThrowResult used by
 * throwSticks(). Only ever called from the debug test panel (main.js,
 * gated behind DEBUG_MODE) — never part of normal play.
 * @param {ThrowType} type
 * @returns {ThrowResult & { stickStates: boolean[] }}
 */
export function forceThrowResult(type) {
  const states = [false, false, false, false];
  switch (type) {
    case "MO":
      break; // all round-up already
    case "YUT":
      states.fill(true);
      break;
    case "BACKDO":
      states[BACK_DO_STICK_INDEX] = true;
      break;
    case "DO":
      states[(BACK_DO_STICK_INDEX + 1) % 4] = true; // any non-marked stick
      break;
    case "GAE":
      states[0] = true;
      states[1] = true;
      break;
    case "GEOL":
      states[0] = true;
      states[1] = true;
      states[2] = true;
      break;
    default:
      throw new Error(`Cannot force unknown throw type: ${type}`);
  }
  return computeThrowResult(states);
}

/**
 * @typedef {Object} ThrowSession
 * @property {(ThrowResult & { stickStates: boolean[] })[]} pendingResults  results
 *   accumulated so far this turn, in the order they were earned
 * @property {boolean} chainActive  true while another throw is still owed
 *   (i.e. the most recent throw was a bonus) — piece movement must wait
 *   until this is false (PRD.md §8, "complete all bonus throws before movement")
 */

/** @returns {ThrowSession} */
export function createThrowSession() {
  return { pendingResults: [], chainActive: false };
}

/**
 * Records a throw into the session, enforcing the bonus-chain rule: if the
 * previous chain had already finished (chainActive was false), this throw
 * starts a fresh pending list rather than appending to a stale one.
 * @param {ThrowSession} session
 * @param {ThrowResult & { stickStates: boolean[] }} result
 * @returns {ThrowSession} the same session, mutated in place
 */
export function recordThrow(session, result) {
  if (!session.chainActive) {
    session.pendingResults = [];
  }
  session.pendingResults.push(result);
  session.chainActive = result.isBonus;
  return session;
}

/**
 * Marks a bonus throw as owed without it coming from a throw result itself
 * — the one other source of a bonus besides Yut/Mo: catching an opponent's
 * piece (PRD.md §7, §14). Reuses the exact same `chainActive` flag Yut/Mo
 * bonuses set, so the existing "don't switch turns / keep the throw button
 * live / hide the pending-result selector" machinery (isSessionSettled,
 * recordThrow) handles a catch-triggered throw identically to any other
 * bonus, with no separate "interrupt the queue" code path needed: while
 * chainActive is true, moving any piece is already blocked (see main.js's
 * isPieceMovableNow), which is exactly PRD.md §18's "resolve the bonus
 * throw immediately before resuming the rest of the pending-move queue".
 * @param {ThrowSession} session
 */
export function grantBonusThrow(session) {
  session.chainActive = true;
}

/**
 * True while switching turns must wait: whenever more bonus throws are
 * owed, or results are still sitting in the pending list unapplied
 * (PRD.md §8, §18 — "do not switch turns while pending results remain" /
 * "do not allow movement until all bonus throws have been completed").
 * @param {ThrowSession} session
 */
export function isSessionSettled(session) {
  return !session.chainActive && session.pendingResults.length === 0;
}

/**
 * Whether `throwResult` could legally be applied to `piece` right now —
 * independent of whose turn it is or which result is currently selected;
 * callers combine this with that context. A HOME piece can never move
 * again; a WAITING piece can only enter (positive value); Back-Do (negative
 * value) needs an ACTIVE piece that has somewhere to retreat to (§16).
 * @param {Piece} piece
 * @param {ThrowResult} throwResult
 */
export function isMoveLegal(piece, throwResult) {
  if (piece.state === PieceState.HOME) return false;
  if (throwResult.value < 0) {
    return piece.state === PieceState.ACTIVE && piece.route != null;
  }
  return piece.state === PieceState.WAITING || piece.state === PieceState.ACTIVE;
}

/**
 * One forward hop from `current`. Diagonal nodes (already on a shortcut)
 * always continue along it — there is no outer-ring alternative for them.
 * A corner (O5/O10/O15) only diverts onto its shortcut if the piece is
 * *resting* there at the start of this move (`isRestingStart` — i.e. this
 * is hop 0 of a fresh move, not a corner merely passed through mid-move);
 * otherwise every node just follows the outer ring's one fixed direction.
 * This is what makes "shortcut activates only when landing exactly on the
 * entry point" true, rather than triggering on any pass-through.
 * @param {string} current
 * @param {boolean} isRestingStart
 */
function stepOnePlace(current, isRestingStart) {
  if (DIAGONAL_FORWARD.has(current)) return DIAGONAL_FORWARD.get(current);
  if (isRestingStart && CORNER_SHORTCUT_ENTRY.has(current)) return CORNER_SHORTCUT_ENTRY.get(current);
  return PLAIN_RING_NEXT.get(current);
}

/**
 * Walks `value` visible hops forward from `startPosition`, stopping early
 * (without using the remaining hops) the moment home is reached — an
 * overshoot completes the piece rather than wrapping around.
 * @param {string} startPosition
 * @param {number} value
 * @returns {{ steps: string[], completed: boolean }}
 */
function computeForwardSteps(startPosition, value) {
  const steps = [];
  let current = startPosition;
  for (let i = 0; i < value; i++) {
    current = stepOnePlace(current, i === 0);
    steps.push(current);
    if (current === START_NODE_ID) return { steps, completed: true };
  }
  return { steps, completed: false };
}

/**
 * Computes the ordered board nodes a piece would visit for a move, without
 * mutating anything — the single source both applyMove (real mutation) and
 * any "preview" rendering use, so they can never disagree.
 * @param {Piece} piece
 * @param {number} value  positive spaces forward, or negative for Back-Do
 * @returns {{ steps: string[], completed: boolean, exitsToWaiting: boolean, cameFrom: string|null } | null}
 *   null means isMoveLegal would also be false for this pairing
 */
function computeMovePath(piece, value) {
  if (value > 0) {
    if (piece.state === PieceState.WAITING) {
      // Entering starts from START_NODE_ID; it can never be a "resting
      // corner start" (only O5/O10/O15 are shortcut corners), so this
      // always walks the plain outer path — a positive throw of N lands
      // on node ON, same rule as any other forward move. cameFrom is the
      // node just before the final rest (e.g. entering with Geol(3) visits
      // O1,O2,O3 and rests at O3, so a later Back-Do retraces to O2 — NOT
      // unconditionally back to START_NODE_ID, which would only be correct
      // when the whole move was exactly 1 hop.
      const { steps, completed } = computeForwardSteps(START_NODE_ID, value);
      const cameFrom = steps.length >= 2 ? steps[steps.length - 2] : START_NODE_ID;
      return { steps, completed, exitsToWaiting: false, cameFrom };
    }
    if (piece.state === PieceState.ACTIVE) {
      const { steps, completed } = computeForwardSteps(piece.position, value);
      const cameFrom = steps.length >= 2 ? steps[steps.length - 2] : piece.position;
      return { steps, completed, exitsToWaiting: false, cameFrom };
    }
    return null;
  }

  // Back-Do: retrace exactly the one step this piece is recorded as having
  // come from (piece.route). We don't keep deeper history than that, so a
  // second consecutive Back-Do on the same piece (with no forward move in
  // between) has nothing further to retreat to — see applyMove below.
  if (piece.state !== PieceState.ACTIVE || piece.route == null) return null;
  if (piece.route === START_NODE_ID) {
    return { steps: [], completed: false, exitsToWaiting: true, cameFrom: null };
  }
  return { steps: [piece.route], completed: false, exitsToWaiting: false, cameFrom: null };
}

/**
 * Every piece currently sharing `piece`'s stackId, including itself — or
 * just `[piece]` if it isn't stacked. Stacked pieces always have identical
 * state/position/route (they only ever move, get caught, or complete
 * together, PRD.md §15), so any one member is a valid representative for
 * path resolution; this is what lets a single click move the whole stack.
 * @param {Piece} piece
 * @param {Piece[]} allPieces  every piece in the game (both players)
 * @returns {Piece[]}
 */
export function stackMembers(piece, allPieces) {
  if (!piece.stackId) return [piece];
  return allPieces.filter((p) => p.stackId === piece.stackId);
}

/**
 * Deterministic stack id from its member piece ids — sorted so merge order
 * never matters (a stack formed A-then-B has the same id as B-then-A), and
 * derived rather than counter-based so no extra state needs to be threaded
 * through or reset on restart.
 * @param {string[]} pieceIds
 */
function stackKey(pieceIds) {
  return [...pieceIds].sort().join("+");
}

/**
 * Applies a single pending move to a chosen piece (or its whole stack, if
 * it's part of one): path resolution, catching, stacking, and completion,
 * mutating every affected piece in place (PRD.md §6, §13, §14, §15, §16).
 * The renderer uses the returned `steps` to animate one visible hop at a
 * time, and `caughtPieceIds`/`stackedPieceIds` to animate the knock-back and
 * visually cluster the merged stack.
 * @param {Piece} piece  the clicked piece; if stacked, its whole group moves
 * @param {ThrowResult} throwResult
 * @param {Piece[]} allPieces  every piece in the game (both players) —
 *   needed to find the mover's stack-mates and any pieces waiting at the
 *   destination to catch or merge with
 * @returns {{ ok: boolean, steps: string[], completed: boolean,
 *   exitsToWaiting: boolean, caughtPieceIds: string[], stackedPieceIds: string[] }}
 *   `caughtPieceIds` — opponent piece ids sent back to WAITING (PRD.md §14);
 *   a non-empty list means the mover has earned a bonus throw.
 *   `stackedPieceIds` — every piece id (mover's group + whoever it merged
 *   with) now sharing the resulting stackId; empty unless a merge happened.
 */
export function applyMove(piece, throwResult, allPieces) {
  const path = computeMovePath(piece, throwResult.value);
  if (!path) {
    return { ok: false, steps: [], completed: false, exitsToWaiting: false, caughtPieceIds: [], stackedPieceIds: [] };
  }

  const group = stackMembers(piece, allPieces);

  if (path.exitsToWaiting) {
    for (const member of group) {
      member.state = PieceState.WAITING;
      member.position = null;
      member.route = null;
      member.stackId = null;
    }
    return { ok: true, steps: [], completed: false, exitsToWaiting: true, caughtPieceIds: [], stackedPieceIds: [] };
  }

  if (path.completed) {
    for (const member of group) {
      member.state = PieceState.HOME;
      member.position = null;
      member.completed = true;
      member.route = null;
      member.stackId = null;
    }
    return { ok: true, steps: path.steps, completed: true, exitsToWaiting: false, caughtPieceIds: [], stackedPieceIds: [] };
  }

  const destination = path.steps[path.steps.length - 1];
  for (const member of group) {
    member.state = PieceState.ACTIVE;
    member.position = destination;
    member.route = path.cameFrom;
  }

  // Stack members always share one position, so filtering by raw position
  // (rather than expanding via stackId) already captures every occupant of
  // an opposing or own stack at the destination, not just a lone piece.
  const occupants = allPieces.filter(
    (p) => !group.includes(p) && p.state === PieceState.ACTIVE && p.position === destination
  );

  const caughtPieceIds = [];
  for (const opponent of occupants.filter((p) => p.player !== piece.player)) {
    opponent.state = PieceState.WAITING;
    opponent.position = null;
    opponent.route = null;
    opponent.stackId = null;
    caughtPieceIds.push(opponent.id);
  }

  let stackedPieceIds = [];
  const ownOccupants = occupants.filter((p) => p.player === piece.player);
  if (ownOccupants.length > 0) {
    const mergedGroup = [...group, ...ownOccupants];
    const id = stackKey(mergedGroup.map((p) => p.id));
    for (const member of mergedGroup) member.stackId = id;
    stackedPieceIds = mergedGroup.map((p) => p.id);
  }

  return { ok: true, steps: path.steps, completed: false, exitsToWaiting: false, caughtPieceIds, stackedPieceIds };
}

/**
 * Removes any pending results that no piece in `pieces` could legally use
 * (e.g. a Back-Do drawn when every piece is WAITING or HOME) — the "throw
 * is forfeited" rule (PRD.md §5). Call after every throw and after every
 * applied move, since a move can make an *other* pending result newly
 * unusable (e.g. its only eligible piece just finished or left the board).
 * @param {ThrowSession} session
 * @param {Piece[]} pieces  the current player's pieces
 * @returns {(ThrowResult & { stickStates: boolean[] })[]} the results that were discarded
 */
export function pruneUnusableResults(session, pieces) {
  const kept = [];
  const discarded = [];
  for (const result of session.pendingResults) {
    (pieces.some((piece) => isMoveLegal(piece, result)) ? kept : discarded).push(result);
  }
  session.pendingResults = kept;
  return discarded;
}

/**
 * Advances to the other player once the session is fully settled (PRD.md
 * §18). Safe to call at any time — it only switches when appropriate.
 * @param {object} gameState
 * @param {ThrowSession} session
 * @returns {boolean} whether it actually switched
 */
export function maybeSwitchTurn(gameState, session) {
  if (!isSessionSettled(session)) return false;
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  return true;
}

/** @returns {object} the player object whose turn it currently is */
export function currentPlayer(gameState) {
  return gameState.players[gameState.currentPlayerIndex];
}
