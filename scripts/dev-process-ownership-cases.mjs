import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedLocalWrangler } from "./dev-process-ownership.mjs";

const expected = {
  pid: 4102,
  parentPid: 4101,
  rootDir: "/work/Hexframe",
};

const owned = {
  alive: true,
  pid: 4102,
  parentPid: 4101,
  cwd: "/work/Hexframe",
  argv: [
    "/opt/node/bin/node",
    "/work/Hexframe/node_modules/npm/bin/npm-cli.js",
    "exec",
    "--",
    "wrangler",
    "dev",
    "--port",
    "8788",
  ],
};

test("accepts a live Wrangler dev child tied to this checkout", () => {
  assert.equal(isOwnedLocalWrangler(expected, owned), true);
});

test("rejects a stale process observation even when the recorded PID matches", () => {
  assert.equal(isOwnedLocalWrangler(expected, { ...owned, alive: false }), false);
});

test("rejects a live foreign process that reused the recorded PID", () => {
  assert.equal(isOwnedLocalWrangler(expected, {
    ...owned,
    parentPid: 9001,
    cwd: "/work/OtherProject",
    argv: ["/usr/bin/python3", "-m", "http.server", "8788"],
  }), false);
});

test("rejects PID-only or otherwise ambiguous ownership evidence", () => {
  assert.equal(isOwnedLocalWrangler(expected, {
    alive: true,
    pid: expected.pid,
    parentPid: expected.parentPid,
  }), false);
  assert.equal(isOwnedLocalWrangler(expected, { ...owned, argv: undefined }), false);
  assert.equal(isOwnedLocalWrangler(expected, { ...owned, cwd: undefined }), false);
});

test("rejects another Wrangler process in this checkout when parent or port evidence differs", () => {
  assert.equal(isOwnedLocalWrangler(expected, { ...owned, parentPid: expected.parentPid + 1 }), false);
  assert.equal(isOwnedLocalWrangler(expected, {
    ...owned,
    argv: [...owned.argv.slice(0, -1), "8799"],
  }), false);
});
