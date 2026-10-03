import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestFighter } from "../../src/content/test-fighter";
import { DEFAULT_PREFERENCES } from "../../src/lab/preferences";
import { buildLabView } from "../../src/lab/view";

const appSource = readFileSync(new URL("../../src/lab/app.ts", import.meta.url), "utf8");
const preferencesSource = readFileSync(new URL("../../src/lab/preferences.ts", import.meta.url), "utf8");

function view(debugEnabled = false): string {
  return buildLabView({ character: createTestFighter(), preferences: DEFAULT_PREFERENCES, dummyOptions: [[0, "Stand"]], debugEnabled });
}

describe("Training accessibility and Debug contract", () => {
  it("keeps the compact Training bar and seven-item pause menu semantic", () => {
    const html = view();
    for (const marker of ['aria-label="Training controls"', 'data-action="pause"', 'data-action="reset"', 'data-control="dummy"', 'data-control="speed"', 'id="debug-control"', 'role="dialog" aria-modal="true"']) expect(html).toContain(marker);
    for (const item of ["Resume", "Restart", "Start tutorial", "Move list", "Settings", "Controls", "Exit"]) expect(html).toContain(`>${item}</button>`);
    expect(html).not.toContain('role="tablist"');
  });

  it("keeps the HF-174 Debug surfaces behind one remembered toggle", () => {
    const hidden = view(false); const visible = view(true);
    expect(hidden).toContain('id="debug-tools" aria-label="Debug tools" hidden');
    expect(visible).toContain('id="debug-tools" aria-label="Debug tools" >');
    for (const surface of ["hitboxes", "hurtboxes", "pushboxes", "origins", "skeleton"]) expect(visible).toContain(`data-debug="${surface}"`);
    for (const marker of ['id="frame-readout"', 'data-action="forward"', 'data-action="forward-10"', 'data-control="pause-on-contact"', 'id="move-timeline-console"', 'id="interaction-history"']) expect(visible).toContain(marker);
    for (const removed of ['data-action="back-10"', 'data-action="back"', 'id="frame-inspector"', 'class="save-states"', 'data-save=', 'data-load=']) expect(visible).not.toContain(removed);
    expect(appSource).toContain('const DEBUG_STORAGE_KEY = "hexframe.debug.v1"');
    expect(appSource).toContain('event.code === "Backquote"');
    const toggleBody = appSource.match(/function setDebugEnabled[\s\S]*?\n  }/)?.[0] ?? "";
    expect(toggleBody).not.toContain("timeline.paused");
  });

  it("shows the fixed four-button move list with authoritative frame data", () => {
    const html = view(); const fighter = createTestFighter(); const inputs = ["↑ / Y", "← / X", "→ / B", "↓ / A"];
    fighter.commands.forEach((command, index) => {
      const move = fighter.moves.find((candidate) => candidate.id === command.moveId);
      expect(move).toBeDefined();
      expect(html).toContain(`data-move-id="${command.moveId}"`);
      expect(html).toContain(`<strong>${inputs[index]}</strong>`);
      expect(html).toContain(`<td>${move?.startup}</td><td>${move?.active}</td><td>${move?.recovery}</td>`);
      expect(html).toContain(`<td>${move?.hitboxes[0]?.damage}</td>`);
    });
  });

  it("keeps live regions, tutorial controls, and gamepad navigation hooks", () => {
    const html = view(true);
    expect(html).toContain('id="combat-announcer" role="status" aria-live="polite"');
    expect(html).toContain('id="tutorial-hud" aria-live="polite"');
    expect(html).toContain('id="tutorial-prompt" aria-labelledby="tutorial-prompt-title" hidden');
    for (const action of ["start-tutorial-prompt", "dismiss-tutorial-prompt", "next-tutorial-lesson", "exit-tutorial"]) expect(html).toContain(`data-action="${action}"`);
    expect(html).not.toContain('data-action="skip-tutorial-lesson"');
    expect(html.indexOf('id="tutorial-hud"')).toBeLessThan(html.indexOf('aria-label="Combat arena"'));
    expect(html.match(/data-gamepad-nav/g)?.length ?? 0).toBeGreaterThan(20);
  });

  it("retains only settings that still have Training behavior", () => {
    const html = view();
    for (const retired of ["Mono audio", "Music", "Ambience", "Dynamic range", "Visual quality", "Menu wrap"]) expect(html).not.toContain(retired);
    for (const retiredKey of ["music", "ambience", "mono", "dynamicRange", "quality", "menuWrap", "holdToConfirm"]) expect(preferencesSource).not.toMatch(new RegExp(`\\b${retiredKey}\\s*:`));
  });

  it("shows the unchanged fixed four-button legend", () => {
    const html = view();
    expect(html).toContain("<b>↑ / Y</b> Ember Palm");
    expect(html).toContain("<b>← / X</b> Ashen Sweep");
    expect(html).toContain("<b>→ / B</b> Frost Heel");
    expect(html).toContain("<b>↓ / A</b> Phoenix Drive");
  });
});
