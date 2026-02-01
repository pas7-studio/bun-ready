import { spawn } from "node:child_process";

export type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const runNodeSpawn = async (cmd: string, args: string[], cwd: string): Promise<ExecResult> => {
  return await new Promise<ExecResult>((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (err += String(d)));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: out, stderr: err }));
  });
};

const runBunSpawn = async (cmd: string, args: string[], cwd: string): Promise<ExecResult> => {
  const BunAny = globalThis as unknown as { Bun?: { spawn: (argv: string[], opts: { cwd: string; stdout: "pipe"; stderr: "pipe" }) => unknown } };
  const bun = BunAny.Bun;
  if (!bun) return await runNodeSpawn(cmd, args, cwd);

  const proc = bun.spawn([cmd, ...args], { cwd, stdout: "pipe", stderr: "pipe" }) as {
    exited: Promise<number>;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
  };

  const readAll = async (s: ReadableStream<Uint8Array>): Promise<string> => {
    const r = s.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await r.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.length;
    }
    return new TextDecoder().decode(buf);
  };

  const [stdout, stderr, code] = await Promise.all([readAll(proc.stdout), readAll(proc.stderr), proc.exited]);
  return { code, stdout, stderr };
};

export const exec = async (cmd: string, args: string[], cwd: string): Promise<ExecResult> => {
  return await runBunSpawn(cmd, args, cwd);
};
