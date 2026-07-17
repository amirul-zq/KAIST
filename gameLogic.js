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

/**
 * Randomly throws the 4 yut sticks and maps the result to a ThrowType.
 * TODO: implement real stick randomization + Do/Back-do disambiguation
 * (PRD.md §5) — currently a stub.
 * @returns {ThrowResult}
 */
export function throwSticks() {
  throw new Error("throwSticks() not implemented yet");
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
