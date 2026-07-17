// main.js
//
// Phase 3 adds the four 3D Yut sticks and the throw button on top of the
// Phase 1/2 scene+board. All spaces still come from boardData.js; the throw
// outcome itself is computed by gameLogic.js's throwSticks() (pure logic,
// no THREE) — this file only turns that result into a stick animation and
// wires the button through ui.js. No pieces, no piece movement yet.

import * as THREE from "three";
import { BOARD_NODES, BOARD_EDGES, BOARD_NODES_BY_ID, OUTER_RING_HALF_SIZE, findUnreachableNodeIds } from "./boardData.js";
import { throwSticks, createThrowSession, recordThrow, BACK_DO_STICK_INDEX } from "./gameLogic.js";
import { renderThrowControls, setThrowButtonEnabled, updateThrowResult } from "./ui.js";

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

  function handleThrowClick() {
    if (isThrowAnimating) return; // prevent double-clicking during the animation
    isThrowAnimating = true;
    setThrowButtonEnabled(false);

    // The result is decided immediately — the animation only reveals it —
    // so "result calculated from the four visible stick sides" and the
    // sticks the player sees settle are always the exact same stickStates.
    const result = throwSticks();

    startThrowAnimation(result.stickStates, () => {
      recordThrow(throwSession, result);
      updateThrowResult(result, throwSession);
      isThrowAnimating = false;
      setThrowButtonEnabled(true);
    });
  }

  renderThrowControls({ onThrowClick: handleThrowClick });

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

  // ---------- Render loop ----------
  let loadingMessageHidden = false;

  function animate(now) {
    requestAnimationFrame(animate);
    updateThrowAnimation(now);
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
