const BASELINE_COMMIT = "7a5e351639e801999554130e346bfa65a3807585";
const BASELINE_WORKFLOW = `Wizard-Gang/baseline/.github/workflows/deploy-worker.yml@${BASELINE_COMMIT}`;

function jobBlock(workflow, jobName) {
  const jobsMarker = /^jobs:\s*$/m.exec(workflow);
  if (!jobsMarker) return null;
  const jobsText = workflow.slice(jobsMarker.index + jobsMarker[0].length);
  const start = new RegExp("^  " + jobName + ":\\s*$", "m").exec(jobsText);
  if (!start) return null;
  const afterStart = jobsText.slice(start.index + start[0].length);
  const nextJob = /^  [A-Za-z0-9_-]+:\s*$/m.exec(afterStart);
  return nextJob ? afterStart.slice(0, nextJob.index) : afterStart;
}
function jobValue(block, key) {
  if (!block) return null;
  return new RegExp("^    " + key + ":\\s*(.+?)\\s*$", "m").exec(block)?.[1] ?? null;
}
function indentation(line) { return line.match(/^ */)?.[0].length ?? 0; }
function blockLines(lines, key, indent) {
  const marker = " ".repeat(indent) + key + ":";
  const start = lines.findIndex((line) => line.trimEnd() === marker);
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (indentation(line) <= indent) { end = index; break; }
  }
  return lines.slice(start + 1, end);
}
function releaseTriggerFailures(workflow) {
  const failures = [];
  const lines = workflow.split("\n");
  const on = blockLines(lines, "on", 0);
  if (!on) return ["release workflow must define a trigger"];
  const events = on.filter((line) => line.trim() && indentation(line) === 2 && /^[A-Za-z0-9_-]+:\s*$/.test(line.trim()))
    .map((line) => line.trim().slice(0, -1));
  if (events.length !== 2 || !events.includes("push") || !events.includes("workflow_dispatch")) {
    failures.push("release workflow must accept only semantic tag push and exact-tag workflow dispatch events");
    return failures;
  }
  const push = blockLines(on, "push", 2);
  const tags = push && blockLines(push, "tags", 4);
  const patterns = (tags ?? []).map((line) => line.trim()).filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().replace(/^['"]|['"]$/g, ""));
  if (patterns.length !== 1 || patterns[0] !== "v[0-9]+.[0-9]+.[0-9]+") {
    failures.push("release workflow push trigger must target only semantic vX.Y.Z tags");
  }
  return failures;
}
export function validateReleaseWorkflow(workflow) {
  const failures = releaseTriggerFailures(workflow);
  const reproduce = jobBlock(workflow, "reproduce");
  const deploy = jobBlock(workflow, "deploy");
  if (!reproduce) return [...failures, "release workflow must define reproduce"];
  if (!deploy) return [...failures, "release workflow must define deploy"];
  if (!reproduce.includes("uses: actions/checkout@") || !reproduce.includes("fetch-depth: 0")) failures.push("reproduce must checkout full Git/tag history");
  if (!reproduce.includes('case "$GITHUB_EVENT_NAME" in')) failures.push("reproduce must guard the release event");
  if (!reproduce.includes("push|workflow_dispatch)")) failures.push("reproduce must allow only tag push or exact-tag workflow dispatch");
  if (!reproduce.includes('[ "$GITHUB_REF_TYPE" = "tag" ]')) failures.push("reproduce must require a tag ref");
  if (!reproduce.includes('[ "$GITHUB_REF" = "refs/tags/$GITHUB_REF_NAME" ]')) failures.push("reproduce must bind the exact tag ref");
  const identity = 'npm run verify:release-identity -- --tag "$GITHUB_REF_NAME" --ref-type "$GITHUB_REF_TYPE" --fetch-origin';
  const order = [identity, "npm ci", "npm run check", 'gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"']
    .map((needle) => reproduce.indexOf(needle));
  if (order[0] < 0) failures.push("reproduce must verify exact release identity");
  if (order[1] < 0) failures.push("reproduce must perform a clean npm ci install");
  if (order[2] < 0) failures.push("reproduce must run canonical npm run check");
  if (order[3] < 0) failures.push("reproduce must publish the exact existing tag with gh release create --verify-tag");
  if (order.every((value) => value >= 0) && !(order[0] < order[1] && order[1] < order[2] && order[2] < order[3])) failures.push("release identity, clean install, canonical check and publication must remain ordered");
  if (!reproduce.includes("GH_TOKEN: ${{ github.token }}")) failures.push("publication must use the scoped GitHub Actions token");
  if (jobValue(deploy, "needs") !== "reproduce") failures.push("production deploy must depend on successful reproduction and publication");
  if (jobValue(deploy, "uses") !== BASELINE_WORKFLOW) failures.push("release workflow must call the pinned baseline deploy-worker workflow");
  if (!deploy.includes("worker: hexframe")) failures.push("baseline deploy must target worker hexframe");
  if (!deploy.includes("tag: ${{ github.ref_name }}")) failures.push("baseline deploy must receive the exact release event tag");
  if (!deploy.includes("expected_sha: ${{ github.sha }}")) failures.push("baseline deploy must receive the exact tagged commit");
  if (!deploy.includes("secrets: inherit")) failures.push("baseline deploy must inherit the caller's protected environment secret");
  if (deploy.includes("runs-on:") || deploy.includes("steps:")) failures.push("release workflow must not embed production deployment steps");
  return failures;
}
export { BASELINE_COMMIT, BASELINE_WORKFLOW };
