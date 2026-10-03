import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderDocument } from "../../src/documents/site-documents";

const source = readFileSync(new URL("../../src/client/front-app.ts", import.meta.url), "utf8");
const frontCss = readFileSync(new URL("../../src/client/styles/front.css", import.meta.url), "utf8");
const labMain = readFileSync(new URL("../../src/client/lab-main.ts", import.meta.url), "utf8");
const rootHtml = renderDocument("root");
const playHtml = renderDocument("play");


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


});
