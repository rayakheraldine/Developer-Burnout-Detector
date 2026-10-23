import { NUMERIC_FEATURES, type Criterion, type Feature, type Features, type NumericFeature, type Row } from "./types.js";
import { countClasses, emptyCounts, impurity } from "./impurity.js";

export interface Split {
  feature: Feature;
  threshold: number | "Yes";
  impurity: number; // weighted impurity of the two children (lower = better)
}

// The ONLY place the "LEFT = condition true" rule lives.
// buildTree and predict both call this, so they can never disagree.
export function goesLeft(row: Features, feature: Feature, threshold: number | "Yes"): boolean {
  if (feature === "weekends") return row.weekends === threshold;
  return row[feature] <= (threshold as number);
}

export function bestNumericSplit(rows: Row[], feature: NumericFeature, criterion: Criterion): Split | null {
  const n = rows.length;
  if (n < 2) return null;

  const sorted = [...rows].sort((a, b) => a[feature] - b[feature]); // copy: don't reorder the caller's array
  const left = emptyCounts();
  const right = countClasses(sorted);
  let best: Split | null = null;

  for (let i = 0; i < n - 1; i++) {
    const row = sorted[i]!;
    const next = sorted[i + 1]!;

    // move this row from right to left
    left[row.status]++;
    right[row.status]--;

    // can't put a threshold between two equal values
    if (row[feature] === next[feature]) continue;

    const nL = i + 1;
    const nR = n - nL;
    const score = (nL / n) * impurity(left, nL, criterion) + (nR / n) * impurity(right, nR, criterion);

    if (best === null || score < best.impurity) {
      best = { feature, threshold: (row[feature] + next[feature]) / 2, impurity: score };
    }
  }
  return best; // null if every value was the same
}

export function bestWeekendsSplit(rows: Row[], criterion: Criterion): Split | null {
  const yes = rows.filter((r) => r.weekends === "Yes");
  const no = rows.filter((r) => r.weekends === "No");
  if (yes.length === 0 || no.length === 0) return null; // nothing to split

  const n = rows.length;
  const score =
    (yes.length / n) * impurity(countClasses(yes), yes.length, criterion) +
    (no.length / n) * impurity(countClasses(no), no.length, criterion);

  return { feature: "weekends", threshold: "Yes", impurity: score };
}

// Try every feature, return the overall best split (or null if none is possible)
export function bestSplit(rows: Row[], criterion: Criterion): Split | null {
  const candidates = [
    ...NUMERIC_FEATURES.map((f) => bestNumericSplit(rows, f, criterion)),
    bestWeekendsSplit(rows, criterion),
  ];

  let best: Split | null = null;
  for (const c of candidates) {
    if (c && (best === null || c.impurity < best.impurity)) best = c;
  }
  return best;
}