import { LABELS, type ClassCounts, type Label, type Row , type Criterion} from "./types.js";

export function emptyCounts(): ClassCounts {
  return { "Healthy": 0, "Risk of burnout": 0, "Vacation required": 0, "Critical condition": 0 };
}

export function countClasses(rows: Row[]): ClassCounts {
  const counts = emptyCounts();
  for (const r of rows) counts[r.status]++;
  return counts;
}

// Gini = 1 - Σ p²   (0 = pure, max 0.75 for 4 equal classes)
export function gini(counts: ClassCounts, total: number): number {
  if (total === 0) return 0;
  let sumSq = 0;
  for (const label of LABELS) {
    const p = counts[label] / total;
    sumSq += p * p;
  }
  return 1 - sumSq;
}

// Entropy = -Σ p·log2(p)   (0 = pure, max 2 bits for 4 equal classes)
export function entropy(counts: ClassCounts, total: number): number {
  if (total === 0) return 0;
  let h = 0;
  for (const label of LABELS) {
    const p = counts[label] / total;
    if (p > 0) h -= p * Math.log2(p); // 0·log(0) is defined as 0
  }
  return h;
}

export function impurity(counts: ClassCounts, total: number, criterion: Criterion): number {
  return criterion === "gini" ? gini(counts, total) : entropy(counts, total);
}

// Class with the most samples -> a leaf's prediction
export function majority(counts: ClassCounts): Label {
  let best: Label = LABELS[0];
  for (const label of LABELS) {
    if (counts[label] > counts[best]) best = label;
  }
  return best;
}