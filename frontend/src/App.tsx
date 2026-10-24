import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { treeToFlow } from "./graph/toFlow";
import { DecisionNodeView, LeafNodeView } from "./graph/nodes";
import { Dashboard } from "./Dashboard";
import { getModel, predict, train } from "./api";
import { useDebouncedValue } from "./useDebouncedValue";
import type { Features, Prediction, TrainedModel, TrainParams } from "./types";

const nodeTypes = { decision: DecisionNodeView, leaf: LeafNodeView };
const DEFAULT_INPUT: Features = { sleep: 7, meetings: 3, stress: 5, weekends: false };

export default function App() {
  const [model, setModel] = useState<TrainedModel | null>(null);
  const [input, setInput] = useState<Features>(DEFAULT_INPUT);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [training, setTraining] = useState(false);

  const debouncedInput = useDebouncedValue(input);

  // Load the current model once
  useEffect(() => {
    getModel().then(setModel).catch((e: Error) => setError(e.message));
  }, []);

  // Predict whenever the (debounced) input or the model changes
  useEffect(() => {
    if (!model) return;
    const controller = new AbortController();
    predict(debouncedInput, controller.signal)
      .then((p) => {
        setPrediction(p);
        setError(null);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message); // aborted = replaced by a newer request, not an error
      });
    return () => controller.abort(); // runs before the next request -> old answer can never arrive late
  }, [debouncedInput, model]);

  async function handleTrain(params: TrainParams) {
    setTraining(true);
    try {
      setModel(await train(params)); // new model -> the predict effect re-runs automatically
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTraining(false);
    }
  }

  // Node ids on the prediction path: every decision node passed + the leaf it ended in
  const activeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!prediction) return ids;
    for (const step of prediction.path) ids.add(step.nodeId);
    const last = prediction.path.at(-1);
    ids.add(last ? last.nodeId + (last.wentLeft ? "L" : "R") : "n"); // no steps = the root itself is the leaf
    return ids;
  }, [prediction]);

  // Layout only when the tree changes; highlighting is applied on top
  const flow = useMemo(() => (model ? treeToFlow(model.tree) : null), [model]);

  const nodes = useMemo(
    () => flow?.nodes.map((n) => ({ ...n, data: { ...n.data, active: activeIds.has(n.id) } })) ?? [],
    [flow, activeIds]
  );

  const edges = useMemo(
    () =>
      flow?.edges.map((e) => {
        const onPath = activeIds.has(e.source) && activeIds.has(e.target);
        return onPath ? { ...e, animated: true, style: { stroke: "#1f2430", strokeWidth: 3 } } : e;
      }) ?? [],
    [flow, activeIds]
  );

  return (
    <div className="app">
      <Dashboard
        input={input}
        onInputChange={setInput}
        prediction={prediction}
        model={model}
        onTrain={handleTrain}
        training={training}
        error={error}
      />
      <main className="graph">
        {model ? (
          // key: a new model remounts the graph, so fitView runs again for the new tree size
          <ReactFlow key={model.trainedAt} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView nodesDraggable={false}>
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <p className="status">{error ?? "Loading model…"}</p>
        )}
      </main>
    </div>
  );
}