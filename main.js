// main.js
//
// Phase 2: adds the static 3D board on top of the Phase 1 scene. All spaces,
// their positions, and their connections come from boardData.js — this file
// only turns that data into meshes; it does not invent any board layout of
// its own. No pieces, no interaction, no game logic yet (PRD.md §20-21).

import * as THREE from "three";
import { BOARD_NODES, BOARD_EDGES, BOARD_NODES_BY_ID, OUTER_RING_HALF_SIZE, findUnreachableNodeIds } from "./boardData.js";

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

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    // Hide the loading message once the first real frame has been drawn.
    if (!loadingMessageHidden) {
      loadingMessageHidden = true;
      loadingMessageEl.style.display = "none";
    }
  }
  animate();
} catch (err) {
  console.error("Failed to initialize the 3D scene:", err);
  loadingMessageEl.textContent = "Failed to start the 3D scene — see the browser console for details.";
}
