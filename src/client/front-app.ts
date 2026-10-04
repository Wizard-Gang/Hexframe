import { px } from "../combat/constants";
import { Simulation } from "../combat/simulation/simulation";
import { createTestFighter } from "../content/test-fighter";
import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_MODEL,
  TEST_FIGHTER_PLAYBACK,
  TEST_FIGHTER_RIG,
} from "../content/test-fighter-assets";
import { STAGE_CATALOG } from "../game/session";
import { Renderer } from "../renderer/svg/renderer";
import { replaceTrustedMarkup } from "./trusted-markup";


const DESKTOP_ONLY_QUERY = "(pointer: coarse), (max-width: 960px)";
const WIZARDGANG_BRAND = `<span class="wizardgang-mark" aria-hidden="true"></span><span class="wizardgang-brand-copy"><strong>WIZARDGANG</strong><small>Hexframe</small></span>`;

export function isUnsupportedMobileDevice(): boolean {
  return window.matchMedia(DESKTOP_ONLY_QUERY).matches;
}

export function desktopOnlyMarkup(): string {
  return `<main class="desktop-only-gate" id="main"><a class="route-brand" href="/" aria-label="WizardGang Hexframe home">${WIZARDGANG_BRAND}</a><section role="note" aria-labelledby="desktop-only-title"><p>DEVICE SUPPORT</p><h1 id="desktop-only-title">Desktop only.</h1><p>Hexframe requires a desktop browser with a keyboard or gamepad. Mobile and tablet support is not planned.</p><div><a class="desktop-only-primary" href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">View source ↗</a><a href="https://wizardgang.ai/projects/hexframe/">Read the case study ↗</a></div></section><footer><span>WIZARD GANG · HEXFRAME</span><span>KEYBOARD + GAMEPAD</span></footer></main>`;
}

/** Enhances the build-time overview with the live Training renderer. */
export async function startFrontApp(mount: HTMLElement): Promise<() => void> {
  if (isUnsupportedMobileDevice()) replaceTrustedMarkup(mount, desktopOnlyMarkup());
  mount.removeAttribute("aria-busy");

  const previewRenderers = mountTrainingStages(mount);
  return () => {
    for (const renderer of previewRenderers) renderer.dispose();
  };
}

function mountTrainingStages(mount: HTMLElement): Renderer[] {
  const renderers: Renderer[] = [];
  for (const stageMount of mount.querySelectorAll<HTMLElement>("[data-training-stage]")) {
    const player = createTestFighter();
    const dummy = createTestFighter();
    const stage = STAGE_CATALOG["training-grid"].stage;
    const simulation = new Simulation({
      characters: [player, dummy],
      startX: [px(-105), px(105)],
      stage,
    });
    const fighter = {
      model: TEST_FIGHTER_MODEL,
      rig: TEST_FIGHTER_RIG,
      animations: TEST_FIGHTER_ANIMATIONS,
      playback: TEST_FIGHTER_PLAYBACK,
      presentationScale: 1.45,
    };
    const renderer = new Renderer(stageMount, [player, dummy], { fighters: [fighter, fighter], stage });
    renderer.render(simulation.getState(), false, false);
    const svg = stageMount.querySelector("svg");
    svg?.setAttribute("aria-hidden", "true");
    svg?.removeAttribute("role");
    renderers.push(renderer);
  }
  return renderers;
}
