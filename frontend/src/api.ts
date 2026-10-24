import type { Features, Prediction, TrainedModel, TrainParams } from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// Shared fetch wrapper: turns the backend's { error } JSON into a thrown Error with that message
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null); // body might not be JSON (e.g. server down)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
  return body as T;
}

export const getModel = () => request<TrainedModel>("/api/tree");

export const predict = (input: Features, signal?: AbortSignal) =>
  request<Prediction>("/api/predict", { method: "POST", body: JSON.stringify(input), signal });

export const train = (params: TrainParams) =>
  request<TrainedModel>("/api/train", { method: "POST", body: JSON.stringify({ params }) });