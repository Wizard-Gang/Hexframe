import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const helper = join(root, "scripts", "check-patch-integrity.mjs");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function runHelper(cwd, env = {}) {
  return spawnSync(process.execPath, [helper], {
    cwd,
    env: {
      ...process.env,
      PATCH_BASE_SHA: "",
      PATCH_HEAD_SHA: "",
      ...env,
    },
    encoding: "utf8",
  });
}

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "hexframe-patch-"));
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "Fixture");
  git(cwd, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(cwd, "source.txt"), "base\n");
  git(cwd, "add", "source.txt");
  git(cwd, "commit", "-q", "-m", "base");
  const base = git(cwd, "rev-parse", "HEAD");
  writeFileSync(join(cwd, "source.txt"), "base\nclean\n");
  git(cwd, "add", "source.txt");
  git(cwd, "commit", "-q", "-m", "clean head");
  return { cwd, base, head: git(cwd, "rev-parse", "HEAD") };
}

test("clean committed range passes", () => {
  const { cwd, base, head } = fixture();
  const result = runHelper(cwd, { PATCH_BASE_SHA: base, PATCH_HEAD_SHA: head });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Patch integrity passed for ${base}\\.\\.${head}`));
});

test("committed trailing whitespace in the supplied range fails", () => {
  const { cwd, head } = fixture();
  writeFileSync(join(cwd, "source.txt"), "base\nclean\nbad   \n");
  git(cwd, "add", "source.txt");
  git(cwd, "commit", "-q", "-m", "bad whitespace");
  const bad = git(cwd, "rev-parse", "HEAD");
  const result = runHelper(cwd, { PATCH_BASE_SHA: head, PATCH_HEAD_SHA: bad });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /trailing whitespace/);
  assert.match(result.stderr, /Patch integrity failed/);
});

test("explicit committed range does not silently substitute working-tree state", () => {
  const { cwd, base, head } = fixture();
  writeFileSync(join(cwd, "source.txt"), "base\nclean\nworking tree defect   \n");
  const result = runHelper(cwd, { PATCH_BASE_SHA: base, PATCH_HEAD_SHA: head });
  assert.equal(result.status, 0, result.stderr);
});

test("missing or invalid explicit range context fails clearly", () => {
  const { cwd, base, head } = fixture();
  const missing = runHelper(cwd, { PATCH_BASE_SHA: base });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /must be provided together/);

  const invalid = runHelper(cwd, { PATCH_BASE_SHA: "deadbeef", PATCH_HEAD_SHA: head });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /PATCH_BASE_SHA does not name a commit/);
});

test("no explicit range is a credential-free no-guess local mode", () => {
  const { cwd } = fixture();
  const result = runHelper(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No explicit committed patch range supplied/);
});

test("PR CI supplies exact base and head to canonical check with no duplicate diff owner", () => {
  const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const checkStart = ci.indexOf("- name: Check");
  const checkEnd = ci.indexOf("- name: Dependency advisory (network)");
  assert.ok(checkStart >= 0 && checkEnd > checkStart);
  const checkStep = ci.slice(checkStart, checkEnd);
  assert.match(checkStep, /PATCH_BASE_SHA:\s*\$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(checkStep, /PATCH_HEAD_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(checkStep, /run:\s*npm run check/);
  assert.equal((ci.match(/git diff --check/g) ?? []).length, 0);
  assert.equal((ci.match(/npm run check:patch-integrity/g) ?? []).length, 0);
  assert.equal((pkg.scripts.check.match(/npm run check:patch-integrity/g) ?? []).length, 1);
});
