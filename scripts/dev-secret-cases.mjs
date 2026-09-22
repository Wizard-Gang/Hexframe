import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareLocalWrangler, writeLocalDevSecrets } from "./dev-secrets.mjs";

const values = {
  ADMIN_USERNAME: "test-admin-user",
  ADMIN_PASSWORD: "test-admin-password-127",
  ADMIN_SESSION_SECRET: "test-admin-session-secret-127",
};

function withTempDir(callback) {
  const dir = mkdtempSync(join(tmpdir(), "hexframe-dev-secrets-"));
  try { return callback(dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test("writes local Wrangler credentials to an owner-only file", () => {
  withTempDir((dir) => {
    const path = join(dir, ".dev.vars");
    writeLocalDevSecrets(values, path);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    const source = readFileSync(path, "utf8");
    for (const value of Object.values(values)) assert.ok(source.includes(value));
  });
});

test("prepares Wrangler without admin credential values in process arguments", () => {
  withTempDir((dir) => {
    const rootDir = join(dir, "checkout");
    const command = prepareLocalWrangler(values, { secretPath: join(dir, ".dev.vars"), rootDir });
    assert.equal(command.command, process.execPath);
    assert.deepEqual(command.args.slice(-3), ["dev", "--port", "8788"]);
    assert.match(command.args[0], /wrangler[\\/]bin[\\/]wrangler\.js$/);
    const argv = [command.command, ...command.args].join("\0");
    for (const value of Object.values(values)) assert.equal(argv.includes(value), false);
  });
});
