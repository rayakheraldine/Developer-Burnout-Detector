import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Feature, Label, TreeNode } from "../types";
import type { TreeNodeData } from "./toFlow";
import { NODE_WIDTH, NODE_HEIGHT, edgeLabel } from "./toFlow";
import { CLASS_COLORS } from "../colors";

const FEATURE_NAMES: Record<Feature, string> = {
  sleep: "Sleep hours",
  meetings: "Meetings per day",
  stress: "Stress level",
  weekends: "Works weekends?",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

// Share of the most common class at this node
function confidence(node: TreeNode): number {
  return Math.max(...Object.values(node.classCounts)) / node.samples;
}

// Hover box with the training stats of a node
function Tooltip({ node }: { node: TreeNode }) {
  const rows = (Object.entries(node.classCounts) as [Label, number][]).filter(
    ([, count]) => count > 0,
  );
  return (
    <div className="tooltip">
      <div className="tooltip-title">{node.samples} training samples</div>
      {rows.map(([label, count]) => (
        <div key={label} className="tooltip-row">
          <span className="dot" style={{ background: CLASS_COLORS[label] }} />
          {label}: {count} ({pct(count / node.samples)})
        </div>
      ))}
      <div className="tooltip-meta">Impurity: {node.impurity.toFixed(3)}</div>
      {node.type === "node" && (
        <div className="tooltip-meta">
          Information gain: {node.gain.toFixed(3)}
        </div>
      )}
    </div>
  );
}

const size = { width: NODE_WIDTH, minHeight: NODE_HEIGHT };

export function DecisionNodeView({ data }: NodeProps<Node<TreeNodeData>>) {
  const node = data.tree;
  if (node.type !== "node") return null;
  const question =
    node.feature === "weekends"
      ? FEATURE_NAMES.weekends
      : `${FEATURE_NAMES[node.feature]} ${edgeLabel(node, true)}?`;
  return (
    <div
      className={`tree-node decision${data.active ? " active" : ""}`}
      style={size}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="node-title">{question}</div>
      <div className="node-sub">{node.samples} samples</div>
      <Tooltip node={node} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

export function LeafNodeView({ data }: NodeProps<Node<TreeNodeData>>) {
  const node = data.tree;
  if (node.type !== "leaf") return null;
  const color = CLASS_COLORS[node.prediction];
  return (
    <div
      className={`tree-node leaf${data.active ? " active" : ""}`}
      style={{ ...size, borderColor: color, background: `${color}22` }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="node-title" style={{ color }}>
        {node.prediction}
      </div>
      <div className="node-sub">
        {node.samples} samples · {pct(confidence(node))} confident
      </div>
      {confidence(node) < 0.7 && <div className="close-call">⚠ close call</div>}
      <Tooltip node={node} />
    </div>
  );
}
