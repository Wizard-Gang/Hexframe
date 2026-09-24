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
  const match = new RegExp("^    " + key + ":\\s*(.+?)\\s*$", "m").exec(block);
  return match?.[1] ?? null;
}

function indentation(line) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function blockLines(lines, key, indent) {
  const marker = " ".repeat(indent) + key + ":";
  const start = lines.findIndex((line) => line.trimEnd() === marker);
  if (start < 0) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (indentation(line) <= indent) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function releaseTriggerFailures(workflow) {
  const failures = [];
  const lines = workflow.split("\n");
  const on = blockLines(lines, "on", 0);
  if (!on) return ["release workflow must define a trigger"];

  const events = on
    .filter((line) => line.trim() && indentation(line) === 2 && /^[A-Za-z0-9_-]+:\s*$/.test(line.trim()))
    .map((line) => line.trim().slice(0, -1));

  if (events.length !== 1 || events[0] !== "push") {
    failures.push("release workflow must be triggered only by semantic release tag pushes");
    return failures;
  }

  const push = blockLines(on, "push", 2);
  if (!push) {
    failures.push("release workflow must define the release tag push trigger");
    return failures;
  }

  if (push.some((line) => indentation(line) === 4 && /^branches(?:-ignore)?:\s*$/.test(line.trim()))) {
    failures.push("release workflow must not publish from branch pushes");
  }

  const tags = blockLines(push, "tags", 4);
  const patterns = (tags ?? [])
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().replace(/^['"]|['"]$/g, ""));

  if (patterns.length !== 1 || patterns[0] !== "v[0-9]+.[0-9]+.[0-9]+") {
    failures.push("release workflow push trigger must target only semantic vX.Y.Z tags");
  }

  return failures;
}

function hasFullHistoryCheckout(block) {
  return Boolean(block?.includes("uses: actions/checkout@") && block.includes("fetch-depth: 0"));
}

export function validateReleaseWorkflow(workflow) {
  const failures = releaseTriggerFailures(workflow);
  const reproduce = jobBlock(workflow, "reproduce");
  const deploy = jobBlock(workflow, "deploy");

  if (!reproduce) {
    failures.push("release workflow must define reproduce");
    return failures;
  }
  if (!deploy) failures.push("release workflow must define deploy");

  if (!hasFullHistoryCheckout(reproduce)) failures.push("reproduce must checkout full Git/tag history");

  const identity = 'npm run verify:release-identity -- --tag "$GITHUB_REF_NAME" --ref-type "$GITHUB_REF_TYPE" --fetch-origin';
  const install = "npm ci";
  const check = "npm run check";
  const publish = 'gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"';

  const identityIndex = reproduce.indexOf(identity);
  const installIndex = reproduce.indexOf(install);
  const checkIndex = reproduce.indexOf(check);
  const publishIndex = reproduce.indexOf(publish);

  if (identityIndex < 0) failures.push("reproduce must verify exact release identity");
  if (installIndex < 0) failures.push("reproduce must perform a clean npm ci install");
  if (checkIndex < 0) failures.push("reproduce must run canonical npm run check");
  if (publishIndex < 0) failures.push("reproduce must publish the exact existing tag with gh release create --verify-tag");

  if (identityIndex >= 0 && installIndex >= 0 && installIndex <= identityIndex) failures.push("clean npm ci must run after release identity verification");
  if (installIndex >= 0 && checkIndex >= 0 && checkIndex <= installIndex) failures.push("canonical npm run check must follow npm ci");
  if (checkIndex >= 0 && publishIndex >= 0 && publishIndex <= checkIndex) failures.push("GitHub Release publication must follow successful canonical acceptance");
  if (!reproduce.includes("GH_TOKEN: ${{ github.token }}")) failures.push("publication must use the scoped GitHub Actions token");

  if (deploy) {
    if (jobValue(deploy, "needs") !== "reproduce") failures.push("production deploy must depend on successful reproduction and publication");
    if (jobValue(deploy, "uses") !== "./.github/workflows/deploy.yml") failures.push("release workflow must delegate production to deploy.yml");
    if (!deploy.includes("tag: ${{ github.ref_name }}")) failures.push("production deploy must receive the exact release event tag");
    if (deploy.includes("runs-on:") || deploy.includes("steps:")) failures.push("release workflow must not embed production deployment steps");
  }

  return failures;
}
