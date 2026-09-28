import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateReleaseCutterWorkflow } from "./release-cutter-workflow.mjs";

const path = new URL("../.github/workflows/release-cutter.yml", import.meta.url);
const workflow = readFileSync(path, "utf8");

function replaceRequired(source, from, to) {
  assert.ok(source.includes(from), "fixture is missing expected text: " + from);
  return source.replace(from, to);
}

test("release cutter binds successful current-main CI to one annotated tag and exact-tag dispatch", () => {
  assert.deepEqual(validateReleaseCutterWorkflow(workflow), []);
});

test("stale successful CI cannot cut a release", () => {
  const changed = replaceRequired(workflow, 'if [ "$current_main" != "$VALIDATED_SHA" ]; then', 'if [ -z "$current_main" ]; then');
  assert.match(validateReleaseCutterWorkflow(changed).join("\n"), /reject stale CI heads/);
});

test("release cutter cannot degrade to a lightweight tag or broad push", () => {
  const lightweight = replaceRequired(workflow, 'git tag -a "$TAG" "$VALIDATED_SHA" -m "$TAG"', 'git tag "$TAG" "$VALIDATED_SHA"');
  assert.match(validateReleaseCutterWorkflow(lightweight).join("\n"), /annotated tag/);
  const broadPush = replaceRequired(workflow, 'git push origin "refs/tags/$TAG"', "git push origin main --tags");
  assert.match(validateReleaseCutterWorkflow(broadPush).join("\n"), /tag-only push/);
});

test("existing tag handling remains non-mutating and annotated-only", () => {
  const changed = replaceRequired(workflow, 'git cat-file -t "refs/tags/$tag"', 'git rev-parse "refs/tags/$tag"');
  assert.match(validateReleaseCutterWorkflow(changed).join("\n"), /verify an existing tag is annotated/);
});

test("release dispatch is bound to the exact candidate tag and scoped token", () => {
  const changed = replaceRequired(workflow, '-f ref="$TAG"', '-f ref="main"');
  assert.match(validateReleaseCutterWorkflow(changed).join("\n"), /exact tag ref/);
});
