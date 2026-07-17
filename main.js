// main.js
//
// Phase 1: Three.js scene only. Sets up the renderer, camera, and lighting,
// handles resize, and shows a loading message until the first frame renders.
// No board, no pieces, no game logic yet (that starts in a later phase) —
// see PRD.md §20 for the full rendering plan this will grow into, and §21
// for how this file is expected to stay a thin entry point that delegates
// to gameLogic.js/boardData.js/ui.js once those are wired in.

import * as THREE from "three";

const canvas = document.getElementById("scene-canvas");
const loadingMessageEl = document.getElementById("loading-message");

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft-edged shadows

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b2b1e); // dark green tabletop backdrop (PRD.md §20)

// ---------- Camera ----------
// Perspective camera at a tilted, tabletop-viewing angle (~55° from vertical,
// i.e. looking down and across at the board rather than straight down or
// straight ahead) — matches PRD.md §20's "tilted top-down" spec.
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6, 9);
camera.lookAt(0, 0, 0);

// ---------- Lighting ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(5, 10, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.radius = 4; // softens shadow edges further, on top of PCFSoftShadowMap

scene.add(ambientLight, sunLight);

// ---------- Resize handling ----------
function resizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer);
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
