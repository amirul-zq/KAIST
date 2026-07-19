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
 * @param {(ThrowResult)[]} [forfeitedResults]  results just discarded because
 *   no piece could legally use them (PRD.md §5, "the throw is forfeited")
 */
export function updateThrowResult(latestResult, session, forfeitedResults = []) {
  const bonusNote = latestResult.isBonus ? " — bonus throw! Throw again." : "";
  throwResultEl.textContent = `${formatResult(latestResult)}${bonusNote}`;
  updatePendingResultsReadout(session, forfeitedResults);
}

/**
 * Updates just the pending-moves line, without touching the "latest throw"
 * readout above it — used after a move consumes a pending result, when
 * nothing new was actually thrown.
 * @param {import('./gameLogic.js').ThrowSession} session
 * @param {(ThrowResult)[]} [forfeitedResults]
 */
export function updatePendingResultsReadout(session, forfeitedResults = []) {
  const forfeitedNote =
    forfeitedResults.length > 0
      ? ` (${forfeitedResults.map(formatResult).join(", ")} forfeited — no legal piece)`
      : "";

  pendingResultsEl.textContent =
    session.pendingResults.length > 0
      ? `Pending moves: ${session.pendingResults.map(formatResult).join(", ")}${
          session.chainActive ? "" : " — select a result below, then click a piece to move it"
        }${forfeitedNote}`
      : forfeitedNote
        ? `No pending moves.${forfeitedNote}`
        : "";
}

let pendingResultSelectorEl = null;

/** Builds the (initially empty) clickable pending-result selector. */
export function renderPendingResultSelector() {
  pendingResultSelectorEl = document.createElement("div");
  pendingResultSelectorEl.id = "pending-result-selector";
  hudEl.appendChild(pendingResultSelectorEl);
}

/**
 * Rebuilds the pending-result buttons. Only shown once the throw chain has
 * settled (PRD.md "do not allow movement until all bonus throws have been
 * completed") — pass an empty array otherwise to clear it.
 * @param {(ThrowResult)[]} pendingResults
 * @param {number|null} selectedIndex
 * @param {(index: number) => void} onSelect
 */
export function updatePendingResultSelector(pendingResults, selectedIndex, onSelect) {
  pendingResultSelectorEl.replaceChildren();
  if (pendingResults.length === 0) return;

  const label = document.createElement("div");
  label.id = "pending-result-selector-label";
  label.textContent = "Move with:";
  pendingResultSelectorEl.appendChild(label);

  pendingResults.forEach((result, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pending-result-button" + (index === selectedIndex ? " selected" : "");
    button.textContent = formatResult(result);
    button.addEventListener("click", () => onSelect(index));
    pendingResultSelectorEl.appendChild(button);
  });
}

let turnIndicatorEl = null;

/** Builds the (initially empty) turn indicator. */
export function renderTurnIndicator() {
  turnIndicatorEl = document.createElement("div");
  turnIndicatorEl.id = "turn-indicator";
  hudEl.appendChild(turnIndicatorEl);
}

/**
 * @param {{ id: 'blue'|'red', nickname: string }} player  whose turn it now is
 * @param {'en'|'ko'} [language]
 */
export function updateTurnIndicator(player, language = "en") {
  if (!turnIndicatorEl) return;
  turnIndicatorEl.textContent = t(language, "turnIndicator")(player.nickname || player.id);
  turnIndicatorEl.className = `player-${player.id}`;
}

let pieceSelectionEl = null;

/**
 * Builds the (currently read-only) piece-selection readout. Phase 4 only —
 * clicking a piece has no gameplay effect yet, this just confirms the
 * interaction is wired up correctly.
 */
export function renderPieceSelectionPanel() {
  pieceSelectionEl = document.createElement("div");
  pieceSelectionEl.id = "piece-selection-info";
  hudEl.appendChild(pieceSelectionEl);
}

/**
 * @param {import('./gameLogic.js').Piece|null} piece  the selected piece, or
 *   null to clear the readout
 * @param {number} [stackSize]  how many pieces (including this one) are
 *   currently stacked together (PRD.md §15) — 1 means not stacked
 */
export function updatePieceSelectionDisplay(piece, stackSize = 1) {
  if (!pieceSelectionEl) return;
  pieceSelectionEl.textContent = piece
    ? `Selected: ${piece.player} piece ${piece.id} — ${piece.state.toLowerCase()}${
        piece.position ? ` at ${piece.position}` : ""
      }${stackSize > 1 ? ` (stacked x${stackSize})` : ""}`
    : "";
}

let moveOutcomeEl = null;

/** Builds the (initially empty) catch/stack outcome readout. */
export function renderMoveOutcomePanel() {
  moveOutcomeEl = document.createElement("div");
  moveOutcomeEl.id = "move-outcome";
  hudEl.appendChild(moveOutcomeEl);
}

/**
 * Reports the catch/stack side-effects of the move that just resolved
 * (PRD.md §14-15), or clears the readout if the move had neither.
 * @param {{ caughtPieceIds: string[], stackedPieceIds: string[] }} outcome
 */
export function updateMoveOutcome(outcome) {
  if (!moveOutcomeEl) return;
  if (outcome.caughtPieceIds.length > 0) {
    moveOutcomeEl.textContent = `Caught ${outcome.caughtPieceIds.join(", ")} — bonus throw!`;
  } else if (outcome.stackedPieceIds.length > 0) {
    moveOutcomeEl.textContent = `Stacked: ${outcome.stackedPieceIds.join(", ")}`;
  } else {
    moveOutcomeEl.textContent = "";
  }
}

const DEBUG_FORCEABLE_TYPES = ["DO", "GAE", "GEOL", "YUT", "MO", "BACKDO"];

/**
 * DEVELOPER-ONLY test panel: one button per throw outcome, for forcing a
 * result during testing instead of waiting on randomness. main.js only
 * calls this when its DEBUG_MODE constant is true — with DEBUG_MODE false
 * (the default, required before submission) this function is never called,
 * so nothing from this panel exists in the DOM or affects normal play.
 * @param {{ onForceThrow: (type: string) => void }} handlers
 */
export function renderDebugPanel({ onForceThrow }) {
  const panel = document.createElement("div");
  panel.id = "debug-panel";

  const label = document.createElement("div");
  label.id = "debug-panel-label";
  label.textContent = "DEVELOPER TEST PANEL — force a throw result (not part of the game)";
  panel.appendChild(label);

  const buttonRow = document.createElement("div");
  buttonRow.id = "debug-panel-buttons";
  for (const type of DEBUG_FORCEABLE_TYPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "debug-force-button";
    button.textContent = throwResultLabel("en", type);
    button.addEventListener("click", () => onForceThrow(type));
    buttonRow.appendChild(button);
  }
  panel.appendChild(buttonRow);

  hudEl.appendChild(panel);
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

let winnerBannerEl = null;
let winnerBannerTextEl = null;

/**
 * Builds the (initially hidden) winner banner + "Play Again" button once.
 * The camera/lighting victory effect itself (PRD.md §26) is main.js's job
 * (Three.js); this is only the HUD half — nickname + Play Again control.
 * @param {{ onPlayAgain: () => void }} handlers
 */
export function renderWinnerBanner({ onPlayAgain }) {
  winnerBannerEl = document.createElement("div");
  winnerBannerEl.id = "winner-banner";
  winnerBannerEl.style.display = "none";

  winnerBannerTextEl = document.createElement("div");
  winnerBannerTextEl.id = "winner-banner-text";
  winnerBannerEl.appendChild(winnerBannerTextEl);

  const playAgainButton = document.createElement("button");
  playAgainButton.type = "button";
  playAgainButton.id = "play-again-button";
  playAgainButton.textContent = t("en", "playAgain");
  playAgainButton.addEventListener("click", onPlayAgain);
  winnerBannerEl.appendChild(playAgainButton);

  hudEl.appendChild(winnerBannerEl);
}

/**
 * Reveals the winner banner (PRD.md §16, §19, §26).
 * @param {string} nickname
 * @param {'en'|'ko'} language
 */
export function showWinnerBanner(nickname, language) {
  if (!winnerBannerEl) return;
  winnerBannerTextEl.textContent = t(language, "winnerBanner")(nickname);
  winnerBannerEl.querySelector("#play-again-button").textContent = t(language, "playAgain");
  winnerBannerEl.style.display = "flex";
}

export function hideWinnerBanner() {
  if (!winnerBannerEl) return;
  winnerBannerEl.style.display = "none";
}

/**
 * Persistent Restart control, visible at all times (PRD.md §17, §19) —
 * built once; main.js decides whether to restart immediately or show the
 * confirmation panel below based on whether a game is in progress.
 * @param {{ onRestartClick: () => void }} handlers
 */
export function renderRestartControl({ onRestartClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "restart-button";
  button.textContent = t("en", "restart");
  button.addEventListener("click", onRestartClick);
  hudEl.appendChild(button);
}

let restartConfirmEl = null;

/**
 * Builds the (initially hidden) restart confirmation panel — shown only
 * when Restart is clicked mid-game, to avoid an accidental reset (PRD.md
 * §17).
 * @param {{ onConfirm: () => void, onCancel: () => void }} handlers
 */
export function renderRestartConfirm({ onConfirm, onCancel }) {
  restartConfirmEl = document.createElement("div");
  restartConfirmEl.id = "restart-confirm";
  restartConfirmEl.style.display = "none";

  const message = document.createElement("div");
  message.id = "restart-confirm-message";
  message.textContent = t("en", "restartConfirmMessage");
  restartConfirmEl.appendChild(message);

  const buttonRow = document.createElement("div");
  buttonRow.id = "restart-confirm-buttons";

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.id = "restart-confirm-yes";
  confirmButton.textContent = t("en", "confirmRestart");
  confirmButton.addEventListener("click", onConfirm);
  buttonRow.appendChild(confirmButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.id = "restart-confirm-cancel";
  cancelButton.textContent = t("en", "cancel");
  cancelButton.addEventListener("click", onCancel);
  buttonRow.appendChild(cancelButton);

  restartConfirmEl.appendChild(buttonRow);
  hudEl.appendChild(restartConfirmEl);
}

export function showRestartConfirm(language = "en") {
  if (!restartConfirmEl) return;
  restartConfirmEl.querySelector("#restart-confirm-message").textContent = t(language, "restartConfirmMessage");
  restartConfirmEl.querySelector("#restart-confirm-yes").textContent = t(language, "confirmRestart");
  restartConfirmEl.querySelector("#restart-confirm-cancel").textContent = t(language, "cancel");
  restartConfirmEl.style.display = "flex";
}

export function hideRestartConfirm() {
  if (!restartConfirmEl) return;
  restartConfirmEl.style.display = "none";
}

/**
 * Clears every per-match HUD readout back to blank, for Restart — the
 * throw/pending-result/move-outcome/piece-selection text otherwise keeps
 * showing the previous match's last state until something new overwrites
 * it (PRD.md §17, "any UI/animation state" resets too).
 */
export function resetHudReadouts() {
  if (throwResultEl) throwResultEl.textContent = "";
  if (pendingResultsEl) pendingResultsEl.textContent = "";
  if (moveOutcomeEl) moveOutcomeEl.textContent = "";
  if (pieceSelectionEl) pieceSelectionEl.textContent = "";
  if (pendingResultSelectorEl) pendingResultSelectorEl.replaceChildren();
}
