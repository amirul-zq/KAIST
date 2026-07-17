// boardData.js
//
// Static board graph: node ids, topology, and 3D coordinates only.
// This file must never import gameLogic.js or ui.js — it just describes
// "where the spaces are and how they connect," not "what the rules do."
// See PRD.md §9-12 (board layout) and §23 (board coordinate structure).

/**
 * @typedef {Object} BoardNode
 * @property {string} id            e.g. 'O0'..'O19', 'D0'|'D5'|'D10'|'D15', 'C'
 * @property {'start'|'outer'|'diagonal'|'center'} kind
 * @property {boolean} isCorner
 * @property {{x: number, y: number, z: number}} worldPosition  for Three.js placement
 * @property {string[]} next        ids of legal forward node(s); >1 only at shortcut branches
 */

/** @type {BoardNode[]} */
export const BOARD_NODES = [
  // TODO: populate all 20 outer nodes (O0..O19) + 5 shortcut/center nodes (D0, D5, D10, D15, C)
  // per PRD.md §9-12. Left empty intentionally — full topology not implemented yet.
];

/**
 * Convenience lookup, built once from BOARD_NODES.
 * @type {Map<string, BoardNode>}
 */
export const BOARD_NODES_BY_ID = new Map(BOARD_NODES.map((node) => [node.id, node]));

export const START_NODE_ID = "O0";
