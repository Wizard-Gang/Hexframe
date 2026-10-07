import { FIGHTLAB_FIGHTER_ASSET, FIGHTLAB_CLIPS } from "../renderer/character/fightlab-assets";
import { FigureView } from "../renderer/character/figure-view";
import { depthProfileForClip } from "../renderer/character/fightlab-presentation";
import { SVG_NS } from "../renderer/svg/stage";
import { sampleShowreel } from "./showreel";
import { replaceTrustedMarkup } from "./trusted-markup";

const DESKTOP_ONLY_QUERY = "(pointer: coarse), (max-width: 960px)";
const WIZARDGANG_BRAND = `<span class="wizardgang-mark" aria-hidden="true"></span><span class="wizardgang-brand-copy"><strong>WIZARDGANG</strong><small>Hexframe</small></span>`;

export function isUnsupportedMobileDevice(): boolean {
  return window.matchMedia(DESKTOP_ONLY_QUERY).matches;
}

export function desktopOnlyMarkup(): string {
  return `<main class="desktop-only-gate" id="main"><a class="route-brand" href="/" aria-label="WizardGang Hexframe home">${WIZARDGANG_BRAND}</a><section role="note" aria-labelledby="desktop-only-title"><p>DEVICE SUPPORT</p><h1 id="desktop-only-title">Desktop only.</h1><p>Hexframe requires a desktop browser with a keyboard or gamepad. Mobile and tablet support is not planned.</p><div><a class="desktop-only-primary" href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">View source ↗</a><a href="https://wizardgang.ai/projects/hexframe/">Read the case study ↗</a></div></section><footer><span>WIZARD GANG · HEXFRAME</span><span>KEYBOARD + GAMEPAD</span></footer></main>`;
}

/** Enhances the build-time document with a presentation-only rig showreel. */
export async function startFrontApp(mount: HTMLElement): Promise<() => void> {
  if (isUnsupportedMobileDevice()) replaceTrustedMarkup(mount, desktopOnlyMarkup());
  mount.removeAttribute("aria-busy");
  const stage = mount.querySelector<HTMLElement>("[data-showreel]");
  const toggle = mount.querySelector<HTMLInputElement>("[data-showreel-skeleton]");
  if (!stage || !toggle) return () => undefined;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 240 180");
  svg.setAttribute("aria-hidden", "true");
  const figure = new FigureView(FIGHTLAB_FIGHTER_ASSET);
  figure.root.classList.add("fighter-p1");
  figure.place(110, 150, 1, 1.1);
  svg.appendChild(figure.root);
  stage.replaceChildren(svg);
  mount.querySelector<HTMLElement>("[data-showreel-controls]")?.removeAttribute("hidden");
  const label = mount.querySelector<HTMLElement>("[data-showreel-label]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let request = 0;
  let previous: number | null = null;

  const render = (): void => {
    const sample = sampleShowreel(FIGHTLAB_CLIPS, frame);
    const placed = figure.pose(sample.pose, 1, depthProfileForClip(figure.model.rig, sample.clip));
    figure.drawSkeleton(toggle.checked ? placed : null);
    if (label) label.textContent = sample.label;
  };
  const animate = (now: number): void => {
    if (previous !== null) frame += Math.min(now - previous, 100) * 60 / 1000;
    previous = now;
    render();
    request = window.requestAnimationFrame(animate);
  };
  const motionChanged = (): void => {
    window.cancelAnimationFrame(request);
    previous = null;
    // A predictable ready pose, including when the preference changes mid-attack.
    if (reducedMotion.matches) frame = 0;
    render();
    if (!reducedMotion.matches) request = window.requestAnimationFrame(animate);
  };
  toggle.addEventListener("change", render);
  reducedMotion.addEventListener("change", motionChanged);
  motionChanged();
  return () => {
    window.cancelAnimationFrame(request);
    toggle.removeEventListener("change", render);
    reducedMotion.removeEventListener("change", motionChanged);
  };
}
