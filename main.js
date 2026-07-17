// main.js
//
// Entry point: wires together the rules engine (gameLogic.js), the board data
// (boardData.js), the DOM/HUD (ui.js), and the Three.js scene. This file owns
// the render loop; it should stay thin and delegate real logic elsewhere
// rather than growing rules or DOM code inline (PRD.md §21).

import * as THREE from "three";
import { createInitialState } from "./gameLogic.js";
import { BOARD_NODES } from "./boardData.js";
import { showSetupScreen, hideSetupScreen, renderHud } from "./ui.js";

// ---------- Three.js scene setup (placeholder — no board/pieces yet) ----------

const canvas = document.getElementById("scene-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b2b1e); // dark green, matches PRD.md §20

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 8, 8);
camera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(5, 10, 5);
sunLight.castShadow = true;
scene.add(ambientLight, sunLight);

function resizeRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

function animate() {
  requestAnimationFrame(animate);
  // TODO: drive piece/stick animations from game state here (render/*.js modules, PRD.md §21).
  renderer.render(scene, camera);
}
animate();

// ---------- Game bootstrap ----------

let state = createInitialState();

console.log(`Board graph currently has ${BOARD_NODES.length} node(s) defined (see boardData.js TODO).`);

showSetupScreen(state.settings, (setupResult) => {
  // TODO: fold setupResult (nicknames/language/faces) into state via gameLogic.js
  // once that's implemented, then transition state.turnPhase to 'THROWING'.
  hideSetupScreen();
  renderHud(state, {
    onThrow: () => console.log("TODO: wire throwSticks() from gameLogic.js"),
    onRestart: () => console.log("TODO: reset state and show setup screen again"),
  });
});
