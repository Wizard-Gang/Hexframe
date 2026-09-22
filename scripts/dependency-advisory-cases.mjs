import assert from "node:assert/strict";
import test from "node:test";
import { classifyAuditResult } from "./dependency-advisory.mjs";

function report(counts = {}) {
  return JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
        ...counts,
      },
    },
  });
}

test("accepts a completed audit with no high or critical findings", () => {
  assert.deepEqual(classifyAuditResult({ status: 0, stdout: report(), stderr: "" }), {
    kind: "clean",
    exitCode: 0,
    message: "Dependency advisory gate passed: no high or critical vulnerabilities reported.",
  });
});

test("fails when a high or critical advisory is reported", () => {
  const high = classifyAuditResult({ status: 1, stdout: report({ high: 2, total: 2 }), stderr: "" });
  assert.equal(high.kind, "advisories");
  assert.equal(high.exitCode, 1);
  assert.match(high.message, /2 high and 0 critical/);

  const critical = classifyAuditResult({ status: 1, stdout: report({ critical: 1, total: 1 }), stderr: "" });
  assert.equal(critical.kind, "advisories");
  assert.equal(critical.exitCode, 1);
  assert.match(critical.message, /0 high and 1 critical/);
});

test("distinguishes a registry or network audit failure from a clean result", () => {
  const result = classifyAuditResult({
    status: 1,
    stdout: JSON.stringify({
      message: "request to registry failed, reason: connect ECONNREFUSED",
      error: { summary: "", detail: "" },
    }),
    stderr: "npm error audit endpoint returned an error",
  });
  assert.equal(result.kind, "unavailable");
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /ECONNREFUSED/);
});

test("fails closed on malformed or incomplete audit output", () => {
  for (const stdout of ["not-json", JSON.stringify({ auditReportVersion: 2 }), ""]) {
    const result = classifyAuditResult({ status: 1, stdout, stderr: "" });
    assert.equal(result.kind, "unavailable");
    assert.equal(result.exitCode, 2);
  }
});

test("treats a nonzero clean-looking audit as unavailable rather than clean", () => {
  const result = classifyAuditResult({ status: 1, stdout: report(), stderr: "unexpected failure" });
  assert.equal(result.kind, "unavailable");
  assert.equal(result.exitCode, 2);
});
