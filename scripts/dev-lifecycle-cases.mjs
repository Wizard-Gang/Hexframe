import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  observeProcess,
  runLocalWrangler,
  stopOwnedProcessTree,
  waitForOwnedWrangler,
} from "./dev-lifecycle.mjs";
import { runDev } from "./dev.mjs";

const rootDir = "/work/Hexframe";

function ownedObservation(pid, parentPid = process.pid) {
  return {
    alive: true,
    pid,
    parentPid,
    cwd: rootDir,
    argv: [
      process.execPath,
      `${rootDir}/node_modules/wrangler/bin/wrangler.js`,
      "dev",
      "--port",
      "8788",
    ],
  };
}

function fakeChild(pid = 5102) {
  const child = new EventEmitter();
  child.pid = pid;
  return child;
}

async function signalCase(signal) {
  const child = fakeChild();
  const source = new EventEmitter();
  const signals = [];
  const promise = runLocalWrangler(
    { command: process.execPath, args: ["wrangler.js", "dev", "--port", "8788"] },
    {
      rootDir,
      spawnProcess: () => child,
      observe: () => ownedObservation(child.pid),
      portOccupied: async () => false,
      waitForPort: async () => {},
      waitForOwned: async () => ownedObservation(child.pid),
      waitForExit: async () => true,
      signalTree(pid, sent) {
        signals.push({ pid, signal: sent });
        child.emit("exit", null, sent);
      },
      signalSource: source,
    },
  );
  setImmediate(() => source.emit(signal));

  const result = await promise;
  assert.deepEqual(signals, [{ pid: child.pid, signal }]);
  assert.equal(result.exitCode, signal === "SIGINT" ? 130 : 143);
}

test("interrupt cleanup signals only a freshly proven owned Wrangler tree", async () => {
  await signalCase("SIGINT");
});

test("termination cleanup signals only a freshly proven owned Wrangler tree", async () => {
  await signalCase("SIGTERM");
});

test("startup failure after child creation cleans up the proven owned tree", async () => {
  const child = fakeChild();
  const signals = [];

  await assert.rejects(
    () => runLocalWrangler(
      { command: "node", args: [] },
      {
        rootDir,
        spawnProcess: () => child,
        observe: () => ownedObservation(child.pid),
        portOccupied: async () => false,
        waitForPort: async () => { throw new Error("startup probe failed"); },
        waitForOwned: async () => ownedObservation(child.pid),
        waitForExit: async () => true,
        signalTree(pid, signal) { signals.push({ pid, signal }); },
        signalSource: new EventEmitter(),
      },
    ),
    /startup probe failed/,
  );

  assert.deepEqual(signals, [{ pid: child.pid, signal: "SIGTERM" }]);
});

test("foreign occupied port is reported without spawning or signaling", async () => {
  let spawned = false;
  let signaled = false;

  await assert.rejects(
    () => runLocalWrangler(
      { command: "node", args: [] },
      {
        rootDir,
        spawnProcess() {
          spawned = true;
          return fakeChild();
        },
        portOccupied: async () => true,
        signalTree() { signaled = true; },
        signalSource: new EventEmitter(),
      },
    ),
    /occupied by an unowned\/foreign process/,
  );

  assert.equal(spawned, false);
  assert.equal(signaled, false);
});

test("stale or ambiguous ownership fails closed before any signal", async () => {
  const expected = { pid: 5102, parentPid: process.pid, rootDir };
  let signals = 0;
  const cases = [
    { ...ownedObservation(expected.pid), alive: false },
    { alive: true, pid: expected.pid, parentPid: expected.parentPid },
    { ...ownedObservation(expected.pid), parentPid: expected.parentPid + 1 },
  ];

  for (const observed of cases) {
    const result = await stopOwnedProcessTree(expected, {
      observe: () => observed,
      signalTree() { signals += 1; },
      waitForExit: async () => true,
    });
    assert.equal(result.signaled, false);
  }
  assert.equal(signals, 0);
});

test("spawned but unproven ownership never reaches a signal operation", async () => {
  const child = fakeChild();
  let signaled = false;
  await assert.rejects(
    () => runLocalWrangler(
      { command: "node", args: [] },
      {
        rootDir,
        spawnProcess: () => child,
        portOccupied: async () => false,
        waitForOwned: async () => null,
        signalTree() { signaled = true; },
        signalSource: new EventEmitter(),
      },
    ),
    /ownership could not be proven after spawn/,
  );
  assert.equal(signaled, false);
});

test("npm start path keeps skip-build behavior while dev still builds", async () => {
  const values = {
    ADMIN_USERNAME: "test-u",
    ADMIN_PASSWORD: "test-p",
    ADMIN_SESSION_SECRET: "test-s",
  };
  const builds = [];
  const shared = {
    loadRootEnv: () => values,
    requireEnv: () => {},
    run: (command, args) => builds.push([command, args]),
    prepareLocalWrangler: () => ({ command: "node", args: ["wrangler.js"] }),
    runLocalWrangler: async () => ({ exitCode: 0 }),
  };

  await runDev([], shared);
  assert.deepEqual(builds, [["npm", ["run", "build"]]]);

  builds.length = 0;
  await runDev(["--skip-build"], shared);
  assert.deepEqual(builds, []);
});

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(path, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

test(
  "real process fixture proves ownership before stopping its whole process group",
  { skip: !["linux", "darwin"].includes(process.platform) },
  async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "hexframe-owned-tree-"));
    const binDir = join(fixtureRoot, "node_modules", "wrangler", "bin");
    const childPidFile = join(fixtureRoot, "descendant.pid");
    mkdirSync(binDir, { recursive: true });
    const fixture = join(binDir, "wrangler.js");
    writeFileSync(fixture, `
      import { spawn } from "node:child_process";
      import { writeFileSync } from "node:fs";
      const marker = process.argv.indexOf("--fixture-pid-file");
      const descendant = spawn(
        process.execPath,
        ["-e", "setInterval(() => {}, 1000)"],
        { stdio: "ignore" },
      );
      writeFileSync(process.argv[marker + 1], String(descendant.pid));
      setInterval(() => {}, 1000);
    `);

    const child = spawn(
      process.execPath,
      [fixture, "dev", "--port", "8788", "--fixture-pid-file", childPidFile],
      { cwd: fixtureRoot, detached: true, stdio: "ignore" },
    );
    const expected = { pid: child.pid, parentPid: process.pid, rootDir: fixtureRoot };

    try {
      const observed = await waitForOwnedWrangler(expected, { observe: observeProcess });
      assert.ok(observed, "fixture ownership should be proven from live process evidence");
      const descendantPid = Number.parseInt(await waitForFile(childPidFile), 10);
      assert.equal(processAlive(descendantPid), true);

      const result = await stopOwnedProcessTree(expected);
      assert.equal(result.stopped, true);
      for (let attempt = 0; attempt < 50 && processAlive(descendantPid); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(
        processAlive(descendantPid),
        false,
        "owned descendant should leave with the process group",
      );
    } finally {
      if (processAlive(child.pid)) await stopOwnedProcessTree(expected);
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  },
);
