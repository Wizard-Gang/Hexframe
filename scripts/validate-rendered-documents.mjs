import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const play = readFileSync(new URL("../dist/play/index.html", import.meta.url), "utf8");

assert.match(root, /A rigged fighting-game proof of concept/);
assert.match(root, /Small game/);
assert.doesNotMatch(root, /deterministic|replay|frame tools/i);
assert.match(root, /One rig. Four attacks./);
assert.match(root, /href="\/play\/"/);
assert.match(root, /assets\/main-[^"]+\.js/);
assert.doesNotMatch(root, /\/src\/client\//);

assert.match(play, /Training starts here\./);
assert.doesNotMatch(play, /data-launch-training/);
assert.match(play, /play\/assets\/play-[^"]+\.js/);
assert.doesNotMatch(play, /\/src\/client\//);

assert.equal(existsSync(new URL("../dist/codex/index.html", import.meta.url)), false, "retired Codex document must not be built");

console.log("Validated build-time React documents and hashed client entry assets.");
