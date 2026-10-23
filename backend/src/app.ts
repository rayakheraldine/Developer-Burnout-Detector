import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import type { Row } from "./tree/types.js";
import { loadCsv, parseCsv } from "./data/loadCsv.js";
import { isObject, parseFeatures, parseParams, parseRow } from "./validation.js";
import { getModel, trainModel } from "./model.js";
import { predict } from "./tree/predict.js";
import { HttpError } from "./errors.js";

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Current model: tree + params + accuracy
app.get("/api/tree", (_req, res) => {
  res.json(getModel());
});

// Body: { params?, csv? (string), rows? (array) } -> no data = built-in dataset
app.post("/api/train", (req, res) => {
  const body: unknown = req.body ?? {};
  if (!isObject(body)) throw new HttpError(400, "Request body must be a JSON object");

  const params = parseParams(body.params);
  let rows: Row[];
  let source: "default" | "upload" = "upload";

  if (body.csv !== undefined) {
    if (typeof body.csv !== "string") throw new HttpError(400, `"csv" must be a string`);
    rows = parseCsv(body.csv);
  } else if (body.rows !== undefined) {
    if (!Array.isArray(body.rows)) throw new HttpError(400, `"rows" must be an array`);
    rows = body.rows.map((r, i) => parseRow(r, `Row ${i + 1}`));
  } else {
    rows = loadCsv();
    source = "default";
  }

  res.json(trainModel(rows, params, source));
});

// Body: { sleep, meetings, weekends, stress }
app.post("/api/predict", (req, res) => {
  const input = parseFeatures(req.body);
  res.json(predict(getModel().tree, input));
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Every error ends up here -> always JSON, never a crash
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large (max 5 MB)" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);