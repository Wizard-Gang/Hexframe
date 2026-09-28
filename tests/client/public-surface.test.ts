import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderDocument } from "../../src/documents/site-documents";

const source = readFileSync(new URL("../../src/client/front-app.ts", import.meta.url), "utf8");
const frontCss = readFileSync(new URL("../../src/client/styles/front.css", import.meta.url), "utf8");
const labCss = readFileSync(new URL("../../src/client/styles/lab.css", import.meta.url), "utf8");
const labMain = readFileSync(new URL("../../src/client/lab-main.ts", import.meta.url), "utf8");
const rootHtml = renderDocument("root");
const playHtml = renderDocument("play");

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground); const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("public Hexframe surface", () => {
  it("renders useful overview and direct Training fallback before JavaScript", () => {
    expect(rootHtml).toContain("Browser fighting-game lab"); expect(rootHtml).toContain("Practice the hit."); expect(rootHtml).toContain('href="/play/"');
    expect(playHtml).toContain("Training starts here."); expect(playHtml).toContain("<code>/play/</code>"); expect(playHtml).not.toContain("data-launch-training");
    expect(rootHtml.indexOf("Browser fighting-game lab")).toBeLessThan(rootHtml.indexOf('<script type="module"'));
    expect(playHtml.indexOf("Training starts here.")).toBeLessThan(playHtml.indexOf('<script type="module"'));
  });

  it("uses the WizardGang mark and favicon across build-time documents", () => {
    expect(rootHtml).toContain('class="wizardgang-mark"'); expect(playHtml).toContain('class="wizardgang-mark"');
    for (const document of [rootHtml, playHtml]) { expect(document).toContain('rel="icon"'); expect(document).toContain("%23d9ff43"); expect(document).toContain("%23a489ff"); }
    expect(frontCss).toContain("background: #d9ff43; box-shadow: .5rem -.5rem 0 #a489ff;");
  });

  it("starts Training directly instead of enhancing a launch page", () => {
    expect(labMain).toContain("startLab(mount)"); expect(labMain).not.toContain("readGameSession"); expect(labMain).not.toContain("startFrontApp(mount)");
    expect(source).not.toContain("data.launchTraining"); expect(source).not.toContain("sessionUrl");
  });

  it("gates coarse-pointer visitors with the desktop-only support policy", () => {
    const notice = source.match(/export function desktopOnlyMarkup[\s\S]*?\n}/)?.[0] ?? "";
    expect(source).toContain('const DESKTOP_ONLY_QUERY = "(pointer: coarse), (max-width: 960px)"'); expect(notice).toContain("Desktop only."); expect(notice).toContain("Mobile and tablet support is not planned."); expect(labMain).toContain("isUnsupportedMobileDevice()");
  });

  it("uses the real Training renderer only for the overview preview", () => {
    expect(rootHtml).toContain("data-training-stage"); expect(playHtml).not.toContain("data-training-stage"); expect(source).toContain("mountTrainingStages(mount)");
  });

  it("keeps compact footer and control labels above AA text contrast", () => {
    expect(frontCss).toMatch(/\.desktop-only-gate > footer \{[^}]*color: #758089;/); expect(frontCss).toMatch(/\.overview-footer \{[^}]*color: #758089;/); expect(labCss).toMatch(/\.control-legend \{[^}]*background: #0d1115; color: #758089;/);
    expect(contrastRatio("#758089", "#07090d")).toBeGreaterThanOrEqual(4.5); expect(contrastRatio("#758089", "#0d1115")).toBeGreaterThanOrEqual(4.5);
  });

});
