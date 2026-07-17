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
  // Pixel ratio is capped at 2 rather than used raw (phones commonly report
  // 3+), since rendering that many physical pixels per CSS pixel — on top of
  // shadow maps — is a real GPU/battery cost for little visible benefit. It's
  // reapplied on every resize in case the window moves to a display with a
  // different scale factor.
  function resizeRenderer() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
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
