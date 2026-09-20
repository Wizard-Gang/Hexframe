import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url);
const rootPath = root.pathname;
const boundary = "src/client/trusted-markup.ts";
const sourceRoots = ["src", "index.html", "lab/index.html", "codex/index.html"];

function filesAt(path) {
  const full = join(rootPath, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => {
    const child = join(path, name);
    const childFull = join(rootPath, child);
    return statSync(childFull).isDirectory() ? filesAt(child) : [child];
  });
}

const candidates = sourceRoots.flatMap(filesAt)
  .filter((path) => /\.(?:ts|tsx|html)$/.test(path));

const sinkPatterns = [
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /\.insertAdjacentHTML\s*\(/,
  /dangerouslySetInnerHTML/,
];

for (const path of candidates) {
  const source = readFileSync(join(rootPath, path), "utf8");
  if (path !== boundary) {
    for (const pattern of sinkPatterns) {
      assert.doesNotMatch(source, pattern, `${path} uses a raw HTML sink outside ${boundary}`);
    }
  }
  assert.doesNotMatch(source, /\sstyle\s*=\s*["']/i, `${path} contains an inline style attribute`);
  assert.doesNotMatch(source, /\son[a-z]+\s*=\s*["']/i, `${path} contains an inline event handler`);
  assert.doesNotMatch(source, /['"]unsafe-inline['"]/, `${path} permits unsafe-inline`);
}

const boundarySource = readFileSync(join(rootPath, boundary), "utf8");
assert.equal((boundarySource.match(/\.innerHTML\s*=/g) ?? []).length, 1, "trusted markup boundary must own exactly one raw HTML parser sink");

for (const path of ["dist/index.html", "dist/lab/index.html", "dist/codex/index.html"]) {
  const html = readFileSync(join(rootPath, path), "utf8");
  assert.doesNotMatch(html, /\sstyle\s*=\s*["']/i, `${path} contains inline styles`);
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, `${path} contains inline event handlers`);
}

console.log("Validated presentation security boundary and built-document restrictions.");
