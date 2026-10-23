import type { Row, TreeNode, TreeParams } from "./types.js";
import { countClasses, impurity, majority } from "./impurity.js";
import { bestSplit, goesLeft } from "./splits.js";

export const DEFAULT_PARAMS: TreeParams = { maxDepth: 5, minSamplesSplit: 20, criterion: "gini" };

export function buildTree(rows: Row[], params: TreeParams = DEFAULT_PARAMS, depth = 0, id = "n"): TreeNode {
  const n = rows.length;
  if (n === 0) throw new Error("Cannot build a tree from 0 rows");

  const counts = countClasses(rows);
  const nodeImpurity = impurity(counts, n, params.criterion);
  const stats = {id, samples: n, classCounts: counts, impurity: nodeImpurity };
  const makeLeaf = (): TreeNode => ({ type: "leaf", ...stats, prediction: majority(counts) });


  // Stopping rules
  if (nodeImpurity === 0) return makeLeaf();                 // already pure
  if (depth >= params.maxDepth) return makeLeaf();           // too deep
  if (n < params.minSamplesSplit) return makeLeaf();         // too few samples to trust a split

  const split = bestSplit(rows, params.criterion);
  if (split === null) return makeLeaf();                     // no feature can split these rows
  if (nodeImpurity - split.impurity <= 1e-12) return makeLeaf(); // split doesn't help

  // Partition with the same rule predict() will use
  const leftRows: Row[] = [];
  const rightRows: Row[] = [];
  for (const r of rows) {
    (goesLeft(r, split.feature, split.threshold) ? leftRows : rightRows).push(r);
  }
  const gain = nodeImpurity - split.impurity;
  if (gain <= 1e-12) return makeLeaf();

  return {
    type: "node",
    ...stats,
    feature: split.feature,
    threshold: split.threshold,
    gain,
    left: buildTree(leftRows, params, depth + 1, id + "L"),
    right: buildTree(rightRows, params, depth + 1, id + "R"),
  };
}