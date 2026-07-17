// gameLogic.js
//
// Pure game rules and state: throws, movement, catching, stacking, turn flow, win
// detection. No DOM access and no Three.js here — this module should be testable
// headlessly (see PRD.md §27). Rendering (main.js/render code) only ever reads this
// state; it never mutates it directly.
//
// Board topology comes from boardData.js and is only ever read here, not redefined.

import { START_NODE_ID } from "./boardData.js";

/**
 * @typedef {'DO'|'GAE'|'GEOL'|'YUT'|'MO'|'BACKDO'} ThrowType
 * @typedef {Object} ThrowResult
 * @property {ThrowType} type
 * @property {number} value      spaces to move; negative for BACKDO
 * @property {boolean} isBonus   true for YUT and MO (see PRD.md §5-7)
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

function makeStartingPieces(ownerId) {
  return Array.from({ length: 4 }, (_, i) => ({
    id: `${ownerId}-${i}`,
    position: START_NODE_ID,
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
 * Applies a single pending move to a chosen piece: path resolution, catching,
 * stacking, and win/completion checks. TODO: implement (PRD.md §6, §13-16).
 * @param {object} state
 * @param {string} pieceId
 * @param {ThrowResult} throwResult
 */
export function applyMove(state, pieceId, throwResult) {
  throw new Error("applyMove() not implemented yet");
}
