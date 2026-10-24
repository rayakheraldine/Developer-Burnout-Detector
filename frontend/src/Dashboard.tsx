import { useEffect, useState } from "react";
import type { Features, Prediction, TrainedModel, TrainParams } from "./types";
import { CLASS_COLORS } from "./colors";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit = "", onChange }: SliderProps) {
  return (
    <label className="field">
      <div className="field-head">
        <span>{label}</span>
        <b>{value}{unit}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface DashboardProps {
  input: Features;
  onInputChange: (input: Features) => void;
  prediction: Prediction | null;
  model: TrainedModel | null;
  onTrain: (params: TrainParams) => void;
  training: boolean;
  error: string | null;
}

export function Dashboard({ input, onInputChange, prediction, model, onTrain, training, error }: DashboardProps) {
  const [maxDepth, setMaxDepth] = useState(3);
  const [criterion, setCriterion] = useState<"gini" | "entropy">("gini");
  // Keep the controls in sync with the model that's actually loaded
    useEffect(() => {
        if (model) {
        setMaxDepth(model.params.maxDepth);
        setCriterion(model.params.criterion);
        }
    }, [model]);

  // Update one field, keep the others
  const set = <K extends keyof Features>(key: K, value: Features[K]) => onInputChange({ ...input, [key]: value });

  const total = prediction ? Object.values(prediction.leafCounts).reduce((a, b) => a + b, 0) : 0;
  const confidence = prediction ? Math.max(...Object.values(prediction.leafCounts)) / total : 0;
  const color = prediction ? CLASS_COLORS[prediction.prediction] : "#999";

  return (
    <aside className="panel">
      <h1>Burnout Detector</h1>

      <section>
        <h2>Your day</h2>
        <Slider label="Sleep" value={input.sleep} min={0} max={12} step={0.5} unit=" h" onChange={(v) => set("sleep", v)} />
        <Slider label="Meetings per day" value={input.meetings} min={0} max={12} step={1} onChange={(v) => set("meetings", v)} />
        <Slider label="Stress level" value={input.stress} min={1} max={10} step={0.1} unit=" / 10" onChange={(v) => set("stress", v)} />
        <label className="checkbox">
          <input type="checkbox" checked={input.weekends} onChange={(e) => set("weekends", e.target.checked)} />
          I work on weekends
        </label>
      </section>

      <section className="verdict" style={{ borderColor: color, background: `${color}18` }}>
        <div className="verdict-label">Verdict</div>
        <div className="verdict-value" style={{ color }}>{prediction?.prediction ?? "…"}</div>
        {prediction && (
          <div className="verdict-sub">
            {Math.round(confidence * 100)}% of similar training cases
            {confidence < 0.7 && <span className="close-call"> · ⚠ close call</span>}
          </div>
        )}
      </section>

      {error && <div className="error">{error}</div>}

      <section>
        <h2>Model</h2>
        <Slider label="Max depth" value={maxDepth} min={1} max={8} step={1} onChange={setMaxDepth} />
        <label className="field">
          <div className="field-head"><span>Split criterion</span></div>
          <select value={criterion} onChange={(e) => setCriterion(e.target.value as "gini" | "entropy")}>
            <option value="gini">Gini impurity</option>
            <option value="entropy">Entropy</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => onInputChange({ sleep: 7, meetings: 3, stress: 5, weekends: false })}
        >
          Reset
        </button>

        <button
          disabled={training}
          onClick={() => onTrain({ maxDepth, criterion, minSamplesSplit: model?.params.minSamplesSplit ?? 20 })}
        >
          {training ? "Training…" : "Retrain"}
        </button>
        {model && (
          <p className="stats">
            Test accuracy <b>{(model.testAccuracy * 100).toFixed(1)}%</b> · train {(model.trainAccuracy * 100).toFixed(1)}%
            <br />
            {model.trainSize} training rows · {model.testSize} test rows
          </p>
        )}
      </section>
    </aside>
  );
}