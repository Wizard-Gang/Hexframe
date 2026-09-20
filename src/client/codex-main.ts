import { DEFAULT_MOVE_LOADOUT, testFighterWithLoadout } from "../content/test-fighter";
import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_MODEL,
  TEST_FIGHTER_PLAYBACK,
  TEST_FIGHTER_RIG,
} from "../content/test-fighter-assets";
import { MoveDemonstration } from "../lab/move-demonstration";
import type { MoveDemonstrationMode, MoveDemonstrationState } from "../lab/move-demonstration";
import {
  codexMoveDetailMarkup,
  moveFamilies,
  moveName,
  moveRole,
  moveTerrain,
} from "../lab/move-presentation";
import { moveTimelineMarkup } from "../lab/inspector";
import { attachVersionBadge } from "./version-badge";
import { replaceTrustedMarkup } from "./trusted-markup";
import "./styles/codex.css";

const mountNode = document.querySelector<HTMLElement>("#codex");
if (!mountNode) throw new Error("Codex mount is missing");
const mount: HTMLElement = mountNode;

const character = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
const initialId = moveIdFromPath(window.location.pathname);
let selected = character.moves.find((move) => move.id === initialId) ?? character.moves[0];

replaceTrustedMarkup(mount, `<a class="skip-link" href="#codex-content">Skip to move Codex</a>
<main class="lab-shell codex-standalone" id="codex-content">
  <header class="lab-header debugger-header">
    <div class="brand"><p class="eyebrow">HEXFRAME / DEVELOPER / MOVE CODEX</p><h1>Authoritative move demonstrations.</h1><p>Every frame is rendered from the same authored move data and deterministic simulation used by the lab.</p></div>
    <div class="header-actions"><a class="codex-lab-link" href="/lab">← Lab</a><form method="post" action="/logout"><button type="submit">Sign out</button></form></div>
  </header>
  <section class="codex-page codex-moves-page">
    <div class="codex-moves-shell">
      <aside class="codex-move-index" aria-label="Move index">
        <label><span>SEARCH MOVES</span><input type="search" data-codex-search placeholder="Name, role, family…" aria-label="Search move Codex"></label>
        <div id="codex-move-index">${character.moves.map(moveButton).join("")}</div>
      </aside>
      <section class="codex-demonstration" aria-label="Move demonstration">
        <header class="demonstration-toolbar">
          <div class="demo-modes" role="group" aria-label="Demonstration mode">
            <button class="active" type="button" data-demo-mode="demo" aria-pressed="true">Demo</button>
            <button type="button" data-demo-mode="hit" aria-pressed="false">Hit</button>
            <button type="button" data-demo-mode="block" aria-pressed="false">Block</button>
          </div>
          <div class="demo-speed" role="group" aria-label="Playback speed"><span>PLAYBACK</span>
            <button class="active" type="button" data-demo-speed="0.5" aria-pressed="true">0.5×</button>
            <button type="button" data-demo-speed="1" aria-pressed="false">1×</button>
            <button type="button" data-demo-speed="2" aria-pressed="false">2×</button>
          </div>
        </header>
        <div class="codex-move-stage" id="codex-move-stage"></div>
        <div class="demo-transport">
          <button type="button" data-action="demo-prev" aria-label="Previous move frame">◀</button>
          <button class="primary" type="button" data-action="demo-toggle">Pause</button>
          <button type="button" data-action="demo-next" aria-label="Next move frame">▶</button>
          <label><span>FRAME <strong id="codex-frame-readout">01 / ${String(selected.duration).padStart(2, "0")}</strong></span><input id="codex-frame-scrubber" type="range" min="1" max="${selected.duration}" value="1" step="1" aria-label="Move frame"></label>
        </div>
        <output class="codex-frame-detail" id="codex-frame-detail">FRAME 01 · STARTUP</output>
        <section class="move-timeline-console codex-timeline" id="codex-move-timeline" data-codex-timeline aria-label="Interactive move frame timeline">${moveTimelineMarkup(selected)}</section>
        <article class="codex-move-detail" id="codex-move-detail">${codexMoveDetailMarkup(selected, character, DEFAULT_MOVE_LOADOUT)}</article>
      </section>
    </div>
  </section>
</main>`);

const stage = required("codex-move-stage");
const demonstration = new MoveDemonstration(stage, character, {
  model: TEST_FIGHTER_MODEL,
  rig: TEST_FIGHTER_RIG,
  animations: TEST_FIGHTER_ANIMATIONS,
  playback: TEST_FIGHTER_PLAYBACK,
}, syncUi);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
demonstration.setActive(true, !reducedMotion);
selectMove(selected.id, !reducedMotion);

let disposed = false;
function loop(now: number): void {
  if (disposed) return;
  demonstration.render(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

mount.addEventListener("click", (event) => {
  const element = event.target instanceof Element ? event.target : null;
  if (!element) return;
  const timelineFrame = element.closest<HTMLElement>("[data-codex-timeline] [data-frame]");
  if (timelineFrame?.dataset.frame !== undefined) {
    demonstration.seek(Number(timelineFrame.dataset.frame));
    return;
  }
  const move = element.closest<HTMLButtonElement>("[data-codex-move]");
  if (move?.dataset.codexMove) {
    selectMove(Number(move.dataset.codexMove), true);
    return;
  }
  const mode = element.closest<HTMLButtonElement>("[data-demo-mode]")?.dataset.demoMode as MoveDemonstrationMode | undefined;
  if (mode) {
    demonstration.setMode(mode, true);
    setPressed("[data-demo-mode]", "demoMode", mode);
    return;
  }
  const speedButton = element.closest<HTMLButtonElement>("[data-demo-speed]");
  if (speedButton?.dataset.demoSpeed) {
    const speed = Number(speedButton.dataset.demoSpeed);
    demonstration.setSpeed(speed);
    setPressed("[data-demo-speed]", "demoSpeed", String(speed));
    return;
  }
  const action = element.closest<HTMLButtonElement>("[data-action]")?.dataset.action;
  if (action === "demo-prev") demonstration.step(-1);
  if (action === "demo-toggle") demonstration.toggle();
  if (action === "demo-next") demonstration.step(1);
});

mount.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.dataset.codexSearch !== undefined) filterMoves(target.value);
  if (target.id === "codex-frame-scrubber") demonstration.seek(Number(target.value) - 1);
});

window.addEventListener("pagehide", () => {
  disposed = true;
  demonstration.dispose();
}, { once: true });

void attachVersionBadge(document.body);

function selectMove(id: number, autoplay: boolean): void {
  const move = character.moves.find((candidate) => candidate.id === id);
  if (!move) return;
  selected = move;
  demonstration.select(move.id, autoplay);
  replaceTrustedMarkup(required("codex-move-timeline"), moveTimelineMarkup(move));
  replaceTrustedMarkup(required("codex-move-detail"), codexMoveDetailMarkup(move, character, DEFAULT_MOVE_LOADOUT));
  for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-codex-move]")) {
    const active = Number(button.dataset.codexMove) === move.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "true" : "false");
  }
  const canonical = `/codex/moves/${move.id}/`;
  if (window.location.pathname !== canonical) window.history.replaceState(null, "", canonical);
}

function syncUi(state: MoveDemonstrationState): void {
  const displayFrame = state.frame + 1;
  required("codex-frame-readout").textContent = `${String(displayFrame).padStart(2, "0")} / ${String(state.move.duration).padStart(2, "0")}`;
  const scrubber = required<HTMLInputElement>("codex-frame-scrubber");
  scrubber.max = String(state.move.duration);
  scrubber.value = String(displayFrame);
  required("codex-frame-detail").textContent = `FRAME ${String(displayFrame).padStart(2, "0")} · ${state.phase.toUpperCase()}`;
  const toggle = mount.querySelector<HTMLButtonElement>("[data-action='demo-toggle']");
  if (toggle) toggle.textContent = state.playing ? "Pause" : "Play";
}

function filterMoves(query: string): void {
  const value = query.trim().toLowerCase();
  for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-codex-move]")) {
    button.hidden = value.length > 0 && !(button.dataset.codexSearchText ?? "").includes(value);
  }
}

function moveButton(move: (typeof character.moves)[number]): string {
  const search = `${moveName(move)} ${moveRole(move)} ${moveFamilies(move).join(" ")} ${moveTerrain(move)} ${move.tags.join(" ")}`.toLowerCase();
  const active = move.id === selected.id;
  return `<button type="button" class="codex-move-button${active ? " active" : ""}" data-codex-move="${move.id}" data-codex-search-text="${escapeHtml(search)}" aria-current="${active ? "true" : "false"}"><span>${String(move.id).padStart(2, "0")}</span><strong>${escapeHtml(moveName(move))}</strong><em>${moveRole(move).toUpperCase()} · ${moveTerrain(move).toUpperCase()}</em><small>${(moveFamilies(move).join(" · ") || "physical").toUpperCase()}</small></button>`;
}

function moveIdFromPath(path: string): number | null {
  const match = path.match(/^\/codex\/moves\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function setPressed(selector: string, datasetKey: "demoMode" | "demoSpeed", expected: string): void {
  for (const button of mount.querySelectorAll<HTMLButtonElement>(selector)) {
    const active = button.dataset[datasetKey] === expected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function required<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
