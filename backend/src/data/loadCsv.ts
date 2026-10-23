import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LABELS, type Label, type Row } from "../tree/types.js";

const REQUIRED_COLUMNS = ["sleep", "meetings", "weekends", "stress", "status"] as const;

// Path to the CSV, resolved from this file's location (not from where you run the command)
const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATA_PATH = path.resolve(here, "../../../data/burnout_clean.csv");

function isLabel(value: string): value is Label {
  return (LABELS as readonly string[]).includes(value);
}

function toNumber(value: string, column: string, lineNo: number): number {
  const n = Number(value);
  if (value === "" || Number.isNaN(n)) {
    throw new Error(`Line ${lineNo}: "${column}" is not a number (got "${value}")`);
  }
  return n;
}

export function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());

  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) throw new Error(`Missing column: "${col}"`);
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue; // skip blank lines

    const cells = line.split(",").map((c) => c.trim());
    const get = (col: string) => cells[header.indexOf(col)] ?? "";
    const lineNo = i + 1; // 1-based, header is line 1

    const weekends = get("weekends");
    if (weekends !== "Yes" && weekends !== "No") {
      throw new Error(`Line ${lineNo}: "weekends" must be Yes or No (got "${weekends}")`);
    }

    const status = get("status");
    if (!isLabel(status)) {
      throw new Error(`Line ${lineNo}: unknown status "${status}"`);
    }

    rows.push({
      sleep: toNumber(get("sleep"), "sleep", lineNo),
      meetings: toNumber(get("meetings"), "meetings", lineNo),
      weekends,
      stress: toNumber(get("stress"), "stress", lineNo),
      status,
    });
  }
  return rows;
}

export function loadCsv(filePath: string = DEFAULT_DATA_PATH): Row[] {
  return parseCsv(readFileSync(filePath, "utf-8"));
}