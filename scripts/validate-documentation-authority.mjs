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
const architecture = readFileSync(join(root, "docs/ARCHITECTURE.md"), "utf8");
const securityModel = readFileSync(join(root, "docs/SECURITY-MODEL.md"), "utf8");
const productDocs = [
  ["README.md", readme],
  ["docs/ARCHITECTURE.md", architecture],
  ["docs/SECURITY-MODEL.md", securityModel],
];
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

for (const move of ["Jab", "Sweep", "Overhead", "Uppercut"]) {
  assert.match(readme, new RegExp(move), `README must document ${move}`);
}

for (const term of ["11-bone", "FightLab", "Boneyard", "Skeleton", "Hitboxes", "Slow-mo", "Vite"]) {
  assert.match(readme, new RegExp(term, "i"), `README must document ${term}`);
}

assert.match(readme, /9d22b4be382c3eb6ddbd147970c9e5316c9bf5f2/);
assert.match(readme, /ed5547fdd5eaed4876aba1d9790685d40d948218/);
assert.match(readme, /ebf545f3c7b3bbc58bc0c3a936de154e84553371/);
assert.match(readme, /MIT-licensed/i);
assert.match(readme, /react.*react-dom/is);
assert.match(readme, /characters\/fighter\/parts\//);
assert.doesNotMatch(readme, /characters\/test_fighter\/model\.svg/);
assert.match(readme, /four short lessons|four-lesson tutorial/i);

const retiredProductClaims = [
  /public Debug toggle/i,
  /save states?/i,
  /scenario (?:capture|replay)/i,
  /replay tooling/i,
  /snapshot\/replay state/i,
  /stamina/i,
  /perfect guard/i,
  /double-tap dash/i,
  /motion inputs?/i,
  /P2 record/i,
  /randomness is seeded/i,
];

for (const [path, content] of productDocs) {
  for (const retired of retiredProductClaims) {
    assert.doesNotMatch(content, retired, `${path} describes a removed fighter-lab system: ${retired}`);
  }
}

console.log("Validated the four-document authority set, README references/commands, MVP vocabulary, and rig provenance.");
