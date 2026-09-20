import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const retired = [
  "docs/RECONSTRUCTION.md",
  "docs/SHADOWMONEY-RETIREMENT.md",
  "docs/CONTRACTS.md",
  "docs/history",
];

for (const path of retired) {
  assert.equal(existsSync(join(root, path)), false, `${path} is retired; Git/GitHub is the historical authority`);
}

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

const textExtensions = new Set([".md", ".mjs", ".js", ".ts", ".tsx", ".json", ".jsonc", ".yml", ".yaml"]);
const forbiddenReferences = [
  "docs/RECONSTRUCTION.md",
  "docs/SHADOWMONEY-RETIREMENT.md",
  "docs/CONTRACTS.md",
  "docs/history/",
  "CHANGE-MAP.csv",
];

for (const path of tracked) {
  if (path === "scripts/validate-documentation-authority.mjs") continue;
  if (!textExtensions.has(extname(path)) && path !== "package.json") continue;
  const source = readFileSync(join(root, path), "utf8");
  for (const retiredReference of forbiddenReferences) {
    assert.equal(
      source.includes(retiredReference),
      false,
      `${path} still references retired documentation authority ${retiredReference}`,
    );
  }
}

const securityModel = readFileSync(join(root, "docs/SECURITY-MODEL.md"), "utf8");
assert.match(securityModel, /Predecessor state and recovery boundary/);
assert.match(securityModel, /predecessor saves are not retained or recoverable/i);
assert.match(securityModel, /rollback targets are valid immutable Hexframe release tags only/i);

const ai = readFileSync(join(root, "docs/AI-APPLICABILITY.md"), "utf8");
assert.doesNotMatch(ai, /no runtime dependencies at all/i);

const licensing = readFileSync(join(root, "docs/LICENSING.md"), "utf8");
assert.match(licensing, /react.*react-dom/is);

console.log("Validated current-state documentation authority and retired historical carriers.");
