import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const stamp = join(root, "scripts", "version-stamp.mjs");

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const stampRepo = (cwd, env = {}) => {
  const outDir = join(cwd, "dist");
  const result = spawnSync(process.execPath, [stamp, "Fixture", outDir], {
    cwd,
    env: { ...process.env, RELEASE: "", CHANGE: "", ...env },
    encoding: "utf8",
  });
  return { result, bytes: result.status === 0 ? readFileSync(join(outDir, "version.json")) : null };
};

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "hexframe-version-"));
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "Fixture");
  git(cwd, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(cwd, ".gitignore"), "dist/\n");
  writeFileSync(join(cwd, "source.txt"), "one\n");
  git(cwd, "add", ".gitignore", "source.txt");
  git(cwd, "commit", "-q", "-m", "fixture");
  return cwd;
}

test("clean identity is byte-identical and commit-derived", async () => {
  const cwd = fixture();
  const commit = git(cwd, "rev-parse", "HEAD");
  const epoch = Number(git(cwd, "show", "-s", "--format=%ct", "HEAD"));
  const first = stampRepo(cwd);
  assert.equal(first.result.status, 0, first.result.stderr);
  await new Promise((resolve) => setTimeout(resolve, 25));
  const second = stampRepo(cwd);
  assert.equal(second.result.status, 0, second.result.stderr);
  assert.deepEqual(second.bytes, first.bytes);
  const identity = JSON.parse(first.bytes.toString("utf8"));
  assert.deepEqual(Object.keys(identity), ["product", "release", "commit", "change", "builtAt"]);
  assert.equal(identity.commit, commit);
  assert.equal(identity.release, "0.0.0-dev");
  assert.equal(identity.change, null);
  assert.equal(identity.builtAt, new Date(epoch * 1000).toISOString());
});

test("only an exact annotated tag can become release identity", () => {
  const cwd = fixture();
  git(cwd, "tag", "-a", "v1.2.3", "-m", "release");
  const exact = stampRepo(cwd);
  assert.equal(exact.result.status, 0, exact.result.stderr);
  assert.equal(JSON.parse(exact.bytes.toString("utf8")).release, "v1.2.3");

  writeFileSync(join(cwd, "source.txt"), "two\n");
  git(cwd, "add", "source.txt");
  git(cwd, "commit", "-q", "-m", "descendant");
  const descendant = stampRepo(cwd);
  assert.equal(descendant.result.status, 0, descendant.result.stderr);
  assert.equal(JSON.parse(descendant.bytes.toString("utf8")).release, "0.0.0-dev");

  const mismatched = stampRepo(cwd, { RELEASE: "v1.2.3" });
  assert.notEqual(mismatched.result.status, 0);
  assert.match(mismatched.result.stderr, /does not name checked-out commit/);
});

test("lightweight tag is not release evidence", () => {
  const cwd = fixture();
  git(cwd, "tag", "v3.0.0");
  const stamped = stampRepo(cwd);
  assert.equal(stamped.result.status, 0, stamped.result.stderr);
  assert.equal(JSON.parse(stamped.bytes.toString("utf8")).release, "0.0.0-dev");
  const requested = stampRepo(cwd, { RELEASE: "v3.0.0" });
  assert.notEqual(requested.result.status, 0);
  assert.match(requested.result.stderr, /must be an annotated tag/);
});

test("dirty checkout remains distinguishable from an exact release", () => {
  const cwd = fixture();
  git(cwd, "tag", "-a", "v2.0.0", "-m", "release");
  writeFileSync(join(cwd, "source.txt"), "dirty\n");
  const dirty = stampRepo(cwd, { RELEASE: "v2.0.0" });
  assert.equal(dirty.result.status, 0, dirty.result.stderr);
  const identity = JSON.parse(dirty.bytes.toString("utf8"));
  assert.equal(identity.release, "v2.0.0+dirty");
  assert.equal(identity.commit, git(cwd, "rev-parse", "HEAD"));
});
