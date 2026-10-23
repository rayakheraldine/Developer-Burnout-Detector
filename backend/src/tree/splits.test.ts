import { describe, it, expect } from "vitest";
import type { Label, Row } from "./types.js";
import { bestNumericSplit, bestSplit, bestWeekendsSplit, goesLeft } from "./splits.js";

// all features fixed except the ones a test cares about
const row = (stress: number, status: Label, weekends: "Yes" | "No" = "No"): Row => ({
  sleep: 7, meetings: 3, weekends, stress, status,
});

describe("splits", () => {
  it("finds a perfect numeric split at the midpoint", () => {
    const rows = [row(1, "Healthy"), row(2, "Healthy"), row(8, "Critical condition"), row(9, "Critical condition")];
    const s = bestNumericSplit(rows, "stress", "gini");
    expect(s?.threshold).toBe(5);
    expect(s?.impurity).toBe(0);
  });

  it("returns null when a feature has only one value", () => {
    const rows = [row(1, "Healthy"), row(9, "Critical condition")];
    expect(bestNumericSplit(rows, "sleep", "gini")).toBeNull(); // sleep is 7 everywhere
  });

  it("splits weekends Yes vs No", () => {
    const rows = [row(5, "Critical condition", "Yes"), row(5, "Healthy", "No")];
    const s = bestWeekendsSplit(rows, "gini");
    expect(s?.threshold).toBe("Yes");
    expect(s?.impurity).toBe(0);
  });

  it("bestSplit picks the feature that separates the classes", () => {
    // stress is identical, only weekends differs -> must choose weekends
    const rows = [row(5, "Critical condition", "Yes"), row(5, "Critical condition", "Yes"), row(5, "Healthy", "No")];
    expect(bestSplit(rows, "gini")?.feature).toBe("weekends");
  });

  it("goesLeft treats the threshold itself as left (<=)", () => {
    expect(goesLeft(row(5, "Healthy"), "stress", 5)).toBe(true);
    expect(goesLeft(row(5.1, "Healthy"), "stress", 5)).toBe(false);
  });
});