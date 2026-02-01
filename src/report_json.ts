import type { OverallResult } from "./types.js";

export function renderJson(r: OverallResult): string {
  return JSON.stringify(r, null, 2);
}
