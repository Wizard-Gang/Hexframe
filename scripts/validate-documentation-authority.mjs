import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

console.log("Validated the four-document authority set and README references/commands.");
