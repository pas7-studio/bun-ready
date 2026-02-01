import { promises as fs } from "node:fs";
import path from "node:path";

export const stableSort = <T>(arr: T[], key: (v: T) => string): T[] => {
  return [...arr].sort((a, b) => key(a).localeCompare(key(b), "en"));
};

export const readJsonFile = async <T>(p: string): Promise<T> => {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as T;
};

export const fileExists = async (p: string): Promise<boolean> => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

export const normalizeRepoPath = (p: string): string => {
  return path.resolve(process.cwd(), p);
};

export const truncateLines = (lines: string[], max: number): string[] => {
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max), `… (${lines.length - max} more lines)`];
};
