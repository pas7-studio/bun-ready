import { test, expect } from "bun:test";
import path from "node:path";
import { analyzeRepo } from "../../src/analyze.js";

test("analyzeRepo: missing package.json -> red", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "does-not-exist");
  const r = await analyzeRepo({ repoPath, format: "md", outFile: null, runInstall: false, runTest: false, verbose: false });
  expect(r.severity).toBe("red");
});
