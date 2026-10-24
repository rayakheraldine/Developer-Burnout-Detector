import type { Edge, Node } from "@xyflow/react";
import type { DecisionNode, TreeNode } from "../types";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 80;

// React Flow requires node data to be a plain object type
export type TreeNodeData = { tree: TreeNode; active?: boolean };

export function edgeLabel(node: DecisionNode, isLeft: boolean): string {
  if (node.feature === "weekends") {
    return isLeft ? "Yes" : "No";
  }

  const t = Number((node.threshold as number).toFixed(2));
  return isLeft ? `≤ ${t}` : `> ${t}`;
}



// 1) Walk: nested tree -> flat lists, no positions yet
function flatten(tree: TreeNode) {
  const nodes: Node<TreeNodeData>[] = [];
  const edges: Edge[] = [];

  function visit(node: TreeNode) {
    
    nodes.push({
        id: node.id,
        type: node.type === "leaf" ? "leaf" : "decision", // which template to use
        position: { x: 0, y: 0 },
        data: { tree: node },
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
          label: isLeft ? "Yes" : "No", // left = condition true
        });
        visit(child);
      }
    }
  }

  visit(tree);
  return { nodes, edges };
}

// 2) Layout: our own tree layout (keeps left/right order)
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