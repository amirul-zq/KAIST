// boardData.js
//
// Static board graph: node ids, topology, and 3D coordinates only.
// This file must never import gameLogic.js or ui.js — it just describes
// "where the spaces are and how they connect," not "what the rules do."
// See PRD.md §9-12 (board layout) and §23 (board coordinate structure).
//
// Topology (25 nodes total): a 20-node outer ring (O0..O19, corners at
// O0/O5/O10/O15) plus two diagonal shortcut paths crossing at a shared
// center node C, each connecting a pair of OPPOSITE corners:
//   Diagonal A: O0 <-> D0 <-> C <-> D10 <-> O10
//   Diagonal B: O5 <-> D5 <-> C <-> D15 <-> O15
// O0 doubles as the Start/Home node. Everything below is generated from
// these rules rather than hand-listed, so node ids, coordinates, and edges
// can't drift out of sync with each other.

/**
 * @typedef {Object} BoardNode
 * @property {string} id                e.g. 'O0'..'O19', 'D0'|'D5'|'D10'|'D15', 'C'
 * @property {'start'|'outer'|'diagonal'|'center'} kind
 * @property {boolean} isCorner
 * @property {{x: number, y: number, z: number}} worldPosition  for Three.js placement
 * @property {string[]} next            ids of directly connected neighbor nodes
 *                                       (bidirectional adjacency — NOT yet a
 *                                       directional "which way is forward" path;
 *                                       resolving direction-toward-home from this
 *                                       adjacency is gameLogic.js's job in a later
 *                                       phase, since it depends on travel context
 *                                       at the shared hub nodes)
 */

// Half-extent of the square that the 20 outer nodes sit on. Exported so
// main.js can size the visual board consistently around this same node
// grid instead of duplicating the number.
export const OUTER_RING_HALF_SIZE = 5;

const H = OUTER_RING_HALF_SIZE;
const NODE_SURFACE_Y = 0; // nodes sit on the board's top surface (main.js treats y=0 as that surface)

function lerpXZ(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

function midpointXZ(a, b) {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

// The 4 actual corners of the square play surface, in ring order.
const CORNER_XZ = {
  O0: { x: H, z: H },
  O5: { x: H, z: -H },
  O10: { x: -H, z: -H },
  O15: { x: -H, z: H },
};
const CENTER_XZ = { x: 0, z: 0 };

/** @type {BoardNode[]} */
export const BOARD_NODES = [];

// ---------- Outer ring: O0..O19 ----------
const RING_CORNER_ORDER = ["O0", "O5", "O10", "O15"];
for (let edge = 0; edge < 4; edge++) {
  const from = CORNER_XZ[RING_CORNER_ORDER[edge]];
  const to = CORNER_XZ[RING_CORNER_ORDER[(edge + 1) % 4]];
  for (let step = 0; step < 5; step++) {
    const index = edge * 5 + step;
    const { x, z } = lerpXZ(from, to, step / 5);
    BOARD_NODES.push({
      id: `O${index}`,
      kind: index === 0 ? "start" : "outer",
      isCorner: step === 0,
      worldPosition: { x, y: NODE_SURFACE_Y, z },
      next: [], // populated below, once every node exists
    });
  }
}

// ---------- Diagonal shortcut nodes + shared center ----------
const DIAGONAL_NODE_DEFS = [
  { id: "D0", towardCorner: "O0" },
  { id: "D5", towardCorner: "O5" },
  { id: "D10", towardCorner: "O10" },
  { id: "D15", towardCorner: "O15" },
];
for (const { id, towardCorner } of DIAGONAL_NODE_DEFS) {
  const { x, z } = midpointXZ(CORNER_XZ[towardCorner], CENTER_XZ);
  BOARD_NODES.push({ id, kind: "diagonal", isCorner: false, worldPosition: { x, y: NODE_SURFACE_Y, z }, next: [] });
}
BOARD_NODES.push({
  id: "C",
  kind: "center",
  isCorner: false,
  worldPosition: { x: CENTER_XZ.x, y: NODE_SURFACE_Y, z: CENTER_XZ.z },
  next: [],
});

/** @type {Map<string, BoardNode>} */
export const BOARD_NODES_BY_ID = new Map(BOARD_NODES.map((node) => [node.id, node]));

export const START_NODE_ID = "O0";

// ---------- Explicit edges (bidirectional) ----------
// The single source of truth for connectivity: both the node.next adjacency
// below and the visual path lines (drawn in main.js) are derived from this
// list, so the rendered lines can never drift out of sync with the logical
// graph (PRD.md's "visual path lines must match the logical path").
export const BOARD_EDGES = [];
for (let i = 0; i < 20; i++) {
  BOARD_EDGES.push([`O${i}`, `O${(i + 1) % 20}`]);
}
BOARD_EDGES.push(["O0", "D0"], ["D0", "C"], ["C", "D10"], ["D10", "O10"]);
BOARD_EDGES.push(["O5", "D5"], ["D5", "C"], ["C", "D15"], ["D15", "O15"]);

for (const [a, b] of BOARD_EDGES) {
  BOARD_NODES_BY_ID.get(a).next.push(b);
  BOARD_NODES_BY_ID.get(b).next.push(a);
}

/**
 * BFS connectivity check: returns the ids that are NOT reachable from
 * START_NODE_ID. An empty result means the whole graph is a single
 * connected component — every space can be reached from every other space.
 * @returns {string[]}
 */
export function findUnreachableNodeIds() {
  const visited = new Set([START_NODE_ID]);
  const queue = [START_NODE_ID];
  while (queue.length > 0) {
    const currentId = queue.shift();
    for (const neighborId of BOARD_NODES_BY_ID.get(currentId).next) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  return BOARD_NODES.map((node) => node.id).filter((id) => !visited.has(id));
}

// ---------- Directed forward-travel data ----------
// Gameplay direction is NOT simply "whichever neighbor is closer to home" —
// the outer ring only ever travels in one rotational direction (O_i ->
// O_i+1), never backward along the ring, and a shortcut only diverts a
// piece if the corner is exactly where it *rests* between moves, not merely
// passed through mid-move (see gameLogic.js's stepOnePlace, the actual
// consumer of these three lookups, for how "landing exactly on" is
// resolved). These are three separate, explicit pieces of data — not one
// derived shortest-path table — because gameplay direction is a rule
// decision, not a property the raw graph can infer on its own.

/** O_i -> O_(i+1 mod 20): the outer ring's one fixed travel direction. */
export const PLAIN_RING_NEXT = (function computePlainRingNext() {
  const map = new Map();
  for (let i = 0; i < 20; i++) map.set(`O${i}`, `O${(i + 1) % 20}`);
  return map;
})();

/** Corners where resting there sends the *next* move onto the shortcut instead of the outer ring. */
export const CORNER_SHORTCUT_ENTRY = new Map([
  ["O5", "D5"],
  ["O10", "D10"],
  ["O15", "D15"],
]);

/** Once on a diagonal node, there is no outer-ring alternative — always this. */
export const DIAGONAL_FORWARD = new Map([
  ["D5", "C"],
  ["D10", "C"],
  ["D15", "C"],
  ["C", "D0"],
  ["D0", START_NODE_ID],
]);
