import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readlinkSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT_DIR, ROOT_ENV_PATH } from "./env.mjs";
import { LOCAL_DEV_VARS_PATH } from "./dev-secrets.mjs";
import { isLocalWranglerPortOccupied, observeProcess } from "./dev-lifecycle.mjs";

if (process.platform !== "linux") {
  throw new Error("The controlled real Wrangler smoke currently requires Linux /proc process inspection.");
}
if (existsSync(ROOT_ENV_PATH) || existsSync(LOCAL_DEV_VARS_PATH)) {
  throw new Error("Refusing the smoke test because .env or .dev.vars already exists; existing local credentials will not be overwritten.");
}

function procStatus(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const parent = status.match(/^PPid:\s+(\d+)/m);
    const argv = readFileSync(`/proc/${pid}/cmdline`).toString("utf8").split("\0").filter(Boolean);
    const cwd = readlinkSync(`/proc/${pid}/cwd`);
    return { pid, parentPid: parent ? Number.parseInt(parent[1], 10) : null, argv, cwd };
  } catch {
    return null;
  }
}

function localProcesses() {
  return readdirSync("/proc", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => procStatus(Number.parseInt(entry.name, 10)))
    .filter((entry) => entry && resolve(entry.cwd) === ROOT_DIR);
}

function isDevWrapper(entry) {
  return entry.argv.some((arg) => arg.replaceAll("\\", "/").endsWith("/scripts/dev.mjs") || arg === "scripts/dev.mjs");
}

function isWranglerDev(entry) {
  const normalized = entry.argv.map((arg) => arg.replaceAll("\\", "/").toLowerCase());
  const wrangler = normalized.findIndex((arg) => arg.endsWith("/wrangler.js") || arg.endsWith("/wrangler") || arg === "wrangler");
  if (wrangler < 0) return false;
  const tail = entry.argv.slice(wrangler + 1);
  const dev = tail.indexOf("dev");
  const port = tail.indexOf("--port", dev + 1);
  return dev >= 0 && port >= 0 && tail[port + 1] === "8788";
}

function alive(pid) {
  return observeProcess(pid)?.alive === true;
}

function childExit(child) {
  return new Promise((resolveExit) => {
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
    child.once("error", (error) => resolveExit({ error }));
  });
}

async function waitUntil(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(message);
}

const smokeValues = {
  ADMIN_USERNAME: "test-smoke-admin",
  ADMIN_PASSWORD: "test-smoke-password-131",
  ADMIN_SESSION_SECRET: "test-smoke-session-131",
};
writeFileSync(
  ROOT_ENV_PATH,
  [...Object.entries(smokeValues).map(([key, value]) => `${key}=${value}`), ""].join("\n"),
  { mode: 0o600 },
);

let wrapperPid = null;
let npmChild = null;
let output = "";
try {
  npmChild = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exit = childExit(npmChild);
  const append = (chunk) => { output = (output + chunk.toString("utf8")).slice(-16_000); };
  npmChild.stdout.on("data", append);
  npmChild.stderr.on("data", append);

  wrapperPid = await waitUntil(() => localProcesses().find(isDevWrapper)?.pid, 30_000, "npm run dev never started scripts/dev.mjs.");
  await waitUntil(() => isLocalWranglerPortOccupied(), 45_000, `npm run dev did not open port 8788.\n${output}`);

  const wrapper = procStatus(wrapperPid);
  assert.ok(wrapper && isDevWrapper(wrapper), "the process selected for SIGINT must still be the Hexframe dev wrapper");
  process.kill(wrapperPid, "SIGINT");

  const stopped = await Promise.race([
    exit,
    new Promise((resolveTimeout) => setTimeout(() => resolveTimeout({ timeout: true }), 15_000)),
  ]);
  assert.equal(stopped.timeout, undefined, `npm run dev did not exit after wrapper SIGINT.\n${output}`);
  if (stopped.error) throw stopped.error;

  await waitUntil(async () => !(await isLocalWranglerPortOccupied()), 10_000, "port 8788 remained occupied after dev wrapper shutdown");
  const leftovers = localProcesses().filter(isWranglerDev);
  assert.deepEqual(leftovers.map((entry) => ({ pid: entry.pid, argv: entry.argv })), [], "owned Wrangler descendants remained after shutdown");
  console.log("Controlled npm run dev start/SIGINT/stop smoke passed with no owned Wrangler descendant.");
} catch (error) {
  if (wrapperPid && alive(wrapperPid)) {
    const wrapper = procStatus(wrapperPid);
    if (wrapper && isDevWrapper(wrapper)) process.kill(wrapperPid, "SIGTERM");
  }
  throw new Error(`${error instanceof Error ? error.message : String(error)}${output ? `\nRecent dev output:\n${output}` : ""}`);
} finally {
  rmSync(ROOT_ENV_PATH, { force: true });
  rmSync(LOCAL_DEV_VARS_PATH, { force: true });
}
