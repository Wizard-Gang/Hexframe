import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const PREFIX = "HF";
const TYPES = [
  "INIT", "FEAT", "FIX", "SEC", "API", "A11Y", "I18N", "AI", "DB",
  "OPS", "TEST", "DOCS", "REFACTOR", "PERF", "BUILD", "REVERT", "CHORE",
];
const TITLE = /^\[HF-(\d{3,})\] \[(INIT|FEAT|FIX|SEC|API|A11Y|I18N|AI|DB|OPS|TEST|DOCS|REFACTOR|PERF|BUILD|REVERT|CHORE)\] (.+)$/;

export function validateHistory(entries) {
  const controlled = [];
  const malformed = [];

  for (const entry of entries) {
    if (!entry.subject.includes(`[${PREFIX}-`)) continue;
    const match = entry.subject.match(TITLE);
    if (!match) {
      malformed.push(`${entry.sha.slice(0, 12)} ${entry.subject}`);
      continue;
    }
    controlled.push({
      id: Number(match[1]),
      sha: entry.sha,
      subject: entry.subject,
    });
  }

  if (malformed.length > 0) {
    throw new Error(`Malformed controlled commit title(s):\n${malformed.join("\n")}`);
  }
  if (controlled.length === 0) {
    throw new Error(`No ${PREFIX} controlled commits found in reachable history`);
  }

  const byId = new Map();
  for (const entry of controlled) {
    const prior = byId.get(entry.id);
    if (prior) {
      throw new Error(
        `Duplicate ${PREFIX}-${String(entry.id).padStart(3, "0")}:\n` +
        `${prior.sha.slice(0, 12)} ${prior.subject}\n` +
        `${entry.sha.slice(0, 12)} ${entry.subject}`,
      );
    }
    byId.set(entry.id, entry);
  }

  const highest = Math.max(...byId.keys());
  for (let id = 1; id <= highest; id += 1) {
    if (!byId.has(id)) {
      throw new Error(
        `Controlled history is not sequential: missing ${PREFIX}-${String(id).padStart(3, "0")} before ${PREFIX}-${String(highest).padStart(3, "0")}`,
      );
    }
  }

  return highest;
}

function reachableHistory() {
  const output = execFileSync(
    "git",
    ["log", "HEAD", "--format=%H%x09%s"],
    { encoding: "utf8" },
  );

  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) throw new Error(`Unexpected git log record: ${line}`);
      return { sha: line.slice(0, tab), subject: line.slice(tab + 1) };
    });
}

function selfTest() {
  const entry = (id, type = "BUILD") => ({
    sha: String(id).padStart(40, "0"),
    subject: `[${PREFIX}-${String(id).padStart(3, "0")}] [${type}] Test controlled history`,
  });

  assert.equal(validateHistory([entry(1), entry(2), entry(3)]), 3);
  assert.throws(() => validateHistory([entry(1), entry(1)]), /Duplicate HF-001/);
  assert.throws(() => validateHistory([entry(1), entry(3)]), /missing HF-002/);
  assert.throws(
    () => validateHistory([{ sha: "a".repeat(40), subject: "[HF-002] [NOPE] Invalid type" }]),
    /Malformed controlled commit title/,
  );
  assert.throws(
    () => validateHistory([{ sha: "b".repeat(40), subject: "[HF-2] [BUILD] Invalid id" }]),
    /Malformed controlled commit title/,
  );
}

selfTest();
const highest = validateHistory(reachableHistory());
console.log(
  `Validated ${highest} sequential controlled changes through ${PREFIX}-${String(highest).padStart(3, "0")}.`,
);
