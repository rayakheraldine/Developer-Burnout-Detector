import { LABELS, type Features, type Label, type Row, type TreeParams } from "./tree/types.js";
import { DEFAULT_PARAMS } from "./tree/buildTree.js";
import { HttpError } from "./errors.js";

const RANGES = {
  sleep: { min: 0, max: 24 },
  meetings: { min: 0, max: 24 },
  stress: { min: 1, max: 10 },
} as const;

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Accepts 7 or "7" (CSV values arrive as strings)
function readNumber(obj: Record<string, unknown>, key: keyof typeof RANGES, where: string): number {
  const raw = obj[key];
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `${where}: "${key}" must be a number`);
  const { min, max } = RANGES[key];
  if (n < min || n > max) throw new HttpError(400, `${where}: "${key}" must be between ${min} and ${max} (got ${n})`);
  return n;
}

// Accepts "Yes"/"No" (CSV) or true/false (a checkbox in the UI)
function readWeekends(obj: Record<string, unknown>, where: string): "Yes" | "No" {
  const raw = obj.weekends;
  if (raw === "Yes" || raw === true) return "Yes";
  if (raw === "No" || raw === false) return "No";
  throw new HttpError(400, `${where}: "weekends" must be "Yes"/"No" or true/false`);
}

function readInt(obj: Record<string, unknown>, key: string, min: number, max: number, fallback: number): number {
  const raw = obj[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new HttpError(400, `"${key}" must be an integer between ${min} and ${max}`);
  }
  return raw;
}

export function parseFeatures(body: unknown, where = "Input"): Features {
  if (!isObject(body)) throw new HttpError(400, `${where}: expected a JSON object`);
  return {
    sleep: readNumber(body, "sleep", where),
    meetings: readNumber(body, "meetings", where),
    weekends: readWeekends(body, where),
    stress: readNumber(body, "stress", where),
  };
}

export function parseRow(record: unknown, where: string): Row {
  if (!isObject(record)) throw new HttpError(400, `${where}: expected an object`);
  const status = record.status;
  if (typeof status !== "string" || !(LABELS as readonly string[]).includes(status)) {
    throw new HttpError(400, `${where}: unknown status "${String(status)}"`);
  }
  return { ...parseFeatures(record, where), status: status as Label };
}

export function parseParams(raw: unknown): TreeParams {
  if (raw === undefined) return DEFAULT_PARAMS;
  if (!isObject(raw)) throw new HttpError(400, `"params" must be an object`);

  const criterion = raw.criterion ?? DEFAULT_PARAMS.criterion;
  if (criterion !== "gini" && criterion !== "entropy") {
    throw new HttpError(400, `"criterion" must be "gini" or "entropy"`);
  }
  return {
    maxDepth: readInt(raw, "maxDepth", 0, 15, DEFAULT_PARAMS.maxDepth),
    minSamplesSplit: readInt(raw, "minSamplesSplit", 2, 10000, DEFAULT_PARAMS.minSamplesSplit),
    criterion,
  };
}