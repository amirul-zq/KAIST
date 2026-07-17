// ui.js
//
// DOM/HUD only: renders the setup screen and HUD, and reports user actions
// (button clicks, piece-face choices) back to main.js via plain callbacks.
// This module never touches Three.js and never mutates game state directly —
// it only reads state to display it, matching PRD.md §19 ("UI logic separate
// from game logic and rendering").

import { t, throwResultLabel } from "./i18n.js";

const setupScreenEl = document.getElementById("setup-screen");
const hudEl = document.getElementById("hud");

let throwButtonEl = null;
let throwResultEl = null;
let pendingResultsEl = null;

/**
 * Builds the throw-stick controls (button, latest-result readout, pending
 * list) once and appends them to the HUD. Phase 3 only — not tied to the
 * full turn/player state from createInitialState yet.
 * @param {{ onThrowClick: () => void }} handlers
 */
export function renderThrowControls({ onThrowClick }) {
  const panel = document.createElement("div");
  panel.id = "throw-panel";

  throwButtonEl = document.createElement("button");
  throwButtonEl.id = "throw-button";
  throwButtonEl.type = "button";
  throwButtonEl.textContent = t("en", "throwSticks");
  throwButtonEl.addEventListener("click", onThrowClick);
  panel.appendChild(throwButtonEl);

  throwResultEl = document.createElement("div");
  throwResultEl.id = "throw-result";
  panel.appendChild(throwResultEl);

  pendingResultsEl = document.createElement("div");
  pendingResultsEl.id = "pending-results";
  panel.appendChild(pendingResultsEl);

  hudEl.appendChild(panel);
}

/** Disable the throw button while an animation is in flight, to prevent double clicks. */
export function setThrowButtonEnabled(enabled) {
  if (!throwButtonEl) return;
  throwButtonEl.disabled = !enabled;
}

function formatResult(result) {
  return `${throwResultLabel("en", result.type)} (${result.value})`;
}

/**
 * Updates the latest-result readout and the full pending-results list.
 * @param {object} latestResult  the ThrowResult just landed
 * @param {import('./gameLogic.js').ThrowSession} session
 */
export function updateThrowResult(latestResult, session) {
  const bonusNote = latestResult.isBonus ? " — bonus throw! Throw again." : "";
  throwResultEl.textContent = `${formatResult(latestResult)}${bonusNote}`;

  pendingResultsEl.textContent =
    session.pendingResults.length > 0
      ? `Pending moves: ${session.pendingResults.map(formatResult).join(", ")}${
          session.chainActive ? "" : " — all bonus throws finished, ready to move (not implemented yet)"
        }`
      : "";
}

/**
 * Renders the pre-game setup screen (nickname / language / face selection).
 * TODO: build the actual form; currently a placeholder shell.
 * @param {{ language: 'en'|'ko' }} settings
 * @param {(setupResult: object) => void} onStart  called with chosen options
 */
export function showSetupScreen(settings, onStart) {
  setupScreenEl.style.display = "flex";
  setupScreenEl.textContent = t(settings.language, "setupTitle");
  // TODO: nickname inputs, language toggle, face gallery, "Start Game" button
  // wired to call onStart({ nicknames, language, faceIds }).
}

export function hideSetupScreen() {
  setupScreenEl.style.display = "none";
}

/**
 * Renders/updates the HUD (turn indicator, throw button, restart, mute).
 * TODO: build real DOM structure; currently a placeholder shell.
 * @param {object} state  read-only game state from gameLogic.js
 * @param {{ onThrow: () => void, onRestart: () => void }} handlers
 */
export function renderHud(state, handlers) {
  const { language } = state.settings;
  const currentPlayer = state.players[state.currentPlayerIndex];
  hudEl.textContent = t(language, "turnIndicator")(currentPlayer.nickname);
  // TODO: throw button (disabled outside 'THROWING' phase), restart control,
  // mute toggle, pending-throws counter — wire to handlers.onThrow / onRestart.
}

/**
 * Shows the winner banner + victory effect trigger point (PRD.md §26).
 * @param {string} nickname
 * @param {'en'|'ko'} language
 */
export function showWinnerBanner(nickname, language) {
  // TODO: banner UI + "Play Again" button.
  console.log(t(language, "winnerBanner")(nickname));
}
