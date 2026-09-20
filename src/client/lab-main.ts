import { startLab } from "../lab/app";
import { readGameSession } from "../game/session";
import { collapseCampaignLoadoutMenu } from "./campaign-menu-cleanup";
import { desktopOnlyMarkup, isUnsupportedMobileDevice, startFrontApp } from "./front-app";
import { attachVersionBadge } from "./version-badge";
import { replaceTrustedMarkup } from "./trusted-markup";
import "./styles/front.css";

const mount = document.querySelector<HTMLElement>("#lab");
if (!mount) throw new Error("Game mount is missing");

let dispose = (): void => undefined;
const session = readGameSession(new URL(window.location.href));
if (isUnsupportedMobileDevice()) {
  replaceTrustedMarkup(mount, desktopOnlyMarkup());
  mount.removeAttribute("aria-busy");
} else {
  void (session ? startLab(mount) : startFrontApp(mount)).then((teardown) => {
    dispose = teardown;
    if (session) collapseCampaignLoadoutMenu(mount, session);
  });
}
void attachVersionBadge(document.body);

if (import.meta.hot) import.meta.hot.dispose(() => dispose());
