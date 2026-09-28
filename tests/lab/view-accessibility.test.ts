import { describe, expect, it } from "vitest";

import { createTestFighter } from "../../src/content/test-fighter";
import { DEFAULT_PREFERENCES } from "../../src/lab/preferences";
import { buildLabView } from "../../src/lab/view";

function view(publicPlay = true, developerTools = false): string {
  return buildLabView({
    character: createTestFighter(),
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
  });

  it("shows the fixed four-button legend without modifier controls", () => {
    const html = view();
    expect(html).toContain("<b>↑ / Y</b> Ember Palm");
    expect(html).toContain("<b>← / X</b> Ashen Sweep");
    expect(html).toContain("<b>→ / B</b> Frost Heel");
    expect(html).toContain("<b>↓ / A</b> Phoenix Drive");
    expect(html).not.toContain("<b>SETUP</b>");
    expect(html).not.toContain("<b>POWER</b>");
    expect(html).not.toContain("<b>FINALE</b>");
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
