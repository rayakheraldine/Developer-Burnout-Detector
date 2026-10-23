import type { Row, TreeNode, TreeParams } from "./tree/types.js";
import { buildTree } from "./tree/buildTree.js";
import { accuracy, trainTestSplit } from "./tree/evaluate.js";
import { HttpError } from "./errors.js";

export interface TrainedModel {
  tree: TreeNode;
  params: TreeParams;
  source: "default" | "upload";
  trainSize: number;
  testSize: number;
  trainAccuracy: number;
  testAccuracy: number;
  trainedAt: string;
}

const MIN_ROWS = 10;
let current: TrainedModel | null = null; // in-memory: resets when the server restarts

export function trainModel(rows: Row[], params: TreeParams, source: TrainedModel["source"]): TrainedModel {
  if (rows.length < MIN_ROWS) {
    throw new HttpError(400, `Need at least ${MIN_ROWS} rows to train (got ${rows.length})`);
  }
  const { train, test } = trainTestSplit(rows);
  const tree = buildTree(train, params);
  current = {
    tree,
    params,
    source,
    trainSize: train.length,
    testSize: test.length,
    trainAccuracy: accuracy(tree, train),
    testAccuracy: accuracy(tree, test),
    trainedAt: new Date().toISOString(),
  };
  return current;
}

export function getModel(): TrainedModel {
  if (!current) throw new HttpError(503, "Model is not trained yet");
  return current;
}