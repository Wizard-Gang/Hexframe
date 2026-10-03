import { replaceTrustedMarkup } from "../client/trusted-markup";
import { px } from "../combat/constants";
import type { FighterState, FrameReport, SimConfig } from "../combat/types";
import { ContactKind, DebuffEventKind, DebuffKind } from "../combat/types";
import { Simulation } from "../combat/simulation/simulation";
import { createTestFighter } from "../content/test-fighter";
import { TEST_FIGHTER_ANIMATIONS, TEST_FIGHTER_MODEL, TEST_FIGHTER_PLAYBACK, TEST_FIGHTER_RIG } from "../content/test-fighter-assets";
import { STATUS_RULES } from "../content/status-rules";
import { gameAudio } from "../client/audio/audio-manager";
import { GamepadController } from "../input/controller/gamepad";
import type { GamepadUiState } from "../input/controller/gamepad";
import { KeyboardController } from "../input/controller/keyboard";
import { DEFAULT_ACTION_KEYMAP, DEFAULT_KEYMAP_P1, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP } from "../input/controller/keymap";
import { hashState } from "../rollback/hashing/fnv";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";
import { DummyController, DummyMode } from "./dummy/dummy";
import type { DummyModeValue } from "./dummy/dummy";
import { applyPreferences, loadPreferences, persistPreferences, resetPreferences } from "./preferences";
import type { LabPreferences } from "./preferences";
import { Timeline } from "./timeline/timeline";
import type { LabSpeed } from "./timeline/timeline";
import { frameInspectorMarkup, interactionHistoryMarkup, moveTimelineMarkup } from "./inspector";
import type { InteractionSelection } from "./inspector";
import { buildLabView } from "./view";
import { markTutorialPromptSeen, tutorialPromptSeen, tutorialRequested, TutorialController } from "./tutorial";
import type { TutorialSnapshot } from "./tutorial";
import { STAGE_CATALOG } from "../game/session";

const FRAME_MS = 1000 / 60;
const DEBUG_STORAGE_KEY = "hexframe.debug.v1";
const NO_DEBUG_TOGGLES: DebugToggles = { hitboxes: false, hurtboxes: false, pushboxes: false, origins: false, skeleton: false, boneNames: false, velocity: false };
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])";

const DUMMY_OPTIONS: readonly [DummyModeValue, string][] = [
  [DummyMode.Stand, "Stand"], [DummyMode.Crouch, "Crouch"], [DummyMode.Jump, "Jump"],
  [DummyMode.BlockNone, "Block none"], [DummyMode.BlockAll, "Block all"],
  [DummyMode.BlockAfterFirstHit, "Block after first hit"], [DummyMode.Record, "Record P2"],
  [DummyMode.Playback, "Playback"], [DummyMode.Counterattack, "Counterattack"],
  [DummyMode.Reversal, "Reversal"],
];

type MenuDetail = "moves" | "settings" | "controls";

function edge(now: GamepadUiState, before: GamepadUiState, key: keyof GamepadUiState): boolean {
  return now[key] && !before[key];
}

/** Mounts the controller-first game and its integrated Training tools. */
export async function startLab(mount: HTMLElement): Promise<() => void> {
  let debugEnabled = loadDebugEnabled();
  const playerCharacter = createTestFighter();
  const dummyCharacter = createTestFighter();
  const combatCharacters = [playerCharacter, dummyCharacter];
  const enemyIndex = 1;
  const preferences = loadPreferences();
  applyPreferences(preferences);

  replaceTrustedMarkup(mount, buildLabView({ character: playerCharacter, preferences, dummyOptions: DUMMY_OPTIONS, debugEnabled }));
  mount.removeAttribute("aria-busy");

  const selectedStage = STAGE_CATALOG["training-grid"].stage;
  const config: SimConfig = {
    characters: combatCharacters,
    startX: [px(-18), px(18)],
    seed: 0x5eed,
    stage: selectedStage,
  };
  const sim = new Simulation(config);
  const timeline = new Timeline(sim, 900);
  timeline.paused = false;
  timeline.pauseOnContact = false;
  const dummy = new DummyController();
  const tutorial = new TutorialController(syncTutorialUi);
  const keyboard = new KeyboardController(window, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
  const secondKeyboard = new KeyboardController(window, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP);
  const gamepad = new GamepadController();
  const renderer = new Renderer(required("stage"), sim.characters(), {
    fighters: [0, 1].map(() => ({ model: TEST_FIGHTER_MODEL, rig: TEST_FIGHTER_RIG, animations: TEST_FIGHTER_ANIMATIONS, playback: TEST_FIGHTER_PLAYBACK })),
    stage: selectedStage,
  });
  const toggles: DebugToggles = { hitboxes: false, hurtboxes: false, pushboxes: false, origins: false, skeleton: false, boneNames: false, velocity: false };

  timeline.inputProvider = () => {
    if (menuOpen()) return combatCharacters.map(() => 0);
    const playerInput = keyboard.sample() | gamepad.sample();
    lastPlayerInput = playerInput;
    if (tutorial.active) return [playerInput, tutorial.dummyInput(sim.getState())];
    const secondPlayer = secondKeyboard.sample();
    dummy.capture(secondPlayer);
    return [playerInput, dummy.inputFor(sim.getState(), enemyIndex, timeline.lastReport)];
  };

  let disposed = false;
  let animationId = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let lastReport: FrameReport | null = null;
  let resumeAfterMenu = false;
  let previousUi = gamepad.sampleUi();
  let focusBeforeMenu: HTMLElement | null = null;
  let lastMenuFocus: HTMLElement | null = null;
  let captionTimer = 0;
  let selectedInteraction: InteractionSelection | null = null;
  let renderedTimelineMoveId = -1;
  let renderedTimelinePlayhead = -2;
  let timelinePinnedMoveId = playerCharacter.commands[0]?.moveId ?? -1;
  let interactionRenderKey = "";
  let lastPlayerInput = 0;
  let latestTutorialSnapshot: TutorialSnapshot | null = null;

  gamepad.setDeadzone(preferences.controls.stickDeadzone);
  gameAudio.setCaptionHandler(showCaption);
  gameAudio.update(preferences.audio);

  const render = (now = performance.now()): void => {
    const state = sim.getState();
    const stateHash = hashState(state);
    renderer.render(state, lastReport ?? timeline.lastReport, debugEnabled ? toggles : NO_DEBUG_TOGGLES);
    const frameReadout = mount.querySelector<HTMLElement>("#frame-readout");
    const playState = mount.querySelector<HTMLElement>("#play-state");
    if (frameReadout) frameReadout.textContent = String(state.frame).padStart(6, "0");
    if (playState) playState.textContent = timeline.paused ? "PAUSED" : "LIVE";
    const pausedOverlay = required("paused-overlay");
    pausedOverlay.hidden = !timeline.paused || menuOpen();
    const range = timeline.bufferedRange();
    const timelineStatus = mount.querySelector<HTMLElement>("#timeline-status");
    if (timelineStatus) timelineStatus.textContent = timeline.lastMessage ?? `Frame ${state.frame} · ${timeline.paused ? "paused" : "live"} · buffer ${range.oldest}–${range.newest}`;
    required("controller-state").textContent = gamepad.connected ? `Gamepad · ${gamepad.name}` : "Keyboard ready · connect gamepad anytime";
    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      const maximum = sim.characters()[player].health;
      const percent = Math.max(0, Math.min(100, (fighter.health / maximum) * 100));
      required(`health-p${player + 1}`).style.width = `${percent}%`;
      required(`health-text-p${player + 1}`).textContent = String(fighter.health);
      const maxStamina = sim.characters()[player].stamina;
      const staminaPercent = Math.max(0, Math.min(100, (fighter.stamina / maxStamina) * 100));
      required(`stamina-p${player + 1}`).style.width = `${staminaPercent}%`;
      required(`stamina-text-p${player + 1}`).textContent = `${fighter.stamina} STA`;
      renderDebuffs(player, fighter);
    }
    const move = playerCharacter.moves.find((candidate) => candidate.id === state.fighters[0].moveId);
    required("active-move").textContent = move?.key.replaceAll("_", " ") ?? "Ready";
    required("active-tags").textContent = move?.tags.join(" · ") ?? "Move, strike, and inspect the result";
    for (const pause of mount.querySelectorAll<HTMLButtonElement>("[data-action='pause']")) pause.textContent = timeline.paused ? "Play" : "Pause";
    const frameInspector = mount.querySelector<HTMLElement>("#frame-inspector");
    if (frameInspector) replaceTrustedMarkup(frameInspector, frameInspectorMarkup(state, sim.characters(), lastReport ?? timeline.lastReport, stateHash));
    renderFrameTimeline(state.fighters[0].moveId, state.fighters[0].moveFrame);
    renderInteractionHistory();
  };

  const loop = (now: number): void => {
    if (disposed) return;
    handleGamepadUi();
    elapsed += Math.min(250, Math.max(0, now - lastTime));
    lastTime = now;
    const realFrames = Math.trunc(elapsed / FRAME_MS);
    if (realFrames > 0) {
      elapsed -= realFrames * FRAME_MS;
      const reports = timeline.tick(realFrames);
      if (reports.length > 0) {
        lastReport = reports[reports.length - 1];
        processReports(reports);
        tutorial.observe(lastPlayerInput, sim.getState(), reports);
        if (timeline.pauseOnContact && timeline.paused && reports.some((report) => report.contacts.length > 0)) {
          tutorial.recordUi("contact-paused");
        }
        if (tutorial.consumeResetRequest()) resetMatch();
      }
    }
    render(now);
    animationId = requestAnimationFrame(loop);
  };

  const click = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    const button = element.closest<HTMLButtonElement>("button");
    if (!button) return;
    gameAudio.ensure();
    gameAudio.play("confirm");
    const action = button.dataset.action;
    if (action === "pause") timeline.paused = !timeline.paused;
    if (action === "menu") openMenu();
    if (action === "close-menu") closeMenu();
    if (action === "return-main") window.location.href = "/";
    if (action === "back-10") stepFrames(-10);
    if (action === "back") stepFrames(-1);
    if (action === "forward") stepFrames(1);
    if (action === "forward-10") stepFrames(10);
    if (action === "reset") resetMatch();
    if (action === "debug") setDebugEnabled(!debugEnabled);
    if (action === "start-tutorial") startTutorial(tutorial.active);
    if (action === "start-tutorial-prompt") startTutorial(false);
    if (action === "dismiss-tutorial-prompt") {
      markTutorialPromptSeen();
      syncTutorialPrompt();
    }
    if (action === "reset-preferences" && confirmDestructive("Reset every setting to its default?")) replacePreferences(resetPreferences());
    if (action === "next-tutorial-lesson") advanceTutorial();
    if (action === "exit-tutorial") exitTutorial();
    if (button.dataset.menuDetailTarget) showMenuDetail(button.dataset.menuDetailTarget as MenuDetail);
    if (button.dataset.contactFrame !== undefined && button.dataset.contactIndex !== undefined) inspectInteraction(Number(button.dataset.contactFrame), Number(button.dataset.contactIndex));
    const save = button.dataset.save;
    if (save) {
      timeline.saveState(Number(save));
      mount.querySelector<HTMLButtonElement>(`[data-load='${save}']`)!.disabled = false;
    }
    const load = button.dataset.load;
    if (load && timeline.loadState(Number(load))) { timeline.paused = true; lastReport = null; }
    render();
  };

  const change = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.control === "speed") timeline.speed = Number(target.value) as LabSpeed;
    if (target.dataset.control === "dummy") dummy.mode = Number(target.value) as DummyModeValue;
    if (target.dataset.control === "pause-on-contact" && target instanceof HTMLInputElement) timeline.pauseOnContact = target.checked;
    const debug = target.dataset.debug as keyof DebugToggles | undefined;
    if (debug) {
      toggles[debug] = (target as HTMLInputElement).checked;
      for (const control of mount.querySelectorAll<HTMLInputElement>(`[data-debug='${debug}']`)) control.checked = toggles[debug];
    }
    if (target.dataset.prefSection && target.dataset.prefKey) updatePreference(target);
    render();
  };

  const input = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.type === "range" && target.dataset.prefSection && target.dataset.prefKey) updatePreference(target);
  };

  const keydown = (event: KeyboardEvent): void => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) gameAudio.ensure();
    if (event.code === "Backquote" && !isFormControl(event.target)) {
      if (event.repeat) return;
      event.preventDefault();
      setDebugEnabled(!debugEnabled);
      render();
      return;
    }
    if (menuOpen()) {
      if (event.code === "Tab") { trapFocus(event); return; }
      if (event.code === "Escape") { event.preventDefault(); closeMenu(); }
      return;
    }
    if (event.code === "Escape") { event.preventDefault(); openMenu(); }
    else if ((event.code === "Space" || event.code === "KeyP") && !isFormControl(event.target)) {
      if (event.repeat) return; event.preventDefault(); timeline.paused = !timeline.paused;
    } else if ((event.code === "Comma" || event.code === "BracketLeft") && !isFormControl(event.target)) { event.preventDefault(); stepFrames(-1); }
    else if ((event.code === "Period" || event.code === "BracketRight") && !isFormControl(event.target)) { event.preventDefault(); stepFrames(1); }
    else return;
    render();
  };

  const visibility = (): void => gameAudio.handleVisibility(document.hidden);
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionChange = (): void => {
    if (preferences.accessibility.motion === "system") applyPreferences(preferences);
  };

  mount.addEventListener("click", click);
  mount.addEventListener("change", change);
  mount.addEventListener("input", input);
  window.addEventListener("keydown", keydown);
  document.addEventListener("visibilitychange", visibility);
  motionQuery.addEventListener("change", motionChange);
  syncTutorialUi(tutorial.snapshot());
  if (tutorialRequested(window.location.search)) startTutorial(false);
  else syncTutorialPrompt();
  render();
  animationId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationId);
    window.clearTimeout(captionTimer);
    mount.removeEventListener("click", click);
    mount.removeEventListener("change", change);
    mount.removeEventListener("input", input);
    window.removeEventListener("keydown", keydown);
    document.removeEventListener("visibilitychange", visibility);
    motionQuery.removeEventListener("change", motionChange);
    keyboard.dispose();
    secondKeyboard.dispose();
    renderer.dispose();
    gameAudio.setCaptionHandler(null);
    gameAudio.dispose();
    mount.replaceChildren();
  };

  function required(id: string): HTMLElement {
    const element = mount.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`Lab element #${id} is missing`);
    return element;
  }

  function setText(id: string, value: string): void {
    const element = mount.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = value;
  }

  function menuOpen(): boolean {
    return !required("menu-scrim").hidden;
  }



  function openMenu(): void {
    if (menuOpen()) return;
    focusBeforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resumeAfterMenu = !timeline.paused;
    timeline.paused = true;
    required("menu-scrim").hidden = false;
    setGameContentInert(true);
    const remembered = lastMenuFocus && lastMenuFocus.isConnected && !lastMenuFocus.closest("[hidden]")
      ? lastMenuFocus
      : mount.querySelector<HTMLButtonElement>("[data-action='close-menu']");
    remembered?.focus();
  }

  function closeMenu(): void {
    if (!menuOpen()) return;
    if (document.activeElement instanceof HTMLElement && required("lab-menu").contains(document.activeElement)) {
      lastMenuFocus = document.activeElement;
    }
    required("menu-scrim").hidden = true;
    setGameContentInert(false);
    if (resumeAfterMenu) timeline.paused = false;
    resumeAfterMenu = false;
    (focusBeforeMenu ?? mount.querySelector<HTMLButtonElement>("[data-action='menu']"))?.focus();
  }

  function setGameContentInert(inert: boolean): void {
    const scrim = required("menu-scrim");
    const main = required("game-content");
    for (const child of main.children) {
      if (child === scrim || !(child instanceof HTMLElement)) continue;
      child.inert = inert;
      if (inert) child.setAttribute("aria-hidden", "true");
      else child.removeAttribute("aria-hidden");
    }
  }

  function setDebugEnabled(enabled: boolean): void {
    debugEnabled = enabled;
    persistDebugEnabled(enabled);
    const tools = required("debug-tools");
    tools.hidden = !enabled;
    const button = required("debug-control");
    button.setAttribute("aria-expanded", String(enabled));
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = "Debug: " + (enabled ? "On" : "Off") + " (`)";
    if (enabled) recognizeInspectState();
  }

  function showMenuDetail(detail: MenuDetail): void {
    for (const section of mount.querySelectorAll<HTMLElement>("[data-menu-detail]")) {
      section.hidden = section.dataset.menuDetail !== detail;
    }
  }


  function confirmDestructive(message: string): boolean {
    return window.confirm(message);
  }
















  function renderFrameTimeline(activeMoveId: number, activeMoveFrame: number): void {
    const console = mount.querySelector<HTMLElement>("#move-timeline-console");
    if (!console) return;
    const activeMove = playerCharacter.moves.find((candidate) => candidate.id === activeMoveId);
    if (activeMove) timelinePinnedMoveId = activeMove.id;
    const move = activeMove
      ?? playerCharacter.moves.find((candidate) => candidate.id === timelinePinnedMoveId)
      ?? playerCharacter.moves[0];
    if (!move) return;

    if (renderedTimelineMoveId !== move.id) {
      replaceTrustedMarkup(console, moveTimelineMarkup(move));
      renderedTimelineMoveId = move.id;
      renderedTimelinePlayhead = -2;
    }

    const playhead = activeMove ? activeMoveFrame : -1;
    if (playhead === renderedTimelinePlayhead) return;
    renderedTimelinePlayhead = playhead;
    for (const cell of console.querySelectorAll<HTMLElement>("[data-frame]")) {
      cell.classList.toggle("playhead", Number(cell.dataset.frame) === playhead);
    }
  }

  function renderInteractionHistory(): void {
    const interactionHistory = mount.querySelector<HTMLElement>("#interaction-history");
    if (!interactionHistory) return;
    const reports = timeline.contactReports();
    const key = `${reports.map((report) => `${report.frame}:${report.contacts.length}`).join(",")}|${selectedInteraction?.frame ?? "latest"}:${selectedInteraction?.index ?? 0}`;
    if (key === interactionRenderKey) return;
    interactionRenderKey = key;
    replaceTrustedMarkup(interactionHistory, interactionHistoryMarkup(reports, sim.characters(), selectedInteraction));
  }

  function inspectInteraction(frame: number, index: number): void {
    const report = timeline.reportAt(frame);
    if (!report || !report.contacts[index]) return;
    timeline.paused = true;
    if (!timeline.jumpToFrame(frame + 1)) return;
    selectedInteraction = { frame, index };
    lastReport = report;
    interactionRenderKey = "";
  }

  function updatePreference(target: HTMLInputElement | HTMLSelectElement): void {
    const section = target.dataset.prefSection as keyof LabPreferences;
    const key = target.dataset.prefKey;
    if (!key || !(section in preferences)) return;
    const value: unknown = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.dataset.prefNumber !== undefined ? Number(target.value) : target.value;
    const record = preferences[section] as unknown as Record<string, unknown>;
    record[key] = value;
    persistPreferences(preferences);
    applyPreferences(preferences);
    gameAudio.update(preferences.audio);
    gamepad.setDeadzone(preferences.controls.stickDeadzone);
    const output = mount.querySelector<HTMLOutputElement>(`[data-pref-output='${section}.${key}']`);
    if (output && target instanceof HTMLInputElement) {
      const percent = Math.round(Number(target.value) * 100);
      output.value = `${percent}%`;
      target.setAttribute("aria-valuetext", `${percent}%`);
    }
  }

  function replacePreferences(next: LabPreferences): void {
    for (const section of Object.keys(next) as (keyof LabPreferences)[]) Object.assign(preferences[section], next[section]);
    applyPreferences(preferences);
    gameAudio.update(preferences.audio);
    gamepad.setDeadzone(preferences.controls.stickDeadzone);
    for (const element of mount.querySelectorAll("[data-pref-section][data-pref-key]")) {
      const target = element as unknown as HTMLInputElement | HTMLSelectElement;
      const section = target.dataset.prefSection as keyof LabPreferences;
      const key = target.dataset.prefKey ?? "";
      const value = (preferences[section] as unknown as Record<string, unknown>)[key];
      if (target instanceof HTMLInputElement && target.type === "checkbox") target.checked = Boolean(value);
      else target.value = String(value);
      if (target instanceof HTMLInputElement && target.type === "range") {
        const percent = Math.round(Number(target.value) * 100);
        const output = mount.querySelector<HTMLOutputElement>(`[data-pref-output='${section}.${key}']`);
        if (output) output.value = `${percent}%`;
        target.setAttribute("aria-valuetext", `${percent}%`);
      }
    }
  }

  function startTutorial(restart: boolean): void {
    markTutorialPromptSeen();
    syncTutorialPrompt();
    if (menuOpen()) closeMenu();
    if (restart) tutorial.restart();
    else tutorial.start();
    resetMatch();
    timeline.paused = false;
    recognizeInspectState();
  }

  function finishTutorial(): void {
    stopTutorial();
  }

  function exitTutorial(): void {
    stopTutorial();
  }

  function stopTutorial(): void {
    if (menuOpen()) closeMenu();
    tutorial.stop();
    resetMatch();
    timeline.paused = false;
    syncTutorialPrompt();
    mount.querySelector<HTMLButtonElement>("[data-action='menu']")?.focus();
  }

  function advanceTutorial(): void {
    if (!latestTutorialSnapshot) return;
    if (latestTutorialSnapshot.lessonComplete && latestTutorialSnapshot.lessonIndex === latestTutorialSnapshot.lessonCount - 1) {
      finishTutorial();
      return;
    }
    tutorial.nextLesson();
    if (tutorial.consumeResetRequest()) resetMatch();
    timeline.paused = false;
    recognizeInspectState();
  }

  function recognizeInspectState(): void {
    const snapshot = tutorial.snapshot();
    if (snapshot.active && snapshot.lessonId === "inspect" && snapshot.stepIndex === 0 && debugEnabled) {
      tutorial.recordUi("debug-enabled");
    }
  }

  function syncTutorialPrompt(): void {
    const prompt = mount.querySelector<HTMLElement>("#tutorial-prompt");
    if (prompt) prompt.hidden = tutorialPromptSeen() || tutorial.active;
  }

  function syncTutorialUi(snapshot: TutorialSnapshot): void {
    latestTutorialSnapshot = snapshot;
    const hud = mount.querySelector<HTMLElement>("#tutorial-hud");
    if (hud) {
      hud.hidden = !snapshot.active;
      textIn(hud, "#tutorial-lesson-count", `LESSON ${snapshot.lessonIndex + 1} / ${snapshot.lessonCount} · STEP ${snapshot.stepIndex + 1} / ${snapshot.stepCount}`);
      textIn(hud, "#tutorial-title", snapshot.title);
      textIn(hud, "#tutorial-objective", snapshot.lessonComplete ? snapshot.success : snapshot.objective);
      textIn(hud, "#tutorial-success", snapshot.confirmation ? `✓ ${snapshot.confirmation.toUpperCase()}` : "");
      textIn(hud, "#tutorial-hint", snapshot.hint);
      const telegraph = hud.querySelector<HTMLElement>("#tutorial-telegraph");
      if (telegraph) {
        telegraph.hidden = snapshot.telegraph === null;
        telegraph.textContent = snapshot.telegraph ?? "";
      }
      const next = hud.querySelector<HTMLButtonElement>("[data-action='next-tutorial-lesson']");
      if (next) {
        next.hidden = !snapshot.lessonComplete;
        next.textContent = snapshot.lessonIndex === snapshot.lessonCount - 1 ? "Finish tutorial" : "Next lesson";
      }
    }
    const menuTutorial = mount.querySelector<HTMLButtonElement>("[data-action='start-tutorial']");
    if (menuTutorial) {
      menuTutorial.textContent = snapshot.active
        ? "Restart tutorial"
        : snapshot.completedLessons.length > 0 && !snapshot.tutorialComplete
          ? "Continue tutorial"
          : "Start tutorial";
    }
    syncTutorialPrompt();
  }

  function textIn(root: HTMLElement, selector: string, value: string): void {
    const target = root.querySelector<HTMLElement>(selector);
    if (target) target.textContent = value;
  }

  function resetMatch(): void {
    timeline.reset();
    dummy.reset();
    if (tutorial.active) {
      const state = sim.getState();
      state.fighters[0].x = px(-18);
      state.fighters[1].x = px(18);
    }
    lastPlayerInput = 0;
    lastReport = null;
    selectedInteraction = null;
    interactionRenderKey = "";
  }

  function stepFrames(count: number): void {
    const wasPaused = timeline.paused;
    timeline.paused = true;
    const reports = timeline.stepFrames(count);
    lastReport = timeline.lastReport;
    if (reports.length > 0) processReports(reports);
    if (wasPaused && count === 1) tutorial.recordUi("frame-stepped");
    interactionRenderKey = "";
  }

  function processReports(reports: readonly FrameReport[]): void {
    const announcements: string[] = [];
    for (const report of reports) {
      for (const contact of report.contacts) {
        gameAudio.play(contact.kind === ContactKind.Hit ? "hit" : "block");
        if (contact.kind === ContactKind.Hit) gamepad.rumble(preferences.controls.vibration, 95);
        else {
          gamepad.rumble(preferences.controls.vibration * (contact.perfectGuard ? 0.55 : 0.28), contact.perfectGuard ? 75 : 48);
          const meter = required(`stamina-p${contact.defender + 1}`).parentElement;
          if (meter) {
            meter.classList.remove("guard-spend");
            void meter.offsetWidth;
            meter.classList.add("guard-spend");
          }
        }
        announcements.push(contact.kind === ContactKind.Hit
          ? `Player ${contact.attacker + 1} hits for ${contact.damage}.`
          : contact.guardBreak
            ? `Player ${contact.defender + 1} guard broken.`
            : contact.perfectGuard
              ? `Player ${contact.defender + 1} perfect guards.`
              : `Player ${contact.defender + 1} blocks and spends ${contact.guardStaminaDamage} stamina.`);
      }
      for (const event of report.debuffs) {
        if (event.kind === DebuffEventKind.Applied || event.kind === DebuffEventKind.Triggered) gameAudio.play(cueForDebuff(event.debuff));
        if (event.kind !== DebuffEventKind.Tick) {
          const rule = STATUS_RULES.find((candidate) => candidate.debuff === event.debuff);
          announcements.push(`${rule?.name ?? "Status"} ${event.stacks} stack${event.stacks === 1 ? "" : "s"} on player ${event.target + 1}.`);
        }
      }
    }
    if (preferences.accessibility.screenReaderCombat && announcements.length > 0) required("combat-announcer").textContent = announcements.slice(-3).join(" ");
  }

  function renderDebuffs(player: number, fighter: FighterState): void {
    const statuses = [
      ["burn", fighter.burnStacks, fighter.burnFrames],
      ["freeze", fighter.freezeStacks, fighter.freezeFrames],
    ] as const;
    const active = statuses.filter(([, stacks, frames]) => stacks > 0 && frames > 0);
    const lane = required(`debuff-p${player + 1}`);
    replaceTrustedMarkup(lane, active.map(([tag, stacks, frames]) => `<span class="debuff-chip status-${tag}"><i aria-hidden="true">${STATUS_RULES.find((rule) => rule.tag === tag)?.glyph ?? "?"}</i><b>${tag}</b><em>×${stacks}</em><small>${Math.ceil(frames / 60)}s</small></span>`).join(""));
    lane.setAttribute("aria-label", active.length > 0 ? active.map(([tag, stacks]) => `${tag}, ${stacks} stacks`).join("; ") : "No active debuffs");
  }

  function showCaption(text: string): void {
    const caption = required("audio-caption");
    caption.textContent = text;
    caption.hidden = false;
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => { caption.hidden = true; }, 1250);
  }

  function handleGamepadUi(): void {
    const now = gamepad.sampleUi();
    if (!menuOpen()) {
      if (edge(now, previousUi, "start")) timeline.paused = !timeline.paused;
      if (edge(now, previousUi, "menu")) openMenu();
      if (timeline.paused && edge(now, previousUi, "leftBumper")) stepFrames(-1);
      if (timeline.paused && edge(now, previousUi, "rightBumper")) stepFrames(1);
      if (timeline.paused && edge(now, previousUi, "up")) focusGamepadTarget("up");
      if (timeline.paused && edge(now, previousUi, "down")) focusGamepadTarget("down");
      if (timeline.paused && edge(now, previousUi, "left") && !adjustFocused(-1)) focusGamepadTarget("left");
      if (timeline.paused && edge(now, previousUi, "right") && !adjustFocused(1)) focusGamepadTarget("right");
      if (timeline.paused && edge(now, previousUi, "confirm")) activateFocused();
      previousUi = now;
      return;
    }
    if (edge(now, previousUi, "back") || edge(now, previousUi, "menu")) closeMenu();
    if (edge(now, previousUi, "up")) focusGamepadTarget("up");
    if (edge(now, previousUi, "down")) focusGamepadTarget("down");
    if (edge(now, previousUi, "left") && !adjustFocused(-1)) focusGamepadTarget("left");
    if (edge(now, previousUi, "right") && !adjustFocused(1)) focusGamepadTarget("right");
    if (edge(now, previousUi, "confirm")) activateFocused();
    previousUi = now;
  }

  function visibleGamepadTargets(): HTMLElement[] {
    return [...mount.querySelectorAll<HTMLElement>("[data-gamepad-nav]")].filter((element) => !element.closest("[hidden]") && !element.closest("[inert]") && !(element instanceof HTMLButtonElement && element.disabled));
  }

  function focusGamepadTarget(direction: "up" | "down" | "left" | "right"): void {
    const targets = visibleGamepadTargets();
    if (targets.length === 0) return;
    const current = document.activeElement instanceof HTMLElement
      ? targets.find((target) => target === document.activeElement || target.contains(document.activeElement))
      : undefined;
    if (!current) {
      targets[0]?.focus();
      return;
    }
    const from = centerOf(current.getBoundingClientRect());
    const candidates = targets.filter((target) => target !== current).map((target) => {
      const to = centerOf(target.getBoundingClientRect());
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const primary = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
      const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
      return { target, primary, secondary, to };
    }).filter((candidate) => candidate.primary > 3)
      .sort((a, b) => (a.primary + a.secondary * 2.2) - (b.primary + b.secondary * 2.2));
    let next = candidates[0]?.target;
    next?.focus();
    gameAudio.play("navigate");
  }

  function adjustFocused(delta: number): boolean {
    const active = document.activeElement;
    const select = active instanceof HTMLSelectElement ? active : active instanceof HTMLElement ? active.querySelector("select") : null;
    if (select) {
      select.selectedIndex = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + delta));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const range = active instanceof HTMLInputElement && active.type === "range" ? active : active instanceof HTMLElement ? active.querySelector<HTMLInputElement>("input[type='range']") : null;
    if (range) {
      const step = Number(range.step) || 1;
      range.value = String(Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + step * delta)));
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    const checkbox = active instanceof HTMLInputElement && active.type === "checkbox" ? active : active instanceof HTMLElement ? active.querySelector<HTMLInputElement>("input[type='checkbox']") : null;
    if (checkbox) {
      checkbox.checked = delta > 0;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  function activateFocused(): void {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement) active.click();
    else if (active instanceof HTMLInputElement && active.type === "checkbox") active.click();
    else if (active instanceof HTMLElement) active.querySelector<HTMLElement>("button, input[type='checkbox']")?.click();
  }

  function trapFocus(event: KeyboardEvent, dialog = required("lab-menu")): void {
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => !element.closest("[hidden]") && !element.inert);
    if (items.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !(active instanceof Node) || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !(active instanceof Node) || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
}

function loadDebugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDebugEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Debug persistence is device-local enhancement only.
  }
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function centerOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function cueForDebuff(debuff: number): "burn" | "freeze" {
  return debuff === DebuffKind.Burn ? "burn" : "freeze";
}
