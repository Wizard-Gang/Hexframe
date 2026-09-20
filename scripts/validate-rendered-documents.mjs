import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const lab = readFileSync(new URL("../dist/lab/index.html", import.meta.url), "utf8");
const codex = readFileSync(new URL("../dist/codex/index.html", import.meta.url), "utf8");

assert.match(root, /Browser fighting-game lab/);
assert.match(root, /Practice the hit/);
assert.match(root, /href="\/play\/"/);
assert.match(root, /assets\/main-[^"]+\.js/);
assert.doesNotMatch(root, /\/src\/client\//);

assert.match(lab, /One stage\. One dummy\. Every frame\./);
assert.match(lab, /data-launch-training/);
assert.match(lab, /lab\/assets\/lab-[^"]+\.js/);
assert.doesNotMatch(lab, /\/src\/client\//);

assert.match(codex, /Authoritative move demonstrations/);
assert.match(codex, /codex\/assets\/codex-[^"]+\.js/);
assert.doesNotMatch(codex, /\/src\/client\//);

console.log("Validated build-time React documents and hashed client entry assets.");
