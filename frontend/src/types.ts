export type Label = "Healthy" | "Risk of burnout" | "Vacation required" | "Critical condition";
export type Feature = "sleep" | "meetings" | "stress" | "weekends";
export type ClassCounts = Record<Label, number>;

interface BaseNode {
  id: string;
  samples: number;
  classCounts: ClassCounts;
  impurity: number;
}

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

export interface TrainedModel {
  tree: TreeNode;
  params: { maxDepth: number; minSamplesSplit: number; criterion: "gini" | "entropy" };
  source: "default" | "upload";
  trainSize: number;
  testSize: number;
  trainAccuracy: number;
  testAccuracy: number;
  trainedAt: string;
}