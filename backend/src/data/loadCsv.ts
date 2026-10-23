import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Row } from "../tree/types.js";
import { parseRow } from "../validation.js";
import { HttpError } from "../errors.js";

const REQUIRED_COLUMNS = ["sleep", "meetings", "weekends", "stress", "status"] as const;

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATA_PATH = path.resolve(here, "../../../data/burnout_clean.csv");

export function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());

  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) throw new HttpError(400, `CSV is missing column "${col}"`);
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;
    const cells = line.split(",").map((c) => c.trim());
    const record = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""]));
    rows.push(parseRow(record, `CSV line ${i + 1}`));
  }
  return rows;
}

export function loadCsv(filePath: string = DEFAULT_DATA_PATH): Row[] {
  return parseCsv(readFileSync(filePath, "utf-8"));
}