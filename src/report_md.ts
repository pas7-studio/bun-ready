import type { AnalysisResult, Severity } from "./types.js";
import { stableSort } from "./util.js";

const badge = (s: Severity): string => {
  if (s === "green") return "🟢 GREEN";
  if (s === "yellow") return "🟡 YELLOW";
  return "🔴 RED";
};

export const renderMarkdown = (r: AnalysisResult): string => {
  const lines: string[] = [];
  lines.push(`# bun-ready report`);
  lines.push(``);
  lines.push(`**Overall:** ${badge(r.severity)}`);
  lines.push(``);
  lines.push(`## Summary`);
  for (const l of r.summaryLines) lines.push(`- ${l}`);
  lines.push(``);

  lines.push(`## Repo`);
  lines.push(`- Path: \`${r.repo.packageJsonPath.replace(/\\/g, "/")}\``);
  lines.push(`- Workspaces: ${r.repo.hasWorkspaces ? "yes" : "no"}`);
  const lock: string[] = [];
  if (r.repo.lockfiles.bunLock) lock.push("bun.lock");
  if (r.repo.lockfiles.bunLockb) lock.push("bun.lockb");
  if (r.repo.lockfiles.npmLock) lock.push("package-lock.json");
  if (r.repo.lockfiles.yarnLock) lock.push("yarn.lock");
  if (r.repo.lockfiles.pnpmLock) lock.push("pnpm-lock.yaml");
  lines.push(`- Lockfiles: ${lock.length === 0 ? "none" : lock.join(", ")}`);
  lines.push(``);

  if (r.install) {
    lines.push(`## bun install (dry-run)`);
    lines.push(`- Result: ${r.install.ok ? "ok" : "failed"}`);
    lines.push(`- Summary: ${r.install.summary}`);
    if (r.install.logs.length > 0) {
      lines.push(``);
      lines.push("```text");
      for (const l of r.install.logs) lines.push(l);
      lines.push("```");
    }
    lines.push(``);
  }

  if (r.test) {
    lines.push(`## bun test`);
    lines.push(`- Result: ${r.test.ok ? "ok" : "failed"}`);
    lines.push(`- Summary: ${r.test.summary}`);
    if (r.test.logs.length > 0) {
      lines.push(``);
      lines.push("```text");
      for (const l of r.test.logs) lines.push(l);
      lines.push("```");
    }
    lines.push(``);
  }

  lines.push(`## Findings`);
  if (r.findings.length === 0) {
    lines.push(`No findings. Looks good.`);
    lines.push(``);
    return lines.join("\n");
  }

  const findings = stableSort(r.findings, (f) => `${f.severity}:${f.id}`);
  for (const f of findings) {
    lines.push(`### ${f.title} (${badge(f.severity)})`);
    lines.push(``);
    for (const d of f.details) lines.push(`- ${d}`);
    if (f.hints.length > 0) {
      lines.push(``);
      lines.push(`**Hints:**`);
      for (const h of f.hints) lines.push(`- ${h}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
};
