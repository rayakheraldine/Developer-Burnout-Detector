import { describe, it, expect } from "vitest";
import { emptyCounts, gini, entropy, majority } from "./impurity.js";

describe("impurity", () => {
  it("is 0 for a pure node", () => {
    const c = { ...emptyCounts(), Healthy: 10 };
    expect(gini(c, 10)).toBe(0);
    expect(entropy(c, 10)).toBe(0);
  });

  it("matches hand-calculated values for a 50/50 split", () => {
    const c = { ...emptyCounts(), Healthy: 5, "Critical condition": 5 };
    expect(gini(c, 10)).toBeCloseTo(0.5);
    expect(entropy(c, 10)).toBeCloseTo(1);
  });

  it("hits the maximum for 4 equal classes", () => {
    const c = { Healthy: 3, "Risk of burnout": 3, "Vacation required": 3, "Critical condition": 3 };
    expect(gini(c, 12)).toBeCloseTo(0.75);
    expect(entropy(c, 12)).toBeCloseTo(2);
  });

  it("picks the majority class", () => {
    const c = { ...emptyCounts(), "Risk of burnout": 7, Healthy: 2 };
    expect(majority(c)).toBe("Risk of burnout");
  });
});