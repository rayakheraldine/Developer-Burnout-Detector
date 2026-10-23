import type { Row, TreeNode } from "./types.js";
import { predict } from "./predict.js";

// Small seeded random generator (mulberry32) -> reproducible shuffles
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainTestSplit(rows: Row[], testRatio = 0.2, seed = 42): { train: Row[]; test: Row[] } {
  const rand = seededRandom(seed);
  const shuffled = [...rows];
  // Fisher–Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const testSize = Math.round(rows.length * testRatio);
  return { test: shuffled.slice(0, testSize), train: shuffled.slice(testSize) };
}

export function accuracy(tree: TreeNode, rows: Row[]): number {
  if (rows.length === 0) return 0;
  let correct = 0;
  for (const r of rows) if (predict(tree, r).prediction === r.status) correct++;
  return correct / rows.length;
}