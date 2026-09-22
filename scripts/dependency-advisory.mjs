import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const AUDIT_ARGS = ["audit", "--json", "--audit-level=high"];

function parseAuditReport(stdout) {
  if (typeof stdout !== "string" || stdout.trim().length === 0) {
    return { ok: false, reason: "npm audit returned no JSON report" };
  }
  try {
    return { ok: true, report: JSON.parse(stdout) };
  } catch {
    return { ok: false, reason: "npm audit returned malformed JSON" };
  }
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function classifyAuditResult(result) {
  if (result?.error) {
    return {
      kind: "unavailable",
      exitCode: 2,
      message: `Dependency advisory query unavailable: ${result.error.message ?? String(result.error)}`,
    };
  }

  const parsed = parseAuditReport(result?.stdout);
  if (!parsed.ok) {
    return {
      kind: "unavailable",
      exitCode: 2,
      message: `Dependency advisory query unavailable: ${parsed.reason}.`,
    };
  }

  const report = parsed.report;
  if (report?.error || (typeof report?.message === "string" && !report?.metadata?.vulnerabilities)) {
    const summary = report?.message || report?.error?.summary || "npm registry returned an audit error";
    return {
      kind: "unavailable",
      exitCode: 2,
      message: `Dependency advisory query unavailable: ${summary}`,
    };
  }

  const counts = report?.metadata?.vulnerabilities;
  if (!counts || !validCount(counts.high) || !validCount(counts.critical)) {
    return {
      kind: "unavailable",
      exitCode: 2,
      message: "Dependency advisory query unavailable: npm audit report did not contain trustworthy high/critical counts.",
    };
  }

  const high = counts.high;
  const critical = counts.critical;
  if (high > 0 || critical > 0) {
    return {
      kind: "advisories",
      exitCode: 1,
      message: `Dependency advisory gate failed: ${high} high and ${critical} critical vulnerabilities reported.`,
    };
  }

  if (result.status !== 0) {
    return {
      kind: "unavailable",
      exitCode: 2,
      message: `Dependency advisory query unavailable: npm audit exited ${result.status} without a high/critical finding.`,
    };
  }

  return {
    kind: "clean",
    exitCode: 0,
    message: "Dependency advisory gate passed: no high or critical vulnerabilities reported.",
  };
}

export function runDependencyAdvisory({ run = spawnSync } = {}) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = run(command, AUDIT_ARGS, { encoding: "utf8" });
  const classified = classifyAuditResult(result);
  const stream = classified.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${classified.message}\n`);
  if (classified.exitCode !== 0 && typeof result?.stderr === "string" && result.stderr.trim()) {
    stream.write(`${result.stderr.trim()}\n`);
  }
  return classified.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runDependencyAdvisory();
}
