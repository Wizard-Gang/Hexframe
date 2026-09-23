import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const verifier = join(root, "scripts", "release-identity.mjs");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function fixture(version = "1.2.3") {
  const cwd = mkdtempSync(join(tmpdir(), "hexframe-release-identity-"));
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "Fixture");
  git(cwd, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ version }, null, 2) + "\n");
  writeFileSync(join(cwd, "source.txt"), "one\n");
  git(cwd, "add", "package.json", "source.txt");
  git(cwd, "commit", "-q", "-m", "fixture");
  return cwd;
}

function verify(cwd, ...args) {
  return spawnSync(process.execPath, [verifier, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("exact annotated tag matching package version and HEAD passes", () => {
  const cwd = fixture();
  git(cwd, "tag", "-a", "v1.2.3", "-m", "release");
  const result = verify(cwd, "--tag", "v1.2.3", "--ref-type", "tag");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified release identity v1\.2\.3/);
});

test("non-tag workflow context is rejected", () => {
  const cwd = fixture();
  git(cwd, "tag", "-a", "v1.2.3", "-m", "release");
  const result = verify(cwd, "--tag", "v1.2.3", "--ref-type", "branch");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires a tag ref/);
});

test("malformed and lightweight tags are rejected", () => {
  const malformed = fixture();
  const malformedResult = verify(malformed, "--tag", "release-1.2.3");
  assert.notEqual(malformedResult.status, 0);
  assert.match(malformedResult.stderr, /not an exact semantic-version release tag/);

  const lightweight = fixture();
  git(lightweight, "tag", "v1.2.3");
  const lightweightResult = verify(lightweight, "--tag", "v1.2.3");
  assert.notEqual(lightweightResult.status, 0);
  assert.match(lightweightResult.stderr, /not an annotated tag/);
});

test("package and caller tag mismatches are rejected", () => {
  const cwd = fixture("1.2.4");
  git(cwd, "tag", "-a", "v1.2.3", "-m", "release");
  const packageMismatch = verify(cwd, "--tag", "v1.2.3");
  assert.notEqual(packageMismatch.status, 0);
  assert.match(packageMismatch.stderr, /does not match package version v1\.2\.4/);

  const expectedMismatch = verify(cwd, "--tag", "v1.2.3", "--expected-tag", "v1.2.4");
  assert.notEqual(expectedMismatch.status, 0);
  assert.match(expectedMismatch.stderr, /expected tag v1\.2\.4 does not match release tag v1\.2\.3/);
});

test("tagged commit must be the checked-out commit", () => {
  const cwd = fixture();
  git(cwd, "tag", "-a", "v1.2.3", "-m", "release");
  writeFileSync(join(cwd, "source.txt"), "two\n");
  git(cwd, "add", "source.txt");
  git(cwd, "commit", "-q", "-m", "descendant");
  const result = verify(cwd, "--tag", "v1.2.3");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is not tagged commit/);
});
