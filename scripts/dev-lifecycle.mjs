import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readlinkSync } from "node:fs";
import { connect } from "node:net";
import { ROOT_DIR } from "./env.mjs";
import { isOwnedLocalWrangler, LOCAL_WRANGLER_PORT } from "./dev-process-ownership.mjs";

const STARTUP_TIMEOUT_MS = 15_000;
const OWNERSHIP_TIMEOUT_MS = 2_000;
const STOP_TIMEOUT_MS = 1_500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseProcStatus(source, name) {
  const line = source.split(/\r?\n/).find((entry) => entry.startsWith(`${name}:`));
  if (!line) return null;
  const value = Number.parseInt(line.slice(name.length + 1).trim(), 10);
  return Number.isSafeInteger(value) ? value : null;
}

function tokenizePsCommand(command) {
  return command.trim().split(/\s+/).filter(Boolean);
}

export function observeProcess(pid, { platform = process.platform } = {}) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return { alive: false, pid };

  if (platform === "linux") {
    let status;
    try {
      status = readFileSync(`/proc/${pid}/status`, "utf8");
    } catch (error) {
      return error?.code === "ENOENT" ? { alive: false, pid } : { alive: true, pid };
    }

    const parentPid = parseProcStatus(status, "PPid");
    if (!parentPid) return { alive: true, pid };

    try {
      const cwd = readlinkSync(`/proc/${pid}/cwd`);
      const argv = readFileSync(`/proc/${pid}/cmdline`).toString("utf8").split("\0").filter(Boolean);
      if (argv.length === 0) return { alive: true, pid, parentPid, cwd };
      return { alive: true, pid, parentPid, cwd, argv };
    } catch {
      return { alive: true, pid, parentPid };
    }
  }

  if (platform === "darwin") {
    const ps = spawnSync("ps", ["-ww", "-p", String(pid), "-o", "ppid=,command="], { encoding: "utf8" });
    if (ps.status !== 0 || !ps.stdout.trim()) return { alive: false, pid };
    const match = ps.stdout.trim().match(/^(\d+)\s+(.+)$/s);
    if (!match) return { alive: true, pid };

    const lsof = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" });
    const cwdLine = lsof.status === 0 ? lsof.stdout.split(/\r?\n/).find((line) => line.startsWith("n")) : null;
    if (!cwdLine) return { alive: true, pid, parentPid: Number.parseInt(match[1], 10), argv: tokenizePsCommand(match[2]) };

    return {
      alive: true,
      pid,
      parentPid: Number.parseInt(match[1], 10),
      cwd: cwdLine.slice(1),
      argv: tokenizePsCommand(match[2]),
    };
  }

  return { alive: false, pid };
}

export function signalProcessTree(pid, signal, { platform = process.platform } = {}) {
  if (platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    if (result.status !== 0) throw new Error(`Failed to stop local Wrangler process tree ${pid}.`);
    return;
  }
  process.kill(-pid, signal);
}

export async function isLocalWranglerPortOccupied({ host = "127.0.0.1", port = Number(LOCAL_WRANGLER_PORT), timeoutMs = 250 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const finish = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeoutMs, () => { socket.destroy(); reject(new Error(`Timed out while checking local Wrangler port ${port}.`)); });
    socket.once("connect", () => finish(true));
    socket.once("error", (error) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
  });
}

export async function waitForLocalWranglerPort({ timeoutMs = STARTUP_TIMEOUT_MS, pollMs = 50, portOccupied = isLocalWranglerPortOccupied } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOccupied()) return;
    await sleep(pollMs);
  }
  throw new Error(`Local Wrangler did not start on port ${LOCAL_WRANGLER_PORT} within ${timeoutMs}ms.`);
}

export async function waitForOwnedWrangler(expected, { observe = observeProcess, timeoutMs = OWNERSHIP_TIMEOUT_MS, pollMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    const observed = observe(expected.pid);
    if (isOwnedLocalWrangler(expected, observed)) return observed;
    if (observed?.alive === false) return null;
    await sleep(pollMs);
  } while (Date.now() < deadline);
  return null;
}

export async function waitForProcessExit(pid, { observe = observeProcess, timeoutMs = STOP_TIMEOUT_MS, pollMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (observe(pid)?.alive !== true) return true;
    await sleep(pollMs);
  } while (Date.now() < deadline);
  return observe(pid)?.alive !== true;
}

export async function stopOwnedProcessTree(expected, {
  signal = "SIGTERM",
  observe = observeProcess,
  signalTree = signalProcessTree,
  waitForExit = waitForProcessExit,
} = {}) {
  const sequence = signal === "SIGINT" ? ["SIGINT", "SIGTERM", "SIGKILL"]
    : signal === "SIGTERM" ? ["SIGTERM", "SIGKILL"]
      : [signal, "SIGKILL"];
  let signaled = false;

  for (const nextSignal of sequence) {
    const observed = observe(expected.pid);
    if (!isOwnedLocalWrangler(expected, observed)) {
      return { stopped: observed?.alive !== true, signaled, reason: "ownership-unproven" };
    }

    signalTree(expected.pid, nextSignal);
    signaled = true;
    if (await waitForExit(expected.pid, { observe })) {
      return { stopped: true, signaled: true, signal: nextSignal };
    }
  }

  return { stopped: false, signaled, reason: "still-running" };
}

function childOutcome(child) {
  return new Promise((resolve) => {
    child.once("error", (error) => resolve({ type: "error", error }));
    child.once("exit", (code, signal) => resolve({ type: "exit", code, signal }));
  });
}

function signalOutcome(signalSource) {
  let onInterrupt;
  let onTerminate;
  const promise = new Promise((resolve) => {
    onInterrupt = () => resolve({ type: "signal", signal: "SIGINT" });
    onTerminate = () => resolve({ type: "signal", signal: "SIGTERM" });
    signalSource.once("SIGINT", onInterrupt);
    signalSource.once("SIGTERM", onTerminate);
  });
  return {
    promise,
    dispose() {
      signalSource.off("SIGINT", onInterrupt);
      signalSource.off("SIGTERM", onTerminate);
    },
  };
}

function exitCodeForSignal(signal) {
  return signal === "SIGINT" ? 130 : 143;
}

export async function runLocalWrangler(commandSpec, {
  rootDir = ROOT_DIR,
  spawnProcess = spawn,
  observe = observeProcess,
  signalTree = signalProcessTree,
  portOccupied = isLocalWranglerPortOccupied,
  waitForPort = waitForLocalWranglerPort,
  waitForOwned = waitForOwnedWrangler,
  waitForExit = waitForProcessExit,
  signalSource = process,
} = {}) {
  if (process.platform === "win32" && observe === observeProcess) {
    throw new Error("Safe local Wrangler ownership inspection is unavailable on Windows; refusing to start an unmanaged process.");
  }

  if (await portOccupied()) {
    throw new Error(`Local Wrangler port ${LOCAL_WRANGLER_PORT} is occupied by an unowned/foreign process; refusing to signal it.`);
  }

  const child = spawnProcess(commandSpec.command, commandSpec.args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) {
    throw new Error("Local Wrangler started without a usable child PID; refusing unsafe lifecycle management.");
  }

  const expected = { pid: child.pid, parentPid: process.pid, rootDir };
  const exit = childOutcome(child);
  const owned = await waitForOwned(expected, { observe });
  if (!owned) {
    throw new Error("Local Wrangler ownership could not be proven after spawn; refusing to signal an unproven process.");
  }

  const requested = signalOutcome(signalSource);
  const stopFor = async (signal) => {
    const result = await stopOwnedProcessTree(expected, { signal, observe, signalTree, waitForExit });
    if (!result.stopped) {
      throw new Error("Local Wrangler ownership could not be proven at cleanup time; refusing further signals.");
    }
    return { exitCode: exitCodeForSignal(signal), signal };
  };

  try {
    const startup = waitForPort({ portOccupied });
    let first;
    try {
      first = await Promise.race([
        startup.then(() => ({ type: "ready" })),
        exit,
        requested.promise,
      ]);
    } catch (error) {
      const cleanup = await stopOwnedProcessTree(expected, { signal: "SIGTERM", observe, signalTree, waitForExit });
      if (!cleanup.stopped) {
        throw new Error(`${error.message} Cleanup stopped because Wrangler ownership could not be proven.`);
      }
      throw error;
    }

    if (first.type === "signal") return await stopFor(first.signal);
    if (first.type === "error") throw first.error;
    if (first.type === "exit") {
      if ((first.code ?? 1) === 0) return { exitCode: 0 };
      throw new Error(`Local Wrangler exited during startup with ${first.signal ?? `code ${first.code ?? 1}`}.`);
    }

    const outcome = await Promise.race([exit, requested.promise]);
    if (outcome.type === "signal") return await stopFor(outcome.signal);
    if (outcome.type === "error") throw outcome.error;
    return { exitCode: outcome.code ?? (outcome.signal ? 1 : 0) };
  } finally {
    requested.dispose();
  }
}
