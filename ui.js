// ui.js
//
// DOM/HUD only: renders the setup screen and HUD, and reports user actions
// (button clicks, piece-face choices) back to main.js via plain callbacks.
// This module never touches Three.js and never mutates game state directly —
// it only reads state to display it, matching PRD.md §19 ("UI logic separate
// from game logic and rendering").

import { t } from "./i18n.js";

const setupScreenEl = document.getElementById("setup-screen");
const hudEl = document.getElementById("hud");

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
