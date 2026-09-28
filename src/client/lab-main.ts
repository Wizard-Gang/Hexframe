import { startLab } from "../lab/app";
import { desktopOnlyMarkup, isUnsupportedMobileDevice } from "./front-app";
import { attachVersionBadge } from "./version-badge";
import { replaceTrustedMarkup } from "./trusted-markup";
import "./styles/front.css";

const mount = document.querySelector<HTMLElement>("#lab");
if (!mount) throw new Error("Game mount is missing");

let dispose = (): void => undefined;
if (isUnsupportedMobileDevice()) {
  replaceTrustedMarkup(mount, desktopOnlyMarkup());
  mount.removeAttribute("aria-busy");
} else {
  void startLab(mount).then((teardown) => {
    dispose = teardown;
  });
}
void attachVersionBadge(document.body);

if (import.meta.hot) import.meta.hot.dispose(() => dispose());
