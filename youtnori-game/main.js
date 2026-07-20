// main.js
//
// Phase 5 adds piece movement on top of the Phase 1-4 scene, board, sticks,
// and pieces. Phase 6 adds catching and stacking on top of that. Phase 7
// adds win detection, the victory camera/light effect, and Restart. All
// rules (legal moves, path resolution, shortcuts, completion, catching,
// stacking, turn switching, win detection, reset) live in gameLogic.js —
// this file only reads its results, animates one visible hop at a time (a
// whole stack moves in lockstep, one click), and calls applyMove() when the
// player clicks a legal piece.

import * as THREE from "three";
import { BOARD_NODES, BOARD_EDGES, BOARD_NODES_BY_ID, OUTER_RING_HALF_SIZE, findUnreachableNodeIds } from "./boardData.js";
import {
  throwSticks,
  forceThrowResult,
  createThrowSession,
  recordThrow,
  createInitialState,
  applyMove,
  isMoveLegal,
  stackMembers,
  grantBonusThrow,
  pruneUnusableResults,
  maybeSwitchTurn,
  currentPlayer,
  checkWinner,
  resetGameState,
  resetThrowSession,
  logEvent,
  PieceState,
  BACK_DO_STICK_INDEX,
} from "./gameLogic.js";
import {
  FACE_OPTIONS,
  renderTopBar,
  updateTopBarStaticText,
  updateTeamStatus,
  renderBottomPanel,
  setThrowButtonEnabled,
  updateThrowButtonLabel,
  setCurrentActionText,
  updateCurrentPlayer,
  updateThrowResult,
  updatePendingResultsReadout,
  updatePendingResultSelector,
  updatePieceSelectionDisplay,
  updateMoveOutcome,
  updateInstructionsLine,
  resetHudReadouts,
  renderDebugPanel,
  renderWinnerBanner,
  showWinnerBanner,
  hideWinnerBanner,
  renderRestartConfirm,
  showRestartConfirm,
  hideRestartConfirm,
  renderGameLogPanel,
  updateGameLogToggleText,
  updateGameLog,
  renderSettingsModal,
  updateSettingsModalText,
  showSettingsModal,
  hideSettingsModal,
  updateFaceSelection,
} from "./ui.js";
import { t, throwResultLabel } from "./i18n.js";

// DEVELOPER TEST PANEL SWITCH — must be `false` before submission.
// When true, an on-screen panel lets you force each throw result (Do, Gae,
// Geol, Yut, Mo, Back Do) for testing, via the exact same processThrowResult
// pipeline a real throw uses (see below). It has zero effect on gameplay
// when false: renderDebugPanel() is simply never called, so no debug DOM,
// styling, or listeners exist at all.
// To turn it off before submission: set this back to `false` (see also
// README.md's "Developer test panel" section).
const DEBUG_MODE = false;

const canvas = document.getElementById("scene-canvas");
const loadingMessageEl = document.getElementById("loading-message");

// ---------- Board visual constants ----------
// Sized relative to OUTER_RING_HALF_SIZE (the node grid's own half-extent)
// rather than an independent magic number, so the visual board always
// matches whatever boardData.js actually defines.
const BOARD_MARGIN = 1.5; // gap between the outermost nodes and the board's outer edge
const BOARD_HALF_SIZE = OUTER_RING_HALF_SIZE + BOARD_MARGIN;
const BOARD_THICKNESS = 0.5;
const BORDER_WIDTH = 0.5;
const BORDER_HEIGHT = 0.35;

const COLOR_BEIGE_WOOD = 0xdac48e;
const COLOR_DARK_BROWN = 0x3e2618;
const COLOR_MARKER_CORNER = 0xdba233; // O0/O5/O10/O15 — largest, warmest markers
const COLOR_MARKER_SHORTCUT = 0xa4322a; // diagonal nodes + center — the "special" spaces
const COLOR_MARKER_PLAIN = 0xf1e6c8; // ordinary outer-ring spaces
const COLOR_PATH = 0x6b4a2c;
const COLOR_FLOOR = 0x082018;

// ---------- Yut stick visual constants ----------
const STICK_LENGTH = 1.6;
const STICK_RADIUS = 0.15;
const STICK_RADIAL_SEGMENTS = 16;
const STICK_FLAT_THICKNESS = 0.03;
const COLOR_STICK_ROUND = 0x8a5a34; // rounded outer (bark-toned) side
const COLOR_STICK_FLAT = 0xf1e6c8; // plain flat side
const COLOR_STICK_FLAT_MARKED = 0xdba233; // the Back-Do stick's flat side gets its own tone...
const COLOR_STICK_MARK_DOT = 0x1a0f08; // ...plus a small dark dot, so it reads clearly either way

// Sticks lie with their length along world X, so they must be spread apart
// along Z (perpendicular to that length) — spreading along X instead would
// make 1.6-unit-long sticks overlap almost entirely.
const STICK_SLOT_Z_OFFSETS = [-0.6, -0.2, 0.2, 0.6];
const STICK_BASE_X = 0;
const STICK_BASE_Z = 4.4; // toward the near edge, off the board's center X pattern for clarity
const STICK_REST_Y = 1.4;
const STICK_DROP_HEIGHT = 1.6; // how far above rest height sticks hover at the start of a throw
const THROW_DURATION_MS = 900;

// ---------- Piece visual constants ----------
const PIECE_RADIUS = 0.4;
const PIECE_HEIGHT = 0.28;
const PIECE_REST_Y = PIECE_HEIGHT / 2; // sits flush on the tabletop-height plane (y=0), same as the board's own top surface
const PIECE_LIFT_HEIGHT = 0.35; // how far a selected piece rises
const PIECE_HOVER_SCALE = 1.08;
const PIECE_HOVER_EMISSIVE = 0.35;
const PIECE_SELECTED_EMISSIVE = 0.5;
const PIECE_LEGAL_GLOW_BASE = 0.1; // baseline glow on every currently-selectable piece
const PIECE_LEGAL_GLOW_AMPLITUDE = 0.08; // how much that glow pulses

const COLOR_PIECE_BLUE = 0x2b5fd6;
const COLOR_PIECE_RED = 0xd6392b;

// Waiting-area layout: each player's 4 pieces sit just outside the board as
// a 2x2 grid — blue to the left (negative X), red to the right (positive X).
const WAITING_AREA_GAP = 1.2; // gap between the board's outer edge and the nearest waiting slot
const WAITING_AREA_COLUMN_SPACING = 0.95;
const WAITING_AREA_ROW_SPACING = 1.1;

// Finish area: completed pieces line up further back (away from camera),
// in the same near column as each player's waiting area, on a small raised
// gold platform so "done" reads clearly at a glance.
const FINISH_AREA_Z = 2.6;
const FINISH_SLOT_SPACING = 0.9;
const COLOR_FINISH_PLATFORM = 0xdba233;

// ---------- Movement animation constants ----------
const MOVE_STEP_DURATION_MS = 320; // one visible hop
const MOVE_HOP_ARC_HEIGHT = 0.22;

// ---------- Catching / stacking visual constants (Phase 6) ----------
const KNOCKBACK_DURATION_MS = 420; // a caught piece's flight back to its waiting slot
const KNOCKBACK_ARC_HEIGHT = 0.4; // higher than a normal hop's arc — reads as more forceful
const STACK_OFFSET_RADIUS = 0.22; // how far stacked pieces sitting on one node spread apart

// ---------- Victory effect constants (Phase 7) ----------
const VICTORY_EFFECT_DURATION_MS = 1800;
const AMBIENT_BASE_INTENSITY = 0.5; // matches ambientLight's initial intensity below
const SUN_BASE_INTENSITY = 0.8; // matches sunLight's initial intensity below
const VICTORY_LIGHT_BOOST = 0.9; // peak intensity added on top of the base during the flourish
const COLOR_LIGHT_NEUTRAL = 0xffffff;
const COLOR_LIGHT_WARM = 0xfff2d0; // warmer tone at the flourish's peak

// Wrapped in try/catch so a runtime failure (e.g. WebGL unsupported) reports
// itself in the loading message instead of leaving the page silently blank —
// see index.html for the companion watchdog that covers the case where this
// module never runs at all (e.g. the Three.js CDN import itself fails).
try {
  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft-edged shadows

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b2b1e); // dark green tabletop backdrop (PRD.md §20)

  // ---------- Camera ----------
  // Perspective camera at a tilted, tabletop-viewing angle (~55° from vertical,
  // i.e. looking down and across at the board rather than straight down or
  // straight ahead) — matches PRD.md §20's "tilted top-down" spec. The base
  // direction/distance below was tuned for a 16:9 viewport; updateCameraForViewport
  // (in the resize section) scales distance for other aspect ratios.
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  const CAMERA_BASE_DIRECTION = new THREE.Vector3(0, 8, 12);
  const CAMERA_REFERENCE_ASPECT = 16 / 9;

  // ---------- Lighting ----------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  sunLight.position.set(5, 10, 5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.radius = 4; // softens shadow edges further, on top of PCFSoftShadowMap
  // Default shadow-camera frustum (±5) is too tight for the board (half-size
  // ~6.5) now that there's real geometry to cast/receive shadows — widen it
  // so the soft shadow isn't clipped at the board's edges.
  sunLight.shadow.camera.left = -10;
  sunLight.shadow.camera.right = 10;
  sunLight.shadow.camera.top = 10;
  sunLight.shadow.camera.bottom = -10;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 30;
  sunLight.shadow.camera.updateProjectionMatrix();

  scene.add(ambientLight, sunLight);

  // ---------- Shadow-catching floor ----------
  // A plain backdrop plane beneath the board so its soft shadow has
  // somewhere to land, reinforcing the tabletop look (PRD.md §20, §26).
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: COLOR_FLOOR, roughness: 1 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -BOARD_THICKNESS - 0.4;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // ---------- Board group ----------
  // Everything here is generated from boardData.js's BOARD_NODES/BOARD_EDGES —
  // no space or connection is hand-placed, so the visuals can't drift out of
  // sync with the logical graph.
  const boardGroup = new THREE.Group();

  // Main beige playing surface. Top surface sits at y=0, which is the same
  // y all node worldPositions use (see boardData.js).
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_HALF_SIZE * 2, BOARD_THICKNESS, BOARD_HALF_SIZE * 2),
    new THREE.MeshStandardMaterial({ color: COLOR_BEIGE_WOOD, roughness: 0.85 })
  );
  boardMesh.position.y = -BOARD_THICKNESS / 2;
  boardMesh.receiveShadow = true;
  boardMesh.castShadow = true;
  boardGroup.add(boardMesh);

  // Raised dark-brown border: 4 rails along the outer edge, sitting on top of
  // (and rising above) the beige surface like a tray rim. They overlap
  // slightly at the corners, which is harmless and avoids visible gaps.
  const borderMaterial = new THREE.MeshStandardMaterial({ color: COLOR_DARK_BROWN, roughness: 0.8 });
  const railSpan = BOARD_HALF_SIZE * 2;
  function addBorderRail(x, z, rotateY) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railSpan, BORDER_HEIGHT, BORDER_WIDTH), borderMaterial);
    rail.position.set(x, BORDER_HEIGHT / 2, z);
    rail.rotation.y = rotateY;
    rail.castShadow = true;
    rail.receiveShadow = true;
    boardGroup.add(rail);
  }
  const railOffset = BOARD_HALF_SIZE - BORDER_WIDTH / 2;
  addBorderRail(0, railOffset, 0);
  addBorderRail(0, -railOffset, 0);
  addBorderRail(railOffset, 0, Math.PI / 2);
  addBorderRail(-railOffset, 0, Math.PI / 2);

  // Space markers: one cylinder per board node, sized/colored by role so the
  // board reads clearly at a glance (corners > shortcut nodes > plain spaces).
  const MARKER_HEIGHT = 0.14;
  for (const node of BOARD_NODES) {
    const isShortcut = node.kind === "diagonal" || node.kind === "center";
    const radius = node.isCorner ? 0.55 : isShortcut ? 0.42 : 0.32;
    const color = node.isCorner ? COLOR_MARKER_CORNER : isShortcut ? COLOR_MARKER_SHORTCUT : COLOR_MARKER_PLAIN;
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, MARKER_HEIGHT, 24),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    marker.position.set(node.worldPosition.x, node.worldPosition.y + MARKER_HEIGHT / 2, node.worldPosition.z);
    marker.castShadow = true;
    marker.receiveShadow = true;
    marker.userData.nodeId = node.id; // for later phases (piece placement, interaction)
    boardGroup.add(marker);
  }

  // Path segments: one thin box per entry in BOARD_EDGES, so the visible
  // paths are always exactly the logical graph's edges — nothing more, nothing less.
  const PATH_HEIGHT = 0.04;
  const PATH_WIDTH = 0.16;
  const pathMaterial = new THREE.MeshStandardMaterial({ color: COLOR_PATH, roughness: 0.9 });
  for (const [idA, idB] of BOARD_EDGES) {
    const a = BOARD_NODES_BY_ID.get(idA).worldPosition;
    const b = BOARD_NODES_BY_ID.get(idB).worldPosition;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const segment = new THREE.Mesh(new THREE.BoxGeometry(length, PATH_HEIGHT, PATH_WIDTH), pathMaterial);
    segment.position.set((a.x + b.x) / 2, PATH_HEIGHT / 2, (a.z + b.z) / 2);
    segment.rotation.y = Math.atan2(-dz, dx);
    segment.receiveShadow = true;
    boardGroup.add(segment);
  }

  scene.add(boardGroup);

  // Sanity check (dev-time only): confirms every space is reachable from
  // start, i.e. the graph in boardData.js has no disconnected node.
  const unreachable = findUnreachableNodeIds();
  if (unreachable.length > 0) {
    console.error("Board graph has unreachable nodes:", unreachable);
  } else {
    console.log(`Board graph OK: all ${BOARD_NODES.length} nodes reachable from start.`);
  }

  // ---------- Yut sticks ----------
  // Each stick is a half-round cylinder (the rounded side) plus a thin box
  // filling the flat cut face (the flat side), wrapped in three nested
  // groups with one job each:
  //   rollGroup      — rotated around its own length axis to show flat-up
  //                    vs round-up, and to tumble during the throw
  //   layFlatGroup   — fixed rotation that lays the stick down horizontally;
  //                    never animated
  //   placementGroup — fixed X/Z slot position; its Y is animated for the
  //                    "drop from above" part of the throw
  function createStickMesh(isMarked) {
    const rollGroup = new THREE.Group();

    const roundMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, STICK_RADIAL_SEGMENTS, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: COLOR_STICK_ROUND, roughness: 0.7 })
    );
    rollGroup.add(roundMesh);

    // The half-cylinder's flat cut face lies in the local x=0 plane, with
    // the round bulge on the +x side — so the flat filler box sits just
    // inside x<0, flush against that cut.
    const flatMesh = new THREE.Mesh(
      new THREE.BoxGeometry(STICK_FLAT_THICKNESS, STICK_LENGTH, STICK_RADIUS * 2),
      new THREE.MeshStandardMaterial({ color: isMarked ? COLOR_STICK_FLAT_MARKED : COLOR_STICK_FLAT, roughness: 0.5 })
    );
    flatMesh.position.x = -STICK_FLAT_THICKNESS / 2;
    rollGroup.add(flatMesh);

    if (isMarked) {
      // Small dark dot marking this as the Back-Do stick (PRD.md §5) —
      // visible whenever the flat side is showing, in addition to its
      // distinct flat-side color above.
      const markMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.01, 12),
        new THREE.MeshStandardMaterial({ color: COLOR_STICK_MARK_DOT })
      );
      markMesh.rotation.z = Math.PI / 2; // lay the little disc flat against the flat face
      markMesh.position.x = -STICK_FLAT_THICKNESS - 0.005;
      rollGroup.add(markMesh);
    }

    rollGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const layFlatGroup = new THREE.Group();
    layFlatGroup.rotation.z = -Math.PI / 2; // lay the stick horizontal; fixed, never animated
    layFlatGroup.add(rollGroup);

    const placementGroup = new THREE.Group();
    placementGroup.add(layFlatGroup);

    return { placementGroup, rollGroup };
  }

  const sticks = STICK_SLOT_Z_OFFSETS.map((zOffset, i) => {
    const stick = createStickMesh(i === BACK_DO_STICK_INDEX);
    stick.placementGroup.position.set(STICK_BASE_X, STICK_REST_Y, STICK_BASE_Z + zOffset);
    scene.add(stick.placementGroup);
    return stick;
  });

  // restRoll: 0 = flat-up, Math.PI = round-up (derived from the geometry
  // above: with no extra roll, the flat face ends up on top; a half turn
  // around the stick's own length axis swaps it to round-up).
  function setStickRestState(stickStates) {
    sticks.forEach((stick, i) => {
      stick.rollGroup.rotation.y = stickStates[i] ? 0 : Math.PI;
      stick.placementGroup.position.y = STICK_REST_Y;
    });
  }
  setStickRestState([false, false, false, false]); // idle pose before the first throw: all round-up

  // ---------- Throw animation + click handling ----------
  const throwSession = createThrowSession();
  let isThrowAnimating = false;
  let throwAnimation = null; // { startTime, stickStates, extraSpins, onComplete }

  function startThrowAnimation(stickStates, onComplete) {
    throwAnimation = {
      startTime: performance.now(),
      stickStates,
      // Each stick gets a slightly different number of extra full turns so
      // they don't spin in lockstep; being whole multiples of 2*PI, these
      // never affect the final resting angle.
      extraSpins: stickStates.map(() => (3 + Math.random() * 3) * Math.PI * 2),
      onComplete,
    };
  }

  function updateThrowAnimation(now) {
    if (!throwAnimation) return;
    const { startTime, stickStates, extraSpins, onComplete } = throwAnimation;
    const t = Math.min((now - startTime) / THROW_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: fast tumble settling smoothly to rest

    sticks.forEach((stick, i) => {
      const restRoll = stickStates[i] ? 0 : Math.PI;
      stick.rollGroup.rotation.y = restRoll + extraSpins[i] * (1 - eased);
      stick.placementGroup.position.y = STICK_REST_Y + (1 - eased) * STICK_DROP_HEIGHT;
    });

    if (t >= 1) {
      throwAnimation = null;
      onComplete();
    }
  }

  // Shared by both a real throw and a forced (debug-panel) throw, so the two
  // can never diverge in how a result gets animated, recorded, or displayed
  // — only where the ThrowResult itself came from differs.
  function processThrowResult(result) {
    if (gameState.turnPhase === "GAME_OVER") return; // no further input once there's a winner (PRD.md §16)
    if (isThrowAnimating || isMoveAnimating || knockbackAnimations.length > 0) return; // prevent double-clicking during any animation
    isThrowAnimating = true;
    setThrowButtonEnabled(false);

    startThrowAnimation(result.stickStates, () => {
      recordThrow(throwSession, result);
      logEvent(
        gameState,
        t(gameState.settings.language, "logThrew")(currentPlayer(gameState).nickname, throwResultLabel(gameState.settings.language, result.type))
      );
      // A Back-Do with no ACTIVE piece (or any result no piece could ever
      // use) is forfeited immediately rather than blocking the game
      // (PRD.md §5).
      const forfeited = pruneUnusableResults(throwSession, currentPlayer(gameState).pieces);
      updateThrowResult(result, throwSession, gameState.settings.language, forfeited);
      updateGameLog(gameState.log);
      playPlaceholderSound("throw-sticks");
      isThrowAnimating = false;

      if (!throwSession.chainActive && throwSession.pendingResults.length > 0) {
        selectedResultIndex = 0; // auto-select so a single pending result "just works"
      }
      handleTurnSettlement();
      refreshHud();
    });
  }

  function handleThrowClick() {
    // The result is decided immediately — the animation only reveals it —
    // so "result calculated from the four visible stick sides" and the
    // sticks the player sees settle are always the exact same stickStates.
    processThrowResult(throwSticks());
  }

  // Developer test panel: only ever rendered when DEBUG_MODE is true (see
  // the constant's declaration at the top of this file for how to turn it
  // off). Forced throws go through the identical processThrowResult
  // pipeline as a real click, so there is no separate "debug" code path
  // that could behave differently from normal play.
  if (DEBUG_MODE) {
    renderDebugPanel({
      onForceThrow: (type) => processThrowResult(forceThrowResult(type)),
    });
  }

  // ---------- Pieces ----------
  // Piece data (id/player/state/route/position/completed/stackId) comes
  // entirely from gameLogic.js's createInitialState() — this section only
  // turns that data into meshes and reads it back for display, and calls
  // gameLogic.js's applyMove() to actually move one; it never mutates piece
  // state directly (PRD.md §21, "game logic separate from 3D rendering").
  const gameState = createInitialState();
  // The setup screen (nickname/language/face pick) isn't implemented yet
  // (Phase 4 note carried forward) — skip straight past it so the game is
  // actually playable.
  gameState.turnPhase = "THROWING";

  function waitingAreaSlotPosition(owner, slotIndex) {
    const col = Math.floor(slotIndex / 2); // 0 or 1
    const row = slotIndex % 2; // 0 or 1
    const colOffset = BOARD_HALF_SIZE + WAITING_AREA_GAP + col * WAITING_AREA_COLUMN_SPACING;
    const x = owner === "blue" ? -colOffset : colOffset;
    const z = (row === 0 ? -1 : 1) * (WAITING_AREA_ROW_SPACING / 2);
    return { x, z };
  }

  // Completed pieces line up here instead, in arrival order.
  function finishAreaSlotPosition(owner, finishedIndex) {
    const colOffset = BOARD_HALF_SIZE + WAITING_AREA_GAP;
    const x = owner === "blue" ? -colOffset : colOffset;
    const z = FINISH_AREA_Z + finishedIndex * FINISH_SLOT_SPACING;
    return { x, z };
  }

  function createFinishPlatform(owner) {
    const colOffset = BOARD_HALF_SIZE + WAITING_AREA_GAP;
    const x = owner === "blue" ? -colOffset : colOffset;
    const zCenter = FINISH_AREA_Z + 1.5 * FINISH_SLOT_SPACING; // centered under 4 potential slots
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.08, FINISH_SLOT_SPACING * 4 + 0.4),
      new THREE.MeshStandardMaterial({ color: COLOR_FINISH_PLATFORM, roughness: 0.6 })
    );
    platform.position.set(x, 0.04, zCenter);
    platform.receiveShadow = true;
    platform.castShadow = true;
    scene.add(platform);
  }
  createFinishPlatform("blue");
  createFinishPlatform("red");

  // Side/top/bottom are kept as 3 separate material instances (CylinderGeometry's
  // 3 face groups) rather than 1 shared material, so a later phase can assign a
  // face texture to just the top cap (group 1) without touching the side/bottom
  // look — "support face textures later".
  function createPieceMesh(owner) {
    const color = owner === "blue" ? COLOR_PIECE_BLUE : COLOR_PIECE_RED;
    const materials = [0.5, 0.35, 0.6].map(
      (roughness) =>
        new THREE.MeshStandardMaterial({ color, roughness, emissive: new THREE.Color(color), emissiveIntensity: 0 })
    );
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(PIECE_RADIUS, PIECE_RADIUS, PIECE_HEIGHT, 32), materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // id -> { piece, mesh, slotIndex }. `piece` is the gameLogic.js data object
  // (read-only here except via applyMove); `mesh` is purely this piece's
  // visual representation; `slotIndex` (0-3, stable for the piece's whole
  // life) is where it returns to if it ever backs off the board again.
  // Multiple pieces sharing one position later (stacking, PRD.md §15) would
  // offset by stack index here — not needed yet since catching/stacking
  // aren't implemented this phase.
  const pieceEntriesById = new Map();
  for (const player of gameState.players) {
    player.pieces.forEach((piece, slotIndex) => {
      const mesh = createPieceMesh(piece.player);
      const { x, z } = waitingAreaSlotPosition(piece.player, slotIndex);
      mesh.position.set(x, PIECE_REST_Y, z);
      mesh.userData.pieceId = piece.id;
      scene.add(mesh);
      pieceEntriesById.set(piece.id, { piece, mesh, slotIndex });
    });
  }

  function countHomePieces(playerId) {
    return gameState.players.find((p) => p.id === playerId).pieces.filter((p) => p.state === PieceState.HOME).length;
  }

  // ---------- Piece movement animation ----------
  let isMoveAnimating = false;
  // { members: { pieceId, waypoints: {x,z}[] }[], segmentIndex, segmentStartTime, onComplete }
  // A stack's members travel in lockstep — same number of waypoints, same
  // per-segment timing — so one segmentIndex/segmentStartTime drives every
  // member; only their individual waypoint coordinates differ (each keeps
  // its own "from" starting point, and its own personal waiting/finish slot
  // for the exitsToWaiting/completed cases).
  let pieceMoveAnimation = null;

  function worldXZForNode(nodeId) {
    const { x, z } = BOARD_NODES_BY_ID.get(nodeId).worldPosition;
    return { x, z };
  }

  function waypointsForGroupMember(entry, outcome, finishSlotIndex) {
    const waypoints = [{ x: entry.mesh.position.x, z: entry.mesh.position.z }];

    if (outcome.exitsToWaiting) {
      waypoints.push(waitingAreaSlotPosition(entry.piece.player, entry.slotIndex));
    } else {
      for (const nodeId of outcome.steps) waypoints.push(worldXZForNode(nodeId));
      if (outcome.completed) {
        waypoints.push(finishAreaSlotPosition(entry.piece.player, finishSlotIndex));
      }
    }
    return waypoints;
  }

  /**
   * Builds the hop-by-hop waypoint list for `outcome` (from applyMove) for
   * every entry in `groupEntries` — a lone piece, or a whole stack moving
   * together (PRD.md §15) — and starts animating all their meshes along it
   * in lockstep, one visible space at a time (PRD.md "move one visible
   * space at a time, animate each step").
   * @param {{piece, mesh, slotIndex}[]} groupEntries
   * @param {ReturnType<typeof applyMove>} outcome
   * @param {number} homeCountBeforeMove  this player's completed-piece count
   *   *before* this move — completing pieces are assigned consecutive
   *   finish slots (homeCountBeforeMove, +1, +2, ...) by sorted piece id, so
   *   a multi-piece stack finishing together doesn't pile every member onto
   *   the same finish slot.
   */
  function animateGroupMove(groupEntries, outcome, homeCountBeforeMove, onComplete) {
    const sortedEntries = [...groupEntries].sort((a, b) => (a.piece.id < b.piece.id ? -1 : 1));
    const members = sortedEntries.map((entry, index) => ({
      pieceId: entry.piece.id,
      waypoints: waypointsForGroupMember(entry, outcome, homeCountBeforeMove + index),
    }));

    pieceMoveAnimation = {
      members,
      segmentIndex: 0,
      segmentStartTime: performance.now(),
      onComplete,
    };
  }

  function updatePieceMoveAnimation(now) {
    if (!pieceMoveAnimation) return;
    const anim = pieceMoveAnimation;
    const t = Math.min((now - anim.segmentStartTime) / MOVE_STEP_DURATION_MS, 1);

    for (const member of anim.members) {
      const mesh = pieceEntriesById.get(member.pieceId).mesh;
      const from = member.waypoints[anim.segmentIndex];
      const to = member.waypoints[anim.segmentIndex + 1];
      mesh.position.x = from.x + (to.x - from.x) * t;
      mesh.position.z = from.z + (to.z - from.z) * t;
      mesh.position.y = PIECE_REST_Y + Math.sin(t * Math.PI) * MOVE_HOP_ARC_HEIGHT;
    }

    if (t >= 1) {
      anim.segmentIndex += 1;
      const isLastSegment = anim.segmentIndex >= anim.members[0].waypoints.length - 1;
      if (isLastSegment) {
        for (const member of anim.members) {
          const mesh = pieceEntriesById.get(member.pieceId).mesh;
          const to = member.waypoints[member.waypoints.length - 1];
          mesh.position.set(to.x, PIECE_REST_Y, to.z); // snap exactly, clear the hop-arc residue
        }
        pieceMoveAnimation = null;
        anim.onComplete();
      } else {
        anim.segmentStartTime = now;
      }
    }
  }

  // ---------- Catching / stacking visuals (Phase 6) ----------
  // Independent of pieceMoveAnimation above so a caught piece's (or several,
  // for a caught stack) knock-back flight never blocks or gets blocked by
  // the mover's own hop animation.
  let knockbackAnimations = []; // { pieceId, from: {x,z}, to: {x,z}, startTime }[]

  function startKnockbackAnimation(pieceId, from, to) {
    knockbackAnimations.push({ pieceId, from, to, startTime: performance.now() });
  }

  function updateKnockbackAnimations(now) {
    if (knockbackAnimations.length === 0) return;
    knockbackAnimations = knockbackAnimations.filter((anim) => {
      const mesh = pieceEntriesById.get(anim.pieceId).mesh;
      const t = Math.min((now - anim.startTime) / KNOCKBACK_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out: fast departure, softer landing
      mesh.position.x = anim.from.x + (anim.to.x - anim.from.x) * eased;
      mesh.position.z = anim.from.z + (anim.to.z - anim.from.z) * eased;
      mesh.position.y = PIECE_REST_Y + Math.sin(t * Math.PI) * KNOCKBACK_ARC_HEIGHT;
      if (t < 1) return true;
      mesh.position.set(anim.to.x, PIECE_REST_Y, anim.to.z);
      return false;
    });
    // canThrowNow()/isPieceMovableNow() both gate on knockbackAnimations —
    // but the throw button's disabled attribute is only ever set explicitly,
    // not re-derived every frame, so once the last knockback lands it needs
    // an explicit refresh or the button would stay disabled with nothing
    // left to wait for (refreshHud is declared later in this file but
    // hoisted, since it's a function declaration).
    if (knockbackAnimations.length === 0) refreshHud();
  }

  function stackOffsetXZ(indexInGroup, groupSize) {
    if (groupSize <= 1) return { x: 0, z: 0 };
    const angle = (indexInGroup / groupSize) * Math.PI * 2;
    return { x: Math.cos(angle) * STACK_OFFSET_RADIUS, z: Math.sin(angle) * STACK_OFFSET_RADIUS };
  }

  /**
   * Snaps every ACTIVE piece's mesh to a small non-overlapping arrangement
   * around its board node — a single piece sits dead-center, but 2+ pieces
   * sharing a node (a stack, PRD.md §15) spread into a little cluster so
   * "there's more than one piece here" is visually obvious at rest. Cheap
   * enough (≤8 pieces) to just recompute from scratch after every move
   * rather than track deltas.
   */
  function applyStackVisualOffsets() {
    const groupsByPosition = new Map();
    for (const { piece } of pieceEntriesById.values()) {
      if (piece.state !== PieceState.ACTIVE) continue;
      if (!groupsByPosition.has(piece.position)) groupsByPosition.set(piece.position, []);
      groupsByPosition.get(piece.position).push(piece);
    }

    for (const [nodeId, pieces] of groupsByPosition) {
      const { x: baseX, z: baseZ } = worldXZForNode(nodeId);
      const sorted = [...pieces].sort((a, b) => (a.id < b.id ? -1 : 1));
      sorted.forEach((piece, index) => {
        const { x: offX, z: offZ } = stackOffsetXZ(index, sorted.length);
        const mesh = pieceEntriesById.get(piece.id).mesh;
        mesh.position.x = baseX + offX;
        mesh.position.z = baseZ + offZ;
      });
    }
  }

  // ---------- Turn / pending-result state ----------
  let selectedResultIndex = null;
  let settingsModalOpen = false;
  let restartConfirmVisible = false;

  function canThrowNow() {
    if (gameState.turnPhase === "GAME_OVER") return false;
    if (isThrowAnimating || isMoveAnimating || knockbackAnimations.length > 0) return false;
    // Throwing is legal in two situations: nothing is pending yet (a fresh
    // turn, or right after every pending move has been applied), OR a bonus
    // throw is actively owed (Yut/Mo, or a catch via grantBonusThrow) —
    // that second case still has the earned-but-unapplied result(s) sitting
    // in pendingResults, so checking pendingResults.length alone would
    // leave the button disabled exactly when the bonus throw is due.
    return throwSession.chainActive || throwSession.pendingResults.length === 0;
  }

  // The pending-result selector is only ever shown once the whole bonus
  // chain has settled — PRD.md "do not allow movement until all bonus
  // throws have been completed".
  function refreshPendingResultUI() {
    const language = gameState.settings.language;
    updatePendingResultSelector(throwSession.chainActive ? [] : throwSession.pendingResults, selectedResultIndex, language, (index) => {
      selectedResultIndex = index;
      refreshHud();
    });
    setThrowButtonEnabled(canThrowNow());
  }

  /**
   * Sums up a player's pieces by state, for their top-bar team-status block.
   * @param {import('./gameLogic.js').Piece[]} pieces
   */
  function teamPieceCounts(pieces) {
    return {
      waiting: pieces.filter((p) => p.state === PieceState.WAITING).length,
      active: pieces.filter((p) => p.state === PieceState.ACTIVE).length,
      home: pieces.filter((p) => p.state === PieceState.HOME).length,
    };
  }

  /** The "what to do right now" line shown in the bottom panel (PRD.md's reference-game brief). */
  function computeCurrentActionText() {
    const language = gameState.settings.language;
    if (gameState.turnPhase === "GAME_OVER") {
      const winner = gameState.players.find((player) => player.id === gameState.winner);
      return t(language, "actionGameOver")(winner.nickname || winner.id);
    }
    if (throwSession.chainActive) return t(language, "actionThrowBonus");
    if (throwSession.pendingResults.length === 0) return t(language, "actionThrow");
    if (selectedResultIndex === null) return t(language, "actionSelectResult");
    return t(language, "actionSelectPiece");
  }

  /**
   * The single place that re-renders every HUD element whose text depends on
   * general game/settings state (as opposed to one-off event readouts like
   * "just caught X" — those are set directly at their own call sites). Safe
   * to call liberally: every language toggle, turn change, selection change,
   * and settings change routes through here so nothing can go stale in one
   * language but not the other.
   */
  function refreshHud() {
    const language = gameState.settings.language;
    updateTopBarStaticText(language, gameState.settings.soundEnabled);

    for (const player of gameState.players) {
      const isHighlighted =
        gameState.turnPhase === "GAME_OVER" ? player.id === gameState.winner : player.id === currentPlayer(gameState).id;
      updateTeamStatus(player.id, { nickname: player.nickname || player.id, ...teamPieceCounts(player.pieces) }, language, isHighlighted);
    }

    updateCurrentPlayer(currentPlayer(gameState), language);
    updateThrowButtonLabel(language);
    setCurrentActionText(computeCurrentActionText());
    updateInstructionsLine(language);
    updateGameLogToggleText(language);

    const selectedEntry = selectedPieceId ? pieceEntriesById.get(selectedPieceId) : null;
    updatePieceSelectionDisplay(
      selectedEntry ? selectedEntry.piece : null,
      language,
      selectedEntry ? stackMembers(selectedEntry.piece, gameState.players.flatMap((p) => p.pieces)).length : 1
    );

    refreshPendingResultUI();

    if (settingsModalOpen) updateSettingsModalText(language);
    if (gameState.turnPhase === "GAME_OVER") {
      const winner = gameState.players.find((player) => player.id === gameState.winner);
      showWinnerBanner(winner.nickname || winner.id, winner.id, language);
    }
    if (restartConfirmVisible) showRestartConfirm(language);
  }

  function handleTurnSettlement() {
    if (maybeSwitchTurn(gameState, throwSession)) {
      selectedPieceId = null;
      selectedResultIndex = null;
    }
  }

  // ---------- Win / restart (Phase 7) ----------
  // { startTime, baseCameraPos: Vector3, targetPos: Vector3, targetLookAt: Vector3 }
  let victoryEffect = null;

  /**
   * Camera zoom toward the winner's finish area + a light pulse, distinct
   * from ordinary move/catch animations (PRD.md §26). Runs alongside
   * showWinnerBanner rather than gating it — the banner text is the
   * unambiguous "who won" signal even if a player looks away mid-effect.
   * @param {'blue'|'red'} winnerId
   */
  function startVictoryEffect(winnerId) {
    const colOffset = BOARD_HALF_SIZE + WAITING_AREA_GAP;
    const x = winnerId === "blue" ? -colOffset : colOffset;
    const finishCenterZ = FINISH_AREA_Z + 1.5 * FINISH_SLOT_SPACING;
    victoryEffect = {
      startTime: performance.now(),
      baseCameraPos: camera.position.clone(),
      targetPos: new THREE.Vector3(x * 0.5, camera.position.y * 0.7, finishCenterZ + 4),
      targetLookAt: new THREE.Vector3(x, 0, finishCenterZ),
    };
  }

  function updateVictoryEffect(now) {
    if (!victoryEffect) return;
    const t = Math.min((now - victoryEffect.startTime) / VICTORY_EFFECT_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: quick zoom settling smoothly

    camera.position.lerpVectors(victoryEffect.baseCameraPos, victoryEffect.targetPos, eased);
    const lookAt = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), victoryEffect.targetLookAt, eased);
    camera.lookAt(lookAt);

    // A pulse (0 -> 1 -> 0 across the effect) rather than a permanent boost —
    // "flourish", not a new steady lighting state; the camera framing is
    // what holds afterward, per PRD.md §26.
    const pulse = Math.sin(Math.min(t, 1) * Math.PI);
    ambientLight.intensity = AMBIENT_BASE_INTENSITY + pulse * VICTORY_LIGHT_BOOST;
    sunLight.intensity = SUN_BASE_INTENSITY + pulse * VICTORY_LIGHT_BOOST;
    sunLight.color.setHex(pulse > 0.3 ? COLOR_LIGHT_WARM : COLOR_LIGHT_NEUTRAL);
  }

  /** Restores the camera framing and lighting the victory effect changed, for Restart. */
  function resetVictoryEffect() {
    victoryEffect = null;
    updateCameraForViewport(window.innerWidth, window.innerHeight);
    ambientLight.intensity = AMBIENT_BASE_INTENSITY;
    sunLight.intensity = SUN_BASE_INTENSITY;
    sunLight.color.setHex(COLOR_LIGHT_NEUTRAL);
  }

  /**
   * Called the instant checkWinner detects a win: stops further input (via
   * gameState.turnPhase already being 'GAME_OVER'), and surfaces the win to
   * the player via the camera/light effect + banner (PRD.md §16, §26).
   */
  function handleGameOver() {
    isMoveAnimating = false;
    setThrowButtonEnabled(false);
    updatePendingResultSelector([], null, gameState.settings.language, () => {});
    updatePendingResultsReadout(throwSession, gameState.settings.language, []);
    startVictoryEffect(gameState.winner);
    const winnerPlayer = gameState.players.find((player) => player.id === gameState.winner);
    const winnerName = winnerPlayer.nickname || winnerPlayer.id;
    logEvent(gameState, t(gameState.settings.language, "logWon")(winnerName));
    updateGameLog(gameState.log);
    playPlaceholderSound("victory-fanfare");
    refreshHud(); // shows the winner banner (turnPhase is already GAME_OVER) and the "X has won" action line
  }

  /**
   * Placeholder for celebration/UI sound effects — no audio assets exist
   * yet (see README.md's "Remaining phases": sound is a later phase), so
   * this intentionally just logs what *would* play rather than attempting
   * to load/play a file that doesn't exist (which would 404 in the
   * console). Swap the body for a real Audio()/WebAudio call once
   * assets/sounds/ has real files — the call site (handleGameOver) is
   * already wired up. Gated on the sound-toggle setting (top bar/settings
   * modal) so muting actually silences it once real playback exists.
   * @param {string} soundName
   */
  function playPlaceholderSound(soundName) {
    if (!gameState.settings.soundEnabled) return;
    console.info(`[sound placeholder] would play: ${soundName}`);
  }

  /**
   * True once a fresh game exists (initial load) or the match just ended —
   * in either case there's no in-progress state worth protecting, so
   * Restart can act immediately rather than asking for confirmation
   * (PRD.md §17: "with a confirmation step if a game is in progress").
   */
  function isRestartSafeWithoutConfirm() {
    if (gameState.turnPhase === "GAME_OVER") return true;
    const allWaiting = gameState.players.every((player) => player.pieces.every((piece) => piece.state === PieceState.WAITING));
    return allWaiting && gameState.currentPlayerIndex === 0 && !throwSession.chainActive && throwSession.pendingResults.length === 0;
  }

  /** Fully resets match state, meshes, animations, camera/lighting, and HUD — no page reload (PRD.md §17). */
  function performRestart() {
    resetGameState(gameState);
    resetThrowSession(throwSession);

    selectedPieceId = null;
    selectedResultIndex = null;
    hoveredPieceId = null;
    isThrowAnimating = false;
    isMoveAnimating = false;
    throwAnimation = null;
    pieceMoveAnimation = null;
    knockbackAnimations = [];

    for (const entry of pieceEntriesById.values()) {
      const { x, z } = waitingAreaSlotPosition(entry.piece.player, entry.slotIndex);
      entry.mesh.position.set(x, PIECE_REST_Y, z);
      entry.mesh.scale.set(1, 1, 1);
      for (const material of entry.mesh.material) {
        material.opacity = 1;
        material.emissiveIntensity = 0;
      }
    }
    setStickRestState([false, false, false, false]);
    resetVictoryEffect();

    hideWinnerBanner();
    restartConfirmVisible = false;
    hideRestartConfirm();
    resetHudReadouts();
    refreshHud();
  }

  function handleNewGameClick() {
    if (isRestartSafeWithoutConfirm()) {
      performRestart();
    } else {
      restartConfirmVisible = true;
      showRestartConfirm(gameState.settings.language);
    }
  }

  renderRestartConfirm({
    onConfirm: () => {
      restartConfirmVisible = false;
      hideRestartConfirm();
      performRestart();
    },
    onCancel: () => {
      restartConfirmVisible = false;
      hideRestartConfirm();
    },
  });
  renderWinnerBanner({ onNewGame: performRestart });

  // ---------- Piece interaction: hover, select, legal glow, move ----------
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const pieceMeshes = [...pieceEntriesById.values()].map((entry) => entry.mesh);
  let hoveredPieceId = null;
  let selectedPieceId = null;

  function pieceIdFromPointerEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(pieceMeshes, false);
    return hits.length > 0 ? hits[0].object.userData.pieceId : null;
  }

  /** Whether clicking this piece right now would actually execute a move. */
  function isPieceMovableNow(piece) {
    if (gameState.turnPhase === "GAME_OVER") return false;
    if (isThrowAnimating || isMoveAnimating || knockbackAnimations.length > 0) return false;
    if (throwSession.chainActive) return false;
    if (selectedResultIndex === null) return false;
    const result = throwSession.pendingResults[selectedResultIndex];
    if (!result) return false;
    if (piece.player !== currentPlayer(gameState).id) return false;
    return isMoveLegal(piece, result);
  }

  canvas.addEventListener("pointermove", (event) => {
    const id = pieceIdFromPointerEvent(event);
    hoveredPieceId = id;
    const entry = id ? pieceEntriesById.get(id) : null;
    canvas.style.cursor = entry && isPieceMovableNow(entry.piece) ? "pointer" : "default";
  });

  /**
   * Selects/inspects `pieceId`, and executes a move if it's actually
   * clickable right now. Factored out of the click listener so the
   * DEBUG_MODE introspection hook can drive it directly with a known id,
   * without needing to simulate real screen-coordinate raycasting.
   */
  function selectOrMovePiece(pieceId) {
    if (!pieceId) {
      selectedPieceId = null;
      refreshHud();
      return;
    }

    const entry = pieceEntriesById.get(pieceId);
    const allPiecesNow = gameState.players.flatMap((p) => p.pieces);
    selectedPieceId = pieceId; // always usable to inspect a piece, own or opponent's
    refreshHud();

    if (!isPieceMovableNow(entry.piece)) return;

    const resultIndex = selectedResultIndex;
    const result = throwSession.pendingResults[resultIndex];
    isMoveAnimating = true;
    setThrowButtonEnabled(false);

    // Captured before applyMove mutates anything: which pieces travel
    // together (this piece's stack-mates, if any), and how many of this
    // player's pieces were already Home — the latter reserves consecutive
    // finish slots for a stack that completes together (see
    // animateGroupMove's homeCountBeforeMove param).
    const group = stackMembers(entry.piece, allPiecesNow);
    const groupEntries = group.map((p) => pieceEntriesById.get(p.id));
    const homeCountBeforeMove = countHomePieces(entry.piece.player);

    const outcome = applyMove(entry.piece, result, allPiecesNow);

    animateGroupMove(groupEntries, outcome, homeCountBeforeMove, () => {
      isMoveAnimating = false;
      throwSession.pendingResults.splice(resultIndex, 1); // consume exactly the result that was used
      selectedResultIndex = null;
      selectedPieceId = null;

      // Caught opponent piece(s) fly back to their own waiting slot from
      // wherever they're currently rendered — a knock-back animation
      // independent of the mover's own hop animation (PRD.md §14, §26).
      for (const caughtId of outcome.caughtPieceIds) {
        const caughtEntry = pieceEntriesById.get(caughtId);
        const from = { x: caughtEntry.mesh.position.x, z: caughtEntry.mesh.position.z };
        const to = waitingAreaSlotPosition(caughtEntry.piece.player, caughtEntry.slotIndex);
        startKnockbackAnimation(caughtId, from, to);
      }
      applyStackVisualOffsets();
      updateMoveOutcome(outcome);

      const moverNickname = gameState.players.find((player) => player.id === entry.piece.player).nickname;
      if (outcome.caughtPieceIds.length > 0) {
        const victimNickname = gameState.players.find(
          (player) => player.id === pieceEntriesById.get(outcome.caughtPieceIds[0]).piece.player
        ).nickname;
        logEvent(
          gameState,
          t(gameState.settings.language, "logCaught")(moverNickname, victimNickname, outcome.caughtPieceIds.length)
        );
        playPlaceholderSound("catch");
      } else if (outcome.stackedPieceIds.length > 0) {
        logEvent(gameState, t(gameState.settings.language, "logStacked")(moverNickname, outcome.stackedPieceIds.length));
      }
      if (outcome.completed) {
        logEvent(gameState, t(gameState.settings.language, "logCompleted")(moverNickname, group.length));
      }
      updateGameLog(gameState.log);

      // Win detection happens the instant a move completes a 4th piece
      // (PRD.md §16) — checked before granting any catch bonus or pruning
      // pending results, since a completing move never also catches
      // (applyMove returns early on path.completed) and the game must stop
      // accepting further input immediately once there's a winner.
      if (checkWinner(gameState)) {
        handleGameOver();
        return;
      }

      if (outcome.caughtPieceIds.length > 0) {
        grantBonusThrow(throwSession); // PRD.md §7, §14 — catching earns another throw
      }

      const forfeited = pruneUnusableResults(throwSession, currentPlayer(gameState).pieces);
      updatePendingResultsReadout(throwSession, gameState.settings.language, forfeited);
      if (!throwSession.chainActive && throwSession.pendingResults.length > 0) {
        selectedResultIndex = 0; // auto-select so a single remaining result "just works"
      }
      handleTurnSettlement();
      refreshHud();
    });
  }

  canvas.addEventListener("click", (event) => {
    selectOrMovePiece(pieceIdFromPointerEvent(event));
  });

  // ---------- Piece face textures (settings modal, "character or face selection") ----------
  // No external face art exists yet (see pieces/README.md) — each face option
  // is a small emoji drawn onto a canvas and applied as the top-cap texture
  // (CylinderGeometry's material group 1; see createPieceMesh's comment).
  // Cached by faceId so switching back and forth never re-draws the canvas.
  const faceTextureCache = new Map();
  function getFaceTexture(faceId) {
    if (faceTextureCache.has(faceId)) return faceTextureCache.get(faceId);
    const option = FACE_OPTIONS.find((f) => f.id === faceId);
    const canvasEl = document.createElement("canvas");
    canvasEl.width = 128;
    canvasEl.height = 128;
    const ctx = canvasEl.getContext("2d");
    ctx.fillStyle = "#f1e6c8";
    ctx.fillRect(0, 0, 128, 128);
    ctx.font = "84px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(option ? option.emoji : "", 64, 70);
    const texture = new THREE.CanvasTexture(canvasEl);
    texture.needsUpdate = true;
    faceTextureCache.set(faceId, texture);
    return texture;
  }

  /** Applies faceId's texture to every current-and-future-rendered piece of playerId's top cap. */
  function applyFaceTexture(playerId, faceId) {
    const texture = getFaceTexture(faceId);
    for (const { piece, mesh } of pieceEntriesById.values()) {
      if (piece.player !== playerId) continue;
      const topMaterial = mesh.material[1];
      topMaterial.map = texture;
      topMaterial.color.set(0xffffff); // let the texture (beige + emoji) show through untinted
      topMaterial.needsUpdate = true;
    }
  }

  // ---------- Sound / language / settings ----------
  function setSoundEnabled(enabled) {
    gameState.settings.soundEnabled = enabled;
    refreshHud();
  }

  function setLanguage(language) {
    gameState.settings.language = language;
    refreshHud();
  }

  function handleNicknameChange(playerId, value) {
    gameState.players.find((player) => player.id === playerId).nickname = value;
    refreshHud();
  }

  function handleFaceChange(playerId, faceId) {
    gameState.players.find((player) => player.id === playerId).faceId = faceId;
    updateFaceSelection(playerId, faceId);
    applyFaceTexture(playerId, faceId);
  }

  renderTopBar({
    onSoundToggle: () => setSoundEnabled(!gameState.settings.soundEnabled),
    onLanguageToggle: () => setLanguage(gameState.settings.language === "en" ? "ko" : "en"),
    onSettingsClick: () => {
      settingsModalOpen = true;
      showSettingsModal(gameState);
    },
    onNewGameClick: handleNewGameClick,
  });
  renderBottomPanel({ onThrowClick: handleThrowClick });
  renderGameLogPanel();
  renderSettingsModal({
    onClose: () => {
      settingsModalOpen = false;
      hideSettingsModal();
    },
    onNicknameChange: handleNicknameChange,
    onSoundChange: setSoundEnabled,
    onLanguageChange: setLanguage,
    onFaceChange: handleFaceChange,
  });

  refreshHud();

  function updatePieceVisuals(now) {
    const legalPulse = PIECE_LEGAL_GLOW_BASE + PIECE_LEGAL_GLOW_AMPLITUDE * (0.5 + 0.5 * Math.sin(now * 0.003));
    // "Disable illegal pieces" only means something once there's an active
    // choice to be illegal *against* — before any result is selected (e.g.
    // still mid-throw, or right at game start), nothing is dimmed, it's
    // just neutral. Dimming turns on only once selecting a result makes
    // some pieces genuinely unusable for it.
    const hasActiveSelection =
      !throwSession.chainActive && selectedResultIndex !== null && Boolean(throwSession.pendingResults[selectedResultIndex]);

    for (const [pieceId, { piece, mesh }] of pieceEntriesById) {
      const isSelected = pieceId === selectedPieceId;
      const isHovered = pieceId === hoveredPieceId;
      const isMovable = isPieceMovableNow(piece);
      const isMoveAnimatingThisPiece =
        (pieceMoveAnimation && pieceMoveAnimation.members.some((m) => m.pieceId === pieceId)) ||
        knockbackAnimations.some((k) => k.pieceId === pieceId);

      // The move animation owns position.y (and x/z) while it's running —
      // don't fight it with the hover-lift lerp below.
      if (!isMoveAnimatingThisPiece) {
        const targetY = PIECE_REST_Y + (isSelected ? PIECE_LIFT_HEIGHT : 0);
        mesh.position.y += (targetY - mesh.position.y) * 0.25;
      }

      const targetScale = isHovered && isMovable ? PIECE_HOVER_SCALE : 1;
      mesh.scale.x += (targetScale - mesh.scale.x) * 0.3;
      mesh.scale.y += (targetScale - mesh.scale.y) * 0.3;
      mesh.scale.z += (targetScale - mesh.scale.z) * 0.3;

      const shouldDim = hasActiveSelection && !isMovable && piece.state !== PieceState.HOME;
      const targetOpacity = shouldDim ? 0.45 : 1;
      for (const material of mesh.material) {
        material.transparent = true;
        material.opacity += (targetOpacity - material.opacity) * 0.2;
      }

      let emissiveIntensity = isMovable ? legalPulse : 0;
      if (isMovable && isHovered) emissiveIntensity = Math.max(emissiveIntensity, PIECE_HOVER_EMISSIVE);
      if (isSelected) emissiveIntensity = Math.max(emissiveIntensity, PIECE_SELECTED_EMISSIVE);
      for (const material of mesh.material) {
        material.emissiveIntensity = emissiveIntensity;
      }
    }
  }

  // ---------- Resize handling ----------
  // Pixel ratio is capped at 2 rather than used raw (phones commonly report
  // 3+), since rendering that many physical pixels per CSS pixel — on top of
  // shadow maps — is a real GPU/battery cost for little visible benefit. It's
  // reapplied on every resize in case the window moves to a display with a
  // different scale factor.
  //
  // Responsive board scale: the camera keeps the same tilt/direction at every
  // viewport size, but its distance from the board scales up on narrower
  // (e.g. mobile portrait) aspect ratios, so the whole board stays framed
  // instead of being cropped at the sides.
  function updateCameraForViewport(width, height) {
    const aspect = width / height;
    camera.aspect = aspect;
    const distanceScale = Math.max(1, CAMERA_REFERENCE_ASPECT / aspect);
    camera.position.copy(CAMERA_BASE_DIRECTION).multiplyScalar(distanceScale);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function resizeRenderer() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    updateCameraForViewport(width, height);
  }
  window.addEventListener("resize", resizeRenderer);
  // Some mobile browsers briefly report stale innerWidth/innerHeight right as
  // 'orientationchange' fires, before layout settles — re-check shortly after
  // as a safety net alongside the plain resize listener.
  window.addEventListener("orientationchange", () => setTimeout(resizeRenderer, 200));
  resizeRenderer();

  // DEVELOPER-ONLY introspection hook, so the test panel's forced throws can
  // be scripted end-to-end (throw -> select result -> click piece) without a
  // real browser session. Only exists when DEBUG_MODE is true; see the
  // constant's declaration at the top of this file.
  if (DEBUG_MODE) {
    window.__debug = {
      gameState,
      throwSession,
      selectPendingResult: (index) => {
        selectedResultIndex = index;
        refreshPendingResultUI();
      },
      clickPieceId: (pieceId) => selectOrMovePiece(pieceId),
      pieceEntriesById,
      isMoveAnimating: () => isMoveAnimating,
      isKnockbackAnimating: () => knockbackAnimations.length > 0,
      allPieces: () => gameState.players.flatMap((p) => p.pieces),
    };
  }

  // ---------- Render loop ----------
  let loadingMessageHidden = false;

  function animate(now) {
    requestAnimationFrame(animate);
    updateThrowAnimation(now);
    updatePieceMoveAnimation(now);
    updateKnockbackAnimations(now);
    updatePieceVisuals(now);
    updateVictoryEffect(now);
    renderer.render(scene, camera);

    // Hide the loading message once the first real frame has been drawn.
    if (!loadingMessageHidden) {
      loadingMessageHidden = true;
      loadingMessageEl.style.display = "none";
    }
  }
  animate(performance.now());
} catch (err) {
  console.error("Failed to initialize the 3D scene:", err);
  loadingMessageEl.textContent = "Failed to start the 3D scene — see the browser console for details.";
}
