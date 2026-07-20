// ui.js
//
// DOM/HUD only: renders the top bar, bottom panel, and settings modal, and
// reports user actions (button clicks, input changes) back to main.js via
// plain callbacks. This module never touches Three.js and never mutates game
// state directly — it only reads state to display it, matching PRD.md §19
// ("UI logic separate from game logic and rendering").
//
// Layout (see PRD.md's reference-game brief):
//   #top-bar    — title, per-team status, sound/language/settings/new-game
//   #bottom-panel — current player, current action, throw button, pending
//                   results, selected piece, instructions
//   #settings-modal — nicknames, game mode, sound, language, piece face

import { t, throwResultLabel } from "./i18n.js";

const setupScreenEl = document.getElementById("setup-screen");
const hudEl = document.getElementById("hud");

// A small set of built-in "face" choices for pieces (no external art assets
// exist yet — see pieces/README.md — so each face is drawn as an emoji onto
// a canvas texture by main.js). Exported so main.js can build one texture
// per id without a second copy of this list drifting out of sync.
export const FACE_OPTIONS = [
  { id: "face-1", emoji: "😀" },
  { id: "face-2", emoji: "😎" },
  { id: "face-3", emoji: "🦁" },
  { id: "face-4", emoji: "🐯" },
  { id: "face-5", emoji: "🐰" },
  { id: "face-6", emoji: "🦊" },
];

// The real default face art (pieces/player1.png for Blue, pieces/player2.png
// for Red) — this is what a fresh player.faceId ("default", set by
// gameLogic.js's createInitialState) resolves to. Kept alongside FACE_OPTIONS
// as the one place both main.js's 3D texture and this file's own top-bar
// avatar look up "what does this team's current face actually look like".
export const DEFAULT_FACE_ID = "default";
export const DEFAULT_FACE_IMAGE_PATHS = { blue: "pieces/player1.png", red: "pieces/player2.png" };
const TEAM_COLOR_HEX = { blue: "#2b5fd6", red: "#d6392b" };

function allFaceIdsFor() {
  return [DEFAULT_FACE_ID, ...FACE_OPTIONS.map((option) => option.id)];
}

/**
 * Composites playerId's current face — the default team photo, or a chosen
 * FACE_OPTIONS emoji — onto `canvas` (its existing width/height are used):
 * circularly cropped, "cover"-fit so photos are never stretched, ringed in
 * the team's color (blue/red identity stays visible even though the photos
 * themselves aren't team-colored), with a plain team-colored disc as the
 * fallback if the photo fails to load. Shared by main.js's 3D piece texture
 * and this file's own top-bar/settings-modal avatars so every surface draws
 * a face identically.
 * @param {HTMLCanvasElement} canvas
 * @param {'blue'|'red'} playerId
 * @param {string} faceId
 * @param {() => void} [onDone]  called once painting finishes — synchronously
 *   for an emoji face, asynchronously for the default photo (image load)
 */
export function drawFaceOnCanvas(canvas, playerId, faceId, onDone) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const teamColor = TEAM_COLOR_HEX[playerId] ?? TEAM_COLOR_HEX.blue;
  const ringWidth = Math.max(2, size * 0.07);

  function paintClippedBase(fillStyle) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ringWidth, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, size, size);
  }

  function paintRing() {
    ctx.restore(); // undo the clip from paintClippedBase
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - ringWidth / 2, 0, Math.PI * 2);
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = teamColor;
    ctx.stroke();
  }

  if (faceId === DEFAULT_FACE_ID) {
    const img = new Image();
    img.onload = () => {
      paintClippedBase("#f1e6c8");
      // "cover" fit, centered — crops to a square without stretching the
      // source photo, whatever its own aspect ratio.
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
      paintRing();
      onDone?.();
    };
    img.onerror = () => {
      // Fallback colored token — the photo asset is missing/failed to load.
      paintClippedBase(teamColor);
      paintRing();
      onDone?.();
    };
    img.src = DEFAULT_FACE_IMAGE_PATHS[playerId];
  } else {
    const option = FACE_OPTIONS.find((f) => f.id === faceId);
    paintClippedBase("#f1e6c8");
    ctx.font = `${Math.round(size * 0.6)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(option ? option.emoji : "", size / 2, size / 2 + size * 0.04);
    paintRing();
    onDone?.();
  }
}

/**
 * @param {string[]} classes
 * @param {Record<string, string>} [attrs]
 */
function el(tag, classes = [], attrs = {}) {
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(" ");
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

// ==========================================================================
// Top bar
// ==========================================================================

let topBarEl = null;
let titleEl = null;
let teamStatusEls = { blue: null, red: null };
let teamAvatarEls = { blue: null, red: null };
let lastPaintedFaceId = { blue: null, red: null }; // avoids re-compositing the avatar canvas on every refreshHud() call
let soundToggleEl = null;
let languageToggleEl = null;
let settingsButtonEl = null;
let newGameTopButtonEl = null;

/**
 * Builds the top bar once: title, both teams' status, and the
 * sound/language/settings/new-game controls.
 * @param {{ onSoundToggle: () => void, onLanguageToggle: () => void, onSettingsClick: () => void, onNewGameClick: () => void }} handlers
 */
export function renderTopBar({ onSoundToggle, onLanguageToggle, onSettingsClick, onNewGameClick }) {
  topBarEl = el("div", [], { id: "top-bar" });

  titleEl = el("div", [], { id: "game-title" });
  topBarEl.appendChild(titleEl);

  const teamsWrap = el("div", [], { id: "top-bar-teams" });
  for (const playerId of ["blue", "red"]) {
    const status = el("div", ["team-status", `player-${playerId}`], { id: `team-status-${playerId}` });
    const avatar = el("canvas", ["team-status-avatar"], { width: "64", height: "64" });
    const text = el("div", ["team-status-text"]);
    const name = el("div", ["team-status-name"], { id: `team-status-name-${playerId}` });
    const summary = el("div", ["team-status-summary"], { id: `team-status-summary-${playerId}` });
    text.append(name, summary);
    status.append(avatar, text);
    teamsWrap.appendChild(status);
    teamStatusEls[playerId] = status;
    teamAvatarEls[playerId] = avatar;
  }
  topBarEl.appendChild(teamsWrap);

  const controls = el("div", [], { id: "top-bar-controls" });

  soundToggleEl = el("button", ["icon-button"], { id: "sound-toggle-button", type: "button" });
  soundToggleEl.addEventListener("click", onSoundToggle);
  controls.appendChild(soundToggleEl);

  languageToggleEl = el("button", ["icon-button"], { id: "language-toggle-button", type: "button" });
  languageToggleEl.addEventListener("click", onLanguageToggle);
  controls.appendChild(languageToggleEl);

  settingsButtonEl = el("button", ["icon-button"], { id: "settings-button", type: "button" });
  settingsButtonEl.textContent = "⚙";
  settingsButtonEl.addEventListener("click", onSettingsClick);
  controls.appendChild(settingsButtonEl);

  newGameTopButtonEl = el("button", ["text-button"], { id: "new-game-top-button", type: "button" });
  newGameTopButtonEl.addEventListener("click", onNewGameClick);
  controls.appendChild(newGameTopButtonEl);

  topBarEl.appendChild(controls);
  hudEl.appendChild(topBarEl);
}

/**
 * Refreshes every top-bar label for the given language/sound state — called
 * once at startup and again whenever the language or sound toggle changes.
 * @param {'en'|'ko'} language
 * @param {boolean} soundEnabled
 */
export function updateTopBarStaticText(language, soundEnabled) {
  if (!topBarEl) return;
  titleEl.textContent = t(language, "gameTitle");
  teamStatusEls.blue.querySelector(".team-status-name").textContent = t(language, "blueTeamLabel");
  teamStatusEls.red.querySelector(".team-status-name").textContent = t(language, "redTeamLabel");

  soundToggleEl.textContent = soundEnabled ? "🔊" : "🔇";
  soundToggleEl.setAttribute("aria-label", t(language, soundEnabled ? "soundOnAriaLabel" : "soundOffAriaLabel"));
  soundToggleEl.setAttribute("aria-pressed", String(!soundEnabled));

  languageToggleEl.textContent = language === "en" ? "한국어" : "English";
  languageToggleEl.setAttribute("aria-label", t(language, "languageToggleAriaLabel"));

  settingsButtonEl.setAttribute("aria-label", t(language, "settingsAriaLabel"));

  newGameTopButtonEl.textContent = t(language, "newGame");
  newGameTopButtonEl.setAttribute("aria-label", t(language, "newGameAriaLabel"));
}

/**
 * Updates one team's status block: avatar, nickname + waiting/in-play/home
 * counts, and whether it's currently that team's turn (for the highlight
 * style).
 * @param {'blue'|'red'} playerId
 * @param {{ nickname: string, faceId: string, waiting: number, active: number, home: number }} summary
 * @param {'en'|'ko'} language
 * @param {boolean} isCurrentTurn
 */
export function updateTeamStatus(playerId, summary, language, isCurrentTurn) {
  const statusEl = teamStatusEls[playerId];
  if (!statusEl) return;
  statusEl.querySelector(".team-status-name").textContent = summary.nickname;
  statusEl.querySelector(".team-status-summary").textContent = t(language, "teamStatusSummary")(
    summary.waiting,
    summary.active,
    summary.home
  );
  statusEl.classList.toggle("current-turn", isCurrentTurn);

  if (lastPaintedFaceId[playerId] !== summary.faceId) {
    lastPaintedFaceId[playerId] = summary.faceId;
    drawFaceOnCanvas(teamAvatarEls[playerId], playerId, summary.faceId);
  }
}

// ==========================================================================
// Bottom panel
// ==========================================================================

let bottomPanelEl = null;
let currentPlayerEl = null;
let currentActionEl = null;
let moveOutcomeEl = null;
let throwButtonEl = null;
let throwResultEl = null;
let pendingResultsSummaryEl = null;
let pendingResultSelectorEl = null;
let pieceSelectionEl = null;
let instructionsEl = null;

/**
 * Builds the whole bottom panel once, in display order: current player,
 * current action, move outcome (transient), throw controls, pending-result
 * selector, selected-piece readout, instructions.
 * @param {{ onThrowClick: () => void }} handlers
 */
export function renderBottomPanel({ onThrowClick }) {
  bottomPanelEl = el("div", [], { id: "bottom-panel" });

  currentPlayerEl = el("div", [], { id: "current-player" });
  bottomPanelEl.appendChild(currentPlayerEl);

  currentActionEl = el("div", [], { id: "current-action" });
  bottomPanelEl.appendChild(currentActionEl);

  moveOutcomeEl = el("div", [], { id: "move-outcome" });
  bottomPanelEl.appendChild(moveOutcomeEl);

  const throwRow = el("div", [], { id: "throw-row" });
  throwButtonEl = el("button", [], { id: "throw-button", type: "button" });
  throwButtonEl.addEventListener("click", onThrowClick);
  throwRow.appendChild(throwButtonEl);
  throwResultEl = el("div", [], { id: "throw-result" });
  throwRow.appendChild(throwResultEl);
  bottomPanelEl.appendChild(throwRow);

  pendingResultsSummaryEl = el("div", [], { id: "pending-results-summary" });
  bottomPanelEl.appendChild(pendingResultsSummaryEl);

  pendingResultSelectorEl = el("div", [], { id: "pending-result-selector" });
  bottomPanelEl.appendChild(pendingResultSelectorEl);

  pieceSelectionEl = el("div", [], { id: "piece-selection-info" });
  bottomPanelEl.appendChild(pieceSelectionEl);

  instructionsEl = el("div", [], { id: "instructions-line" });
  bottomPanelEl.appendChild(instructionsEl);

  hudEl.appendChild(bottomPanelEl);
}

/** Disable the throw button while an animation is in flight, to prevent double clicks. */
export function setThrowButtonEnabled(enabled) {
  if (!throwButtonEl) return;
  throwButtonEl.disabled = !enabled;
}

function formatResult(language, result) {
  return `${throwResultLabel(language, result.type)} (${result.value})`;
}

/** @param {'en'|'ko'} language */
export function updateThrowButtonLabel(language) {
  if (!throwButtonEl) return;
  throwButtonEl.textContent = t(language, "throwSticks");
}

/**
 * Sets the freeform "what to do right now" line (throw / select a result /
 * pick a piece / bonus throw / game over) — main.js computes the exact text
 * from its own turn-phase/session state since ui.js never reads gameState.
 */
export function setCurrentActionText(text) {
  if (currentActionEl) currentActionEl.textContent = text;
}

/** @param {{ nickname: string, id: 'blue'|'red' }} player */
export function updateCurrentPlayer(player, language) {
  if (!currentPlayerEl) return;
  currentPlayerEl.textContent = t(language, "currentPlayerLabel")(player.nickname || player.id);
  currentPlayerEl.className = `player-${player.id}`;
}

/**
 * Updates the latest-result readout and the full pending-results summary line.
 * @param {object} latestResult  the ThrowResult just landed
 * @param {import('./gameLogic.js').ThrowSession} session
 * @param {'en'|'ko'} language
 * @param {(ThrowResult)[]} [forfeitedResults]  results just discarded because
 *   no piece could legally use them (PRD.md §5, "the throw is forfeited")
 */
export function updateThrowResult(latestResult, session, language, forfeitedResults = []) {
  const bonusNote = latestResult.isBonus ? ` — ${t(language, "actionThrowBonus")}` : "";
  throwResultEl.textContent = `${formatResult(language, latestResult)}${bonusNote}`;
  updatePendingResultsReadout(session, language, forfeitedResults);
}

/**
 * Updates just the pending-moves summary line, without touching the "latest
 * throw" readout — used after a move consumes a pending result, when
 * nothing new was actually thrown.
 * @param {import('./gameLogic.js').ThrowSession} session
 * @param {'en'|'ko'} language
 * @param {(ThrowResult)[]} [forfeitedResults]
 */
export function updatePendingResultsReadout(session, language, forfeitedResults = []) {
  const forfeitedNote =
    forfeitedResults.length > 0
      ? ` ${t(language, "forfeitedNote")(forfeitedResults.map((r) => formatResult(language, r)).join(", "))}`
      : "";

  pendingResultsSummaryEl.textContent =
    session.pendingResults.length > 0
      ? `${t(language, "pendingResultsLabel")}: ${session.pendingResults
          .map((r) => formatResult(language, r))
          .join(", ")}${forfeitedNote}`
      : `${forfeitedNote || t(language, "noPendingResults")}`;
}

/**
 * Rebuilds the pending-result buttons. Only shown once the throw chain has
 * settled (PRD.md "do not allow movement until all bonus throws have been
 * completed") — pass an empty array otherwise to clear it.
 * @param {(ThrowResult)[]} pendingResults
 * @param {number|null} selectedIndex
 * @param {'en'|'ko'} language
 * @param {(index: number) => void} onSelect
 */
export function updatePendingResultSelector(pendingResults, selectedIndex, language, onSelect) {
  pendingResultSelectorEl.replaceChildren();
  if (pendingResults.length === 0) return;

  const label = el("div", [], { id: "pending-result-selector-label" });
  label.textContent = t(language, "moveWithLabel");
  pendingResultSelectorEl.appendChild(label);

  const buttonRow = el("div", [], { id: "pending-result-selector-buttons" });
  pendingResults.forEach((result, index) => {
    const button = el("button", ["pending-result-button"], { type: "button" });
    if (index === selectedIndex) button.classList.add("selected");
    button.textContent = formatResult(language, result);
    button.setAttribute("aria-pressed", String(index === selectedIndex));
    button.addEventListener("click", () => onSelect(index));
    buttonRow.appendChild(button);
  });
  pendingResultSelectorEl.appendChild(buttonRow);
}

/**
 * @param {import('./gameLogic.js').Piece|null} piece  the selected piece, or
 *   null to clear the readout
 * @param {'en'|'ko'} language
 * @param {number} [stackSize]  how many pieces (including this one) are
 *   currently stacked together (PRD.md §15) — 1 means not stacked
 */
export function updatePieceSelectionDisplay(piece, language, stackSize = 1) {
  if (!pieceSelectionEl) return;
  if (!piece) {
    pieceSelectionEl.textContent = `${t(language, "selectedPieceLabel")}: ${t(language, "noPieceSelected")}`;
    return;
  }
  const stateKey = piece.state === "WAITING" ? "stateWaiting" : piece.state === "HOME" ? "stateHome" : "stateActive";
  const positionNote = piece.position ? ` ${t(language, "atNodeLabel")(piece.position)}` : "";
  const stackedNote = stackSize > 1 ? t(language, "stackedSuffix")(stackSize) : "";
  pieceSelectionEl.textContent = `${t(language, "selectedPieceLabel")}: ${piece.id} — ${t(language, stateKey)}${positionNote}${stackedNote}`;
}

/**
 * Reports the catch/stack side-effects of the move that just resolved
 * (PRD.md §14-15), or clears the readout if the move had neither.
 * @param {{ caughtPieceIds: string[], stackedPieceIds: string[] }} outcome
 * @param {'en'|'ko'} language
 */
export function updateMoveOutcome(outcome, language) {
  if (!moveOutcomeEl) return;
  if (outcome.caughtPieceIds.length > 0) {
    moveOutcomeEl.textContent = t(language, "moveOutcomeCaught")(outcome.caughtPieceIds.join(", "));
  } else if (outcome.stackedPieceIds.length > 0) {
    moveOutcomeEl.textContent = t(language, "moveOutcomeStacked")(outcome.stackedPieceIds.join(", "));
  } else {
    moveOutcomeEl.textContent = "";
  }
}

/** @param {'en'|'ko'} language */
export function updateInstructionsLine(language) {
  if (instructionsEl) instructionsEl.textContent = t(language, "instructionsLine");
}

/**
 * Clears every per-match HUD readout back to blank, for Restart/New Game —
 * the throw/pending-result/move-outcome/piece-selection text otherwise keeps
 * showing the previous match's last state until something new overwrites it
 * (PRD.md §17, "any UI/animation state" resets too).
 */
export function resetHudReadouts() {
  if (throwResultEl) throwResultEl.textContent = "";
  if (pendingResultsSummaryEl) pendingResultsSummaryEl.textContent = "";
  if (moveOutcomeEl) moveOutcomeEl.textContent = "";
  if (pendingResultSelectorEl) pendingResultSelectorEl.replaceChildren();
  if (gameLogEl) gameLogEl.replaceChildren();
}

// ==========================================================================
// Developer test panel (DEBUG_MODE only)
// ==========================================================================

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
  const panel = el("div", [], { id: "debug-panel" });

  const label = el("div", [], { id: "debug-panel-label" });
  label.textContent = "DEVELOPER TEST PANEL — force a throw result (not part of the game)";
  panel.appendChild(label);

  const buttonRow = el("div", [], { id: "debug-panel-buttons" });
  for (const type of DEBUG_FORCEABLE_TYPES) {
    const button = el("button", ["debug-force-button"], { type: "button" });
    button.textContent = throwResultLabel("en", type);
    button.addEventListener("click", () => onForceThrow(type));
    buttonRow.appendChild(button);
  }
  panel.appendChild(buttonRow);

  hudEl.appendChild(panel);
}

// ==========================================================================
// Pre-game setup screen (unchanged placeholder — see HANDOFF.md "Remaining work")
// ==========================================================================

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

// ==========================================================================
// Winner banner
// ==========================================================================

let winnerBannerEl = null;
let winnerBannerTextEl = null;

/**
 * Builds the (initially hidden) winner banner + "New Game" button once.
 * The camera/lighting victory effect itself (PRD.md §26) is main.js's job
 * (Three.js); this is only the HUD half — nickname (in the winner's team
 * color) + New Game control.
 * @param {{ onNewGame: () => void }} handlers
 */
export function renderWinnerBanner({ onNewGame }) {
  winnerBannerEl = el("div", [], { id: "winner-banner" });
  winnerBannerEl.style.display = "none";

  winnerBannerTextEl = el("div", [], { id: "winner-banner-text" });
  winnerBannerEl.appendChild(winnerBannerTextEl);

  const newGameButton = el("button", [], { id: "new-game-button", type: "button" });
  newGameButton.addEventListener("click", onNewGame);
  winnerBannerEl.appendChild(newGameButton);

  hudEl.appendChild(winnerBannerEl);
}

/**
 * Reveals the winner banner (PRD.md §16, §19, §26), with the winner's
 * nickname colored in their team color.
 * @param {string} nickname
 * @param {'blue'|'red'} playerId
 * @param {'en'|'ko'} language
 */
export function showWinnerBanner(nickname, playerId, language) {
  if (!winnerBannerEl) return;
  winnerBannerTextEl.textContent = t(language, "winnerBanner")(nickname);
  winnerBannerTextEl.className = `player-${playerId}`;
  winnerBannerEl.querySelector("#new-game-button").textContent = t(language, "newGame");
  winnerBannerEl.style.display = "flex";
}

export function hideWinnerBanner() {
  if (!winnerBannerEl) return;
  winnerBannerEl.style.display = "none";
}

// ==========================================================================
// New-game / restart confirmation
// ==========================================================================

let restartConfirmEl = null;

/**
 * Builds the (initially hidden) new-game confirmation panel — shown only
 * when New Game is clicked mid-match, to avoid an accidental reset (PRD.md
 * §17).
 * @param {{ onConfirm: () => void, onCancel: () => void }} handlers
 */
export function renderRestartConfirm({ onConfirm, onCancel }) {
  restartConfirmEl = el("div", [], { id: "restart-confirm" });
  restartConfirmEl.style.display = "none";

  const message = el("div", [], { id: "restart-confirm-message" });
  restartConfirmEl.appendChild(message);

  const buttonRow = el("div", [], { id: "restart-confirm-buttons" });

  const confirmButton = el("button", [], { id: "restart-confirm-yes", type: "button" });
  confirmButton.addEventListener("click", onConfirm);
  buttonRow.appendChild(confirmButton);

  const cancelButton = el("button", [], { id: "restart-confirm-cancel", type: "button" });
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

// ==========================================================================
// Game log — tucked behind a small toggle so it stays out of the way of the
// minimal top-bar/bottom-panel layout, per the "minimal and elegant" brief.
// ==========================================================================

let gameLogEl = null;
let gameLogToggleEl = null;
let gameLogVisible = false;
const GAME_LOG_VISIBLE_ENTRIES = 8; // gameState.log itself keeps more (see gameLogic.js); only the most recent few are worth showing at once

/** Builds the (initially collapsed) scrollable game-log panel + its toggle button, anchored above the bottom panel. */
export function renderGameLogPanel() {
  gameLogToggleEl = el("button", ["text-button"], { id: "game-log-toggle", type: "button" });
  gameLogToggleEl.setAttribute("aria-expanded", "false");
  gameLogToggleEl.addEventListener("click", () => {
    gameLogVisible = !gameLogVisible;
    gameLogEl.style.display = gameLogVisible ? "flex" : "none";
    gameLogToggleEl.setAttribute("aria-expanded", String(gameLogVisible));
  });
  bottomPanelEl.appendChild(gameLogToggleEl);

  gameLogEl = el("div", [], { id: "game-log" });
  gameLogEl.style.display = "none";
  bottomPanelEl.appendChild(gameLogEl);
}

/** @param {'en'|'ko'} language */
export function updateGameLogToggleText(language) {
  if (gameLogToggleEl) gameLogToggleEl.textContent = `${gameLogVisible ? "▾" : "▸"} ${t(language, "gameLogToggleLabel")}`;
}

/**
 * Rebuilds the game-log panel from gameState.log, most recent entry on top,
 * capped to the last GAME_LOG_VISIBLE_ENTRIES for display (the underlying
 * array can hold more — see gameLogic.js's logEvent).
 * @param {string[]} log
 */
export function updateGameLog(log) {
  if (!gameLogEl) return;
  gameLogEl.replaceChildren();
  const visible = log.slice(-GAME_LOG_VISIBLE_ENTRIES).reverse();
  for (const entry of visible) {
    const line = el("div", ["game-log-entry"]);
    line.textContent = entry;
    gameLogEl.appendChild(line);
  }
}

// ==========================================================================
// Settings modal
// ==========================================================================

let settingsModalEl = null;
let settingsInputs = {};

/**
 * Builds the (initially hidden) settings modal once: player nicknames, game
 * mode, sound, language, and per-team piece face. Every field applies live
 * (main.js's handlers mutate gameState immediately) — "Save" just closes it.
 * @param {{
 *   onClose: () => void,
 *   onNicknameChange: (playerId: 'blue'|'red', value: string) => void,
 *   onSoundChange: (enabled: boolean) => void,
 *   onLanguageChange: (language: 'en'|'ko') => void,
 *   onFaceChange: (playerId: 'blue'|'red', faceId: string) => void,
 * }} handlers
 */
export function renderSettingsModal({ onClose, onNicknameChange, onSoundChange, onLanguageChange, onFaceChange }) {
  settingsModalEl = el("div", [], { id: "settings-modal" });
  settingsModalEl.style.display = "none";
  settingsModalEl.setAttribute("role", "dialog");
  settingsModalEl.setAttribute("aria-modal", "true");

  settingsModalEl.addEventListener("click", (event) => {
    if (event.target === settingsModalEl) onClose();
  });
  settingsModalEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") onClose();
  });

  const panel = el("div", [], { id: "settings-panel" });

  const header = el("div", [], { id: "settings-header" });
  const title = el("h2", [], { id: "settings-title" });
  header.appendChild(title);
  const closeButton = el("button", ["icon-button"], { id: "settings-close-button", type: "button" });
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);
  header.appendChild(closeButton);
  panel.appendChild(header);

  // ---- Nicknames ----
  const nicknamesSection = el("div", ["settings-section"]);
  const nicknamesLabel = el("div", ["settings-section-label"], { id: "settings-nicknames-label" });
  nicknamesSection.appendChild(nicknamesLabel);
  for (const playerId of ["blue", "red"]) {
    const row = el("label", ["settings-field"]);
    const rowLabel = el("span", ["settings-field-label"], { id: `settings-nickname-label-${playerId}` });
    const input = el("input", ["settings-nickname-input", `player-${playerId}`], {
      id: `settings-nickname-${playerId}`,
      type: "text",
      maxlength: "16",
    });
    input.addEventListener("input", () => onNicknameChange(playerId, input.value));
    row.append(rowLabel, input);
    nicknamesSection.appendChild(row);
    settingsInputs[`nickname-${playerId}`] = input;
  }
  panel.appendChild(nicknamesSection);

  // ---- Game mode ----
  const modeSection = el("div", ["settings-section"]);
  const modeLabel = el("div", ["settings-section-label"], { id: "settings-mode-label" });
  modeSection.appendChild(modeLabel);
  const modeSelect = el("select", [], { id: "settings-game-mode" });
  const twoPlayerOption = el("option", [], { value: "pvp" });
  const vsAiOption = el("option", [], { value: "pvai", disabled: "disabled" });
  modeSelect.append(twoPlayerOption, vsAiOption);
  modeSection.appendChild(modeSelect);
  panel.appendChild(modeSection);
  settingsInputs.twoPlayerOption = twoPlayerOption;
  settingsInputs.vsAiOption = vsAiOption;

  // ---- Sound ----
  const soundSection = el("div", ["settings-section"]);
  const soundRow = el("label", ["settings-field", "settings-switch-row"]);
  const soundRowLabel = el("span", ["settings-field-label"], { id: "settings-sound-label" });
  const soundCheckbox = el("input", ["settings-switch"], { id: "settings-sound-toggle", type: "checkbox" });
  soundCheckbox.addEventListener("change", () => onSoundChange(soundCheckbox.checked));
  soundRow.append(soundRowLabel, soundCheckbox);
  soundSection.appendChild(soundRow);
  panel.appendChild(soundSection);
  settingsInputs.soundCheckbox = soundCheckbox;

  // ---- Language ----
  const languageSection = el("div", ["settings-section"]);
  const languageLabel = el("div", ["settings-section-label"], { id: "settings-language-label" });
  languageSection.appendChild(languageLabel);
  const languageSelect = el("select", [], { id: "settings-language-select" });
  const enOption = el("option", [], { value: "en" });
  enOption.textContent = "English";
  const koOption = el("option", [], { value: "ko" });
  koOption.textContent = "한국어";
  languageSelect.append(enOption, koOption);
  languageSelect.addEventListener("change", () => onLanguageChange(languageSelect.value));
  languageSection.appendChild(languageSelect);
  panel.appendChild(languageSection);
  settingsInputs.languageSelect = languageSelect;

  // ---- Piece face ----
  const faceSection = el("div", ["settings-section"]);
  const faceLabel = el("div", ["settings-section-label"], { id: "settings-face-label" });
  faceSection.appendChild(faceLabel);
  for (const playerId of ["blue", "red"]) {
    const row = el("div", ["settings-face-row"]);
    const rowLabel = el("div", ["settings-face-row-label"], { id: `settings-face-row-label-${playerId}` });
    row.appendChild(rowLabel);
    const swatches = el("div", ["settings-face-swatches"]);

    const defaultButton = el("button", ["face-option"], { type: "button", "data-face-id": DEFAULT_FACE_ID });
    const defaultCanvas = el("canvas", [], { width: "64", height: "64" });
    defaultButton.appendChild(defaultCanvas);
    defaultButton.addEventListener("click", () => onFaceChange(playerId, DEFAULT_FACE_ID));
    swatches.appendChild(defaultButton);
    settingsInputs[`face-${playerId}-${DEFAULT_FACE_ID}`] = defaultButton;
    drawFaceOnCanvas(defaultCanvas, playerId, DEFAULT_FACE_ID);

    FACE_OPTIONS.forEach((option, index) => {
      const button = el("button", ["face-option"], { type: "button", "data-face-id": option.id });
      button.textContent = option.emoji;
      button.addEventListener("click", () => onFaceChange(playerId, option.id));
      swatches.appendChild(button);
      settingsInputs[`face-${playerId}-${option.id}`] = button;
    });
    row.appendChild(swatches);
    faceSection.appendChild(row);
  }
  panel.appendChild(faceSection);

  const footer = el("div", [], { id: "settings-footer" });
  const saveButton = el("button", ["text-button", "primary"], { id: "settings-save-button", type: "button" });
  saveButton.addEventListener("click", onClose);
  footer.appendChild(saveButton);
  panel.appendChild(footer);

  settingsModalEl.appendChild(panel);
  hudEl.appendChild(settingsModalEl);
}

/**
 * Refreshes every static settings-modal label for the current language —
 * called on open and whenever the language changes while it's open.
 * @param {'en'|'ko'} language
 */
export function updateSettingsModalText(language) {
  if (!settingsModalEl) return;
  settingsModalEl.querySelector("#settings-title").textContent = t(language, "settingsTitle");
  settingsModalEl.querySelector("#settings-close-button").setAttribute("aria-label", t(language, "closeSettingsAriaLabel"));
  settingsModalEl.querySelector("#settings-nicknames-label").textContent = t(language, "nicknamesSectionLabel");
  settingsModalEl.querySelector("#settings-nickname-label-blue").textContent = t(language, "blueNicknameLabel");
  settingsModalEl.querySelector("#settings-nickname-label-red").textContent = t(language, "redNicknameLabel");
  settingsModalEl.querySelector("#settings-mode-label").textContent = t(language, "gameModeLabel");
  settingsInputs.twoPlayerOption.textContent = t(language, "twoPlayerModeLabel");
  settingsInputs.vsAiOption.textContent = t(language, "vsAiModeLabel");
  settingsModalEl.querySelector("#settings-sound-label").textContent = t(language, "soundSettingLabel");
  settingsModalEl.querySelector("#settings-language-label").textContent = t(language, "languageSettingLabel");
  settingsModalEl.querySelector("#settings-face-label").textContent = t(language, "faceSettingLabel");
  settingsModalEl.querySelector("#settings-face-row-label-blue").textContent = t(language, "blueFaceLabel");
  settingsModalEl.querySelector("#settings-face-row-label-red").textContent = t(language, "redFaceLabel");
  settingsModalEl.querySelector("#settings-save-button").textContent = t(language, "saveSettings");
  for (const playerId of ["blue", "red"]) {
    settingsInputs[`face-${playerId}-${DEFAULT_FACE_ID}`].setAttribute("aria-label", t(language, "defaultFaceAriaLabel"));
  }
  FACE_OPTIONS.forEach((option, index) => {
    for (const playerId of ["blue", "red"]) {
      settingsInputs[`face-${playerId}-${option.id}`].setAttribute("aria-label", t(language, "faceOptionAriaLabel")(index + 1));
    }
  });
}

/**
 * Populates and reveals the settings modal from the current game state.
 * @param {{ players: {id: 'blue'|'red', nickname: string, faceId: string|null}[], settings: { language: 'en'|'ko', soundEnabled: boolean } }} gameState
 */
export function showSettingsModal(gameState) {
  if (!settingsModalEl) return;
  updateSettingsModalText(gameState.settings.language);

  for (const player of gameState.players) {
    settingsInputs[`nickname-${player.id}`].value = player.nickname;
    for (const faceId of allFaceIdsFor()) {
      settingsInputs[`face-${player.id}-${faceId}`].classList.toggle("selected", player.faceId === faceId);
    }
  }
  settingsInputs.twoPlayerOption.selected = true;
  settingsInputs.soundCheckbox.checked = gameState.settings.soundEnabled;
  settingsInputs.languageSelect.value = gameState.settings.language;

  settingsModalEl.style.display = "flex";
  settingsInputs[`nickname-blue`].focus();
}

export function hideSettingsModal() {
  if (!settingsModalEl) return;
  settingsModalEl.style.display = "none";
}

/** Highlights the currently-selected face swatch for one team (called live as the player clicks a swatch). */
export function updateFaceSelection(playerId, faceId) {
  for (const id of allFaceIdsFor()) {
    settingsInputs[`face-${playerId}-${id}`]?.classList.toggle("selected", id === faceId);
  }
}
