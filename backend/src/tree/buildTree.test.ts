import { describe, it, expect } from "vitest";
import type { Label, Row } from "./types.js";
import { buildTree } from "./buildTree.js";
import { predict } from "./predict.js";

const row = (stress: number, status: Label, weekends: "Yes" | "No" = "No"): Row => ({
  sleep: 7, meetings: 3, weekends, stress, status,
});

const data = [
  row(1, "Healthy"), row(2, "Healthy"),
  row(8, "Critical condition"), row(9, "Critical condition"),
];
const params = { maxDepth: 3, minSamplesSplit: 2, criterion: "gini" as const };

describe("buildTree + predict", () => {
  it("splits on stress at 5 with two pure leaves", () => {
    const tree = buildTree(data, params);
    expect(tree.type).toBe("node");
    if (tree.type !== "node") return;
    expect(tree.feature).toBe("stress");
    expect(tree.threshold).toBe(5);
    expect(tree.left.type).toBe("leaf");
    expect(tree.right.type).toBe("leaf");
  });

  it("returns a single leaf when maxDepth is 0", () => {
    const tree = buildTree(data, { ...params, maxDepth: 0 });
    expect(tree.type).toBe("leaf");
    expect(tree.samples).toBe(4);
  });

  it("predicts by following the path", () => {
    const tree = buildTree(data, params);
    const p = predict(tree, { sleep: 7, meetings: 3, weekends: "No", stress: 9.5 });
    expect(p.prediction).toBe("Critical condition");
    expect(p.path).toEqual([{ feature: "stress", threshold: 5, wentLeft: false }]);
  });
});