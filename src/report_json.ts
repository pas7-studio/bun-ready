import type { AnalysisResult } from "./types.js";

export const renderJson = (r: AnalysisResult): string => {
  return JSON.stringify(r, null, 2);
};
