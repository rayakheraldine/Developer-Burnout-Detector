// src/tree/types.ts

// The 4 target classes. "as const" keeps the exact strings, so we get
// both a runtime list (for loops/validation) and a union type from one source.
export const LABELS = [
  "Healthy",
  "Risk of burnout",
  "Vacation required",
  "Critical condition",
] as const;
export type Label = (typeof LABELS)[number];

// Feature names, split by how the tree handles them
export const NUMERIC_FEATURES = ["sleep", "meetings", "stress"] as const;
export type NumericFeature = (typeof NUMERIC_FEATURES)[number];
export type Feature = NumericFeature | "weekends";

// One row of burnout_clean.csv
export interface Row {
  sleep: number;
  meetings: number;
  weekends: "Yes" | "No";
  stress: number;
  status: Label;
}

// What predict() receives: a row without the answer
export type Features = Omit<Row, "status">;

// Always holds all 4 classes (0 if absent) -> simpler tooltips + majority vote
export type ClassCounts = Record<Label, number>;

// Stats every node carries (shown in the graph tooltip)
interface BaseNode {
  id: string;            
  samples: number;
  classCounts: ClassCounts;
  impurity: number;
}

// Convention: LEFT = condition is true
//   numeric:  row[feature] <= threshold
//   weekends: row.weekends === "Yes"
export interface DecisionNode extends BaseNode {
  type: "node";
  feature: Feature;
  threshold: number | "Yes";
  gain: number;          
  left: TreeNode;
  right: TreeNode;
}

export interface LeafNode extends BaseNode {
  type: "leaf";
  prediction: Label;
}

export type TreeNode = DecisionNode | LeafNode;
export type Criterion = "gini" | "entropy";

// Training settings (exposed later through the API)
export interface TreeParams {
  maxDepth: number;
  minSamplesSplit: number;
  criterion: Criterion;
}