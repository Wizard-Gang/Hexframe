import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const expectedDocs = [
  "ARCHITECTURE.md",
  "CHANGE-MANAGEMENT.md",
  "RELEASE-MANAGEMENT.md",
  "SECURITY-MODEL.md",
].sort();

assert.deepEqual(
  readdirSync(join(root, "docs")).sort(),
  expectedDocs,
  "docs/ must contain only the four long-lived current authorities",
);

const retiredDocumentation = [
  "docs/LICENSING.md",
  "docs/RECONSTRUCTION.md",
  "docs/SHADOWMONEY-RETIREMENT.md",
  "docs/CONTRACTS.md",
  "docs/AI-APPLICABILITY.md",
  "docs/history",
];

for (const path of retiredDocumentation) {
  assert.equal(existsSync(join(root, path)), false, `${path} is not a current documentation authority`);
}

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

const textExtensions = new Set([".md", ".mjs", ".js", ".ts", ".tsx", ".json", ".jsonc", ".yml", ".yaml", ".css", ".html"]);
const forbiddenVocabulary = [
  ["campaign", /\bcampaign\b/i],
  ["Black Belfry", /\bBlack Belfry\b/i],
  ["Bell Warden", /\bBell Warden\b/i],
  ["armory", /\barmory\b/i],
  ["crafting", /\bcrafting\b/i],
  ["loadouts", /\bloadouts\b/i],
  ["Codex", /\bCodex\b/i],
  ["sign-in", /\bsign-in\b/i],
];

const intentionalRetirementValidators = new Set([
  "scripts/validate-documentation-authority.mjs",
  "scripts/validate-rendered-documents.mjs",
]);

for (const path of tracked) {
  if (intentionalRetirementValidators.has(path)) continue;

  for (const [label, pattern] of forbiddenVocabulary) {
    assert.doesNotMatch(path, pattern, `${path} retains retired product vocabulary: ${label}`);
  }

  if (!textExtensions.has(extname(path)) && path !== "package.json") continue;
  if (!existsSync(join(root, path))) continue;
  const source = readFileSync(join(root, path), "utf8");
  for (const [label, pattern] of forbiddenVocabulary) {
    assert.doesNotMatch(source, pattern, `${path} retains retired product vocabulary: ${label}`);
  }
}

const readme = readFileSync(join(root, "README.md"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

for (const match of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const href = match[1].trim().replace(/^<|>$/g, "");
  if (/^(?:https?:|mailto:|#)/i.test(href)) continue;
  const relative = decodeURIComponent(href.split("#", 1)[0].split("?", 1)[0]);
  if (!relative) continue;
  assert.equal(existsSync(join(root, relative)), true, `README link does not resolve: ${href}`);
}

for (const match of readme.matchAll(/npm run ([a-z0-9:_-]+)/gi)) {
  const script = match[1];
  assert.equal(
    Object.hasOwn(packageJson.scripts ?? {}, script),
    true,
    `README command references missing package script: npm run ${script}`,
  );
}

for (const move of ["Ember Palm", "Ashen Sweep", "Frost Heel", "Phoenix Drive"]) {
  assert.match(readme, new RegExp(move), `README must document ${move}`);
}

assert.match(readme, /MIT-licensed/i);
assert.match(readme, /react.*react-dom/is);
assert.match(readme, /characters\/test_fighter\/model\.svg/);
assert.match(readme, /five-lesson tutorial/i);
assert.match(readme, /public Debug toggle/i);

console.log("Validated the four-document authority set, README references/commands, and MVP vocabulary boundary.");
