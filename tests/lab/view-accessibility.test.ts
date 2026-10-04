import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestFighter } from "../../src/content/test-fighter";
import { DEFAULT_PREFERENCES } from "../../src/lab/preferences";
import { buildLabView } from "../../src/lab/view";

const appSource = readFileSync(new URL("../../src/lab/app.ts", import.meta.url), "utf8");
const preferencesSource = readFileSync(new URL("../../src/lab/preferences.ts", import.meta.url), "utf8");
const figureSource = readFileSync(new URL("../../src/renderer/character/figure-view.ts", import.meta.url), "utf8");
const overlaySource = readFileSync(new URL("../../src/renderer/svg/debug-overlay.ts", import.meta.url), "utf8");

function view(hitboxesEnabled = false, slowMotionEnabled = false, skeletonEnabled = false): string {
  return buildLabView({ character: createTestFighter(), preferences: DEFAULT_PREFERENCES, dummyOptions: [[0, "Stand"]], hitboxesEnabled, slowMotionEnabled, skeletonEnabled });
}

describe("Training accessibility and study controls", () => {
  it("keeps the compact Training bar and seven-item pause menu semantic", () => {
    const html = view();
    for (const marker of ['aria-label="Training controls"', 'data-action="pause"', 'data-action="reset"', 'data-control="dummy"', 'data-action="skeleton"', 'data-action="slow-mo"', 'data-action="hitboxes"', 'role="dialog" aria-modal="true"']) expect(html).toContain(marker);
    for (const item of ["Resume", "Restart", "Start tutorial", "Move list", "Settings", "Controls", "Exit"]) expect(html).toContain(`>${item}</button>`);
    for (const removed of ['data-control="speed"', 'id="debug-control"', 'id="debug-tools"', 'data-action="forward"', 'data-action="forward-10"', 'data-control="pause-on-contact"', 'id="move-timeline-console"', 'id="interaction-history"']) expect(html).not.toContain(removed);
    expect(html).not.toContain('role="tablist"');
    expect(appSource).toContain('[DummyMode.Stand, "Stand"]');
    expect(appSource).toContain('[DummyMode.Block, "Block"]');
    expect(appSource).toContain('[DummyMode.FightBack, "Fight back"]');
    for (const removed of [
      "DummyMode.Crouch", "DummyMode.Jump", "DummyMode.BlockNone",
      "DummyMode.BlockAll", "DummyMode.BlockAfterFirstHit", "DummyMode.Record",
      "DummyMode.Playback", "DummyMode.Counterattack", "DummyMode.Reversal",
    ]) expect(appSource).not.toContain(removed);
  });

  it("remembers Skeleton, Hitboxes and Slow-mo while deleting the old Debug drawing paths", () => {
    const off = view(false, false, false);
    const on = view(true, true, true);
    expect(off).toContain('data-action="skeleton" data-gamepad-nav aria-pressed="false"');
    expect(off).toContain('data-action="hitboxes" data-gamepad-nav aria-pressed="false"');
    expect(off).toContain('data-action="slow-mo" data-gamepad-nav aria-pressed="false"');
    expect(on).toContain('data-action="skeleton" data-gamepad-nav aria-pressed="true"');
    expect(on).toContain('data-action="hitboxes" data-gamepad-nav aria-pressed="true"');
    expect(on).toContain('data-action="slow-mo" data-gamepad-nav aria-pressed="true"');
    expect(appSource).toContain('const TRAINING_VIEW_STORAGE_KEY = "hexframe.training.view.v1"');
    expect(appSource).toContain('localStorage.setItem(TRAINING_VIEW_STORAGE_KEY, JSON.stringify(state))');
    expect(appSource).toContain('event.code === "Backquote"');
    expect(appSource).toContain('timeline.speed = enabled ? 25 : 100');
    expect(figureSource).not.toContain("bone-name");
    expect(overlaySource).not.toContain("debug-origin");
    expect(overlaySource).not.toContain("debug-velocity");
    for (const volume of ["debug-hitbox", "debug-hurtbox", "debug-pushbox"]) expect(overlaySource).toContain(volume);
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
    for (const retired of ["Mono audio", "Music", "Ambience", "Dynamic range", "Visual quality", "Menu wrap", "Particles", "Combat flashes", "Damage numbers"]) expect(html).not.toContain(retired);
    for (const retiredKey of ["music", "ambience", "mono", "dynamicRange", "quality", "menuWrap", "holdToConfirm", "particles", "combatFlashes", "damageNumbers"]) expect(preferencesSource).not.toMatch(new RegExp(`\\b${retiredKey}\\s*:`));
  });

  it("shows the unchanged fixed four-button legend", () => {
    const html = view();
    expect(html).toContain("<b>↑ / Y</b> Jab");
    expect(html).toContain("<b>← / X</b> Sweep");
    expect(html).toContain("<b>→ / B</b> Overhead");
    expect(html).toContain("<b>↓ / A</b> Uppercut");
  });
});
