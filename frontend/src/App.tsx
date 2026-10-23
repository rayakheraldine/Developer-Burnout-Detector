import { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { treeToFlow } from "./graph/toFlow";
import type { TrainedModel } from "./types";
import { DecisionNodeView, LeafNodeView } from "./graph/nodes";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const nodeTypes = { decision: DecisionNodeView, leaf: LeafNodeView };

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/tree`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((model: TrainedModel) => {
        const flow = treeToFlow(model.tree);
        setNodes(flow.nodes);
        setEdges(flow.edges);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p>Could not load the tree: {error}</p>;
  if (nodes.length === 0) return <p>Loading…</p>; // fitView only runs once, so wait for the data

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}