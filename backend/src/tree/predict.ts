import type { ClassCounts, Feature, Features, Label, TreeNode } from "./types.js";
import { goesLeft } from "./splits.js";

export interface PathStep {
  feature: Feature;
  threshold: number | "Yes";
  wentLeft: boolean;
}

export interface Prediction {
  prediction: Label;
  path: PathStep[];
  leafCounts: ClassCounts; // e.g. "41 of 45 training samples here were Critical"
}

export function predict(tree: TreeNode, input: Features): Prediction {
  const path: PathStep[] = [];
  let node = tree;

  while (node.type === "node") {
    const left = goesLeft(input, node.feature, node.threshold);
    path.push({ feature: node.feature, threshold: node.threshold, wentLeft: left });
    node = left ? node.left : node.right;
  }

  return { prediction: node.prediction, path, leafCounts: node.classCounts };
}