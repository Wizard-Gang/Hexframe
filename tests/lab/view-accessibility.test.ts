import { describe, expect, it } from "vitest";

import { DEFAULT_MOVE_LOADOUT, testFighterWithBuild } from "../../src/content/test-fighter";
import { createDefaultBuildState } from "../../src/lab/build-state";
import { DEFAULT_PREFERENCES } from "../../src/lab/preferences";
import { buildLabView } from "../../src/lab/view";

function view(publicPlay = true, developerTools = false): string {
  const buildState = createDefaultBuildState();
  return buildLabView({
    character: testFighterWithBuild(DEFAULT_MOVE_LOADOUT, buildState.presets[0].equipment),
    buildState,
    preferences: DEFAULT_PREFERENCES,
    dummyOptions: [[0, "Stand"]],
    publicPlay,
    developerTools,
  });
}

describe("lab accessibility contract", () => {
  it("keeps ordinary Training controls, frame tools, settings and live regions semantic", () => {
    const html = view();
    expect(html).toContain('class="lab-shell public-play"');
    expect(html).toContain("Hit. Pause. Inspect.");
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html.match(/role="tablist"/g)).toHaveLength(2);
    expect(html).toContain('id="page-training"');
    expect(html).toContain('id="page-settings"');
    expect(html).toContain('id="combat-announcer" role="status" aria-live="polite"');
    expect(html).toContain('aria-label="Frame transport controls"');
    expect(html).toContain('id="frame-inspector"');
    expect(html).toContain('id="move-timeline-console"');
    expect(html).toContain('id="interaction-history"');
    expect(html).toContain('data-action="scenario-capture"');
    expect(html).toContain("Pause on contact");
    expect(html).toContain("Audio captions");
    expect(html).toContain("Combat flashes");
    expect(html).toContain("Status patterns");
    expect(html).toContain("Strong focus indicator");
  });

  it("does not render the retired editor and reference pages", () => {
    const html = view();
    for (const id of ["page-loadout", "page-armor", "page-craft", "page-moves", "page-status", "page-codex-equipment", "page-stages", "page-enemies", "page-tutorial", "page-profile", "page-credits"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    expect(html).not.toContain("Extra confirmation for crafting");
    expect(html).not.toContain("Press any button");
  });

  it("keeps developer tools inline without exposing the developer tab publicly", () => {
    const publicHtml = view();
    expect(publicHtml).not.toContain('data-menu-tab="debug"');
    expect(publicHtml).not.toContain('class="frame-console"');
    expect(publicHtml).not.toContain('action="/logout"');

    const developerHtml = view(false, true);
    expect(developerHtml).toContain("Combat operating system.");
    expect(developerHtml).toContain('class="frame-console"');
    expect(developerHtml).toContain('class="geometry-controls"');
    expect(developerHtml).toContain('data-menu-tab="debug"');
    expect(developerHtml).toContain('action="/logout"');
    expect(developerHtml).toContain('id="debug-panel"');
  });

  it("keeps the tutorial HUD and its lesson controls in the Training document", () => {
    const html = view();
    expect(html).toContain('id="tutorial-hud"');
    expect(html).toContain('data-action="skip-tutorial-lesson"');
    expect(html).toContain('data-action="next-tutorial-lesson"');
    expect(html).toContain('data-action="exit-tutorial"');
  });
});
