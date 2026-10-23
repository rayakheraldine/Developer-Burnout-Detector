//import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { DecisionNode, TreeNode } from "../types";

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 70;

// React Flow requires node data to be a plain object type
export type TreeNodeData = { label: string; tree: TreeNode };

export function edgeLabel(node: DecisionNode, isLeft: boolean): string {
  if (node.feature === "weekends") {
    return isLeft ? "Yes" : "No";
  }

  const t = Number((node.threshold as number).toFixed(2));
  return isLeft ? `≤ ${t}` : `> ${t}`;
}

// Text inside each box (temporary; Topic 9 replaces it with custom nodes)
function nodeText(node: TreeNode): string {
  return node.type === "leaf"
    ? `${node.prediction} (${node.samples})`
    : `${node.feature}?  (${node.samples})`;
}

// 1) Walk: nested tree -> flat lists, no positions yet
function flatten(tree: TreeNode) {
  const nodes: Node<TreeNodeData>[] = [];
  const edges: Edge[] = [];

  function visit(node: TreeNode) {
    nodes.push({
      id: node.id,
      position: { x: 0, y: 0 }, // dagre fills this in
      data: { label: nodeText(node), tree: node },
    });

    if (node.type === "node") {
      const children = [
        [node.left, true],
        [node.right, false],
      ] as const;

      for (const [child, isLeft] of children) {
        edges.push({
          id: `${node.id}->${child.id}`,
          source: node.id,
          target: child.id,
          label: edgeLabel(node, isLeft),
        });
        visit(child);
      }
    }
  }

  visit(tree);
  return { nodes, edges };
}

// 2) Layout: ask dagre for positions
const H_GAP = 30; // horizontal space between leaves
const V_GAP = 90; // vertical space between levels

// Tree layout: leaves in visit order, parents centered above their children
function layout(tree: TreeNode, nodes: Node<TreeNodeData>[]): Node<TreeNodeData>[] {
  const positions = new Map<string, { x: number; y: number }>();
  let nextLeafX = 0;

  // returns the x position given to `node`
  function place(node: TreeNode, depth: number): number {
    const y = depth * (NODE_HEIGHT + V_GAP);
    let x: number;

    if (node.type === "leaf") {
      x = nextLeafX;                     // next free slot
      nextLeafX += NODE_WIDTH + H_GAP;
    } else {
      const leftX = place(node.left, depth + 1);   // left first -> stays on the left
      const rightX = place(node.right, depth + 1);
      x = (leftX + rightX) / 2;                     // center above both children
    }

    positions.set(node.id, { x, y });
    return x;
  }

  place(tree, 0);
  return nodes.map((n) => ({ ...n, position: positions.get(n.id)! }));
}

export function treeToFlow(tree: TreeNode) {
  const { nodes, edges } = flatten(tree);
  return { nodes: layout(tree, nodes), edges };
}