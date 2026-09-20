import { appendTrustedMarkup, replaceElementWithTrustedMarkup, replaceTrustedMarkup } from "../client/trusted-markup";
import { px } from "../combat/constants";
import type { FighterState, FrameReport, MoveDef, SimConfig } from "../combat/types";
import { actionBit, ContactKind, DebuffEventKind, DebuffKind, EntityEventKind, EntityKind, HitLevel, InputBit, InteractableKind } from "../combat/types";
import { Simulation } from "../combat/simulation/simulation";
import { DEFAULT_MOVE_LOADOUT, MoveId, testFighterWithBuild, testFighterWithLoadout } from "../content/test-fighter";
import {
  TEST_FIGHTER_ANIMATIONS,
  TEST_FIGHTER_MODEL,
  TEST_FIGHTER_PLAYBACK,
  TEST_FIGHTER_RIG,
} from "../content/test-fighter-assets";
import type { ArmorSlot } from "../content/armor";
import {
  ARMOR_CATALOG,
  ARMOR_SLOTS,
  armorById,
  armorSkillPoints,
  canCraftArmor,
  materialById,
} from "../content/armor";
import { STATUS_RULES } from "../content/status-rules";
import { gameAudio } from "../client/audio/audio-manager";
import { GamepadController } from "../input/controller/gamepad";
import type { GamepadUiState } from "../input/controller/gamepad";
import { KeyboardController } from "../input/controller/keyboard";
import { DEFAULT_ACTION_KEYMAP, DEFAULT_KEYMAP_P1, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP } from "../input/controller/keymap";
import { hashState } from "../rollback/hashing/fnv";
import type { DebugToggles } from "../renderer/svg/debug-overlay";
import { Renderer } from "../renderer/svg/renderer";
import { DebugPanel } from "./debugger/panel";
import { DummyController, DummyMode } from "./dummy/dummy";
import type { DummyModeValue } from "./dummy/dummy";
import { applyPreferences, loadPreferences, persistPreferences, resetPreferences } from "./preferences";
import type { LabPreferences } from "./preferences";
import { Timeline } from "./timeline/timeline";
import type { LabSpeed } from "./timeline/timeline";
import {
  frameInspectorMarkup,
  interactionHistoryMarkup,
  moveTimelineMarkup,
} from "./inspector";
import type { InteractionSelection } from "./inspector";
import {
  captureScenario,
  parseScenario,
  replayScenario,
  scenarioJson,
} from "./scenario/scenario";
import type { CombatScenario } from "./scenario/scenario";
import {
  armorDetailMarkup,
  armorInventoryButton,
  buildLabView,
  craftDetailMarkup,
  craftRecipeButton,
  materialDetailMarkup,
  skillBoardMarkup,
} from "./view";
import { MoveDemonstration } from "./move-demonstration";
import type { MoveDemonstrationMode, MoveDemonstrationState } from "./move-demonstration";
import { markTutorialSeen, TutorialController, TUTORIAL_LESSONS } from "./tutorial";
import type { TutorialSnapshot } from "./tutorial";
import { BLACK_BELFRY } from "../content/black-belfry";
import { BELL_WARDEN } from "../content/bell-warden";
import {
  BELL_WARDEN_ANIMATIONS,
  BELL_WARDEN_MODEL,
  BELL_WARDEN_PLAYBACK,
  BELL_WARDEN_RIG,
} from "../content/bell-warden-assets";
import { BellWardenController } from "../campaign/boss-controller";
import { buildStateFromPlayerSave, createDefaultPlayerSave, syncBuildStateToPlayerSave } from "../player/save";
import { applyStageEvent, cachePlayerSave, claimBossReward, craftPlayerArmor, loadPlayerSave, persistPlayerSave } from "../player/client";
import { readGameSession, STAGE_CATALOG } from "../game/session";
import type { GameMode } from "../game/session";
import { LoadoutAIController } from "../game/loadout-ai-controller";
import {
  ACTION_BANKS,
  actionSlotInput,
  actionSlotLabel,
  codexMoveDetailMarkup,
  describeMoveFrame,
  equippedSlots,
  equippedSummary,
  moveName,
  routeTopologyMarkup,
} from "./move-presentation";

const FRAME_MS = 1000 / 60;
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex='-1'])";

const DUMMY_OPTIONS: readonly [DummyModeValue, string][] = [
  [DummyMode.Stand, "Stand"], [DummyMode.Crouch, "Crouch"], [DummyMode.Jump, "Jump"],
  [DummyMode.BlockNone, "Block none"], [DummyMode.BlockAll, "Block all"],
  [DummyMode.BlockAfterFirstHit, "Block after first hit"], [DummyMode.Record, "Record P2"],
  [DummyMode.Playback, "Playback"], [DummyMode.Counterattack, "Counterattack"],
  [DummyMode.Reversal, "Reversal"],
];

type MenuTab = "loadout" | "moves" | "settings" | "training" | "debug";
type SettingsTab = "audio" | "video" | "accessibility" | "controls";
type InventoryTab = "armor" | "materials";

function edge(now: GamepadUiState, before: GamepadUiState, key: keyof GamepadUiState): boolean {
  return now[key] && !before[key];
}

/** Mounts the controller-first game and its integrated Training tools. */
export async function startLab(mount: HTMLElement): Promise<() => void> {
  const url = new URL(window.location.href);
  const session = readGameSession(url);
  if (!session) throw new Error("Combat requires an explicit game session");
  const gameMode: GameMode = session.mode;
  const developerTools = session.options.developerTools === true;
  const publicPlay = !developerTools;
  const campaignMode = gameMode === "campaign";
  const bossMode = session.encounterId === "bell-warden";
  const trainingMode = gameMode === "training";
  const catalogCharacter = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
  const validMoveIds = new Set([0, ...catalogCharacter.moves.map((move) => move.id)]);
  const playerSave = await loadPlayerSave();
  const campaign = campaignMode ? playerSave.campaign.stages["black-belfry"] ?? null : null;
  const buildState = buildStateFromPlayerSave(playerSave);
  const requested = playerSave.loadouts.order.indexOf(session.party[0].loadoutId);
  if (requested >= 0) buildState.activePreset = requested;
  let activeBuild = buildState.presets[buildState.activePreset];
  const playerCharacter = testFighterWithBuild(activeBuild.loadout, activeBuild.equipment);
  const dummyCharacter = bossMode ? BELL_WARDEN : testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
  const partyCharacters = session.party.map((slot) => {
    const build = playerSave.loadouts.byId[slot.loadoutId] ?? activeBuild;
    return testFighterWithBuild(build.loadout, build.equipment);
  });
  const combatCharacters = [...partyCharacters, dummyCharacter];
  const enemyIndex = combatCharacters.length - 1;
  const teams = combatCharacters.map((_, index) => index < enemyIndex ? 0 : 1);
  const preferences = loadPreferences();
  applyPreferences(preferences);

  replaceTrustedMarkup(mount, buildLabView({
    character: playerCharacter,
    buildState,
    preferences,
    dummyOptions: DUMMY_OPTIONS,
    publicPlay,
    gameMode,
    session,
    save: playerSave,
    developerTools,
    unlockedMoveIds: playerSave.unlocks.moves,
    unlockedRecipeIds: playerSave.unlocks.recipes,
  }));
  mount.removeAttribute("aria-busy");

  // The Training reset is a canonical contact setup: standing light reaches the dummy without
  // hidden walking or timing, so the same move can be run, inspected, edited, and rerun.
  const selectedStage = STAGE_CATALOG[session.stageId].stage;
  const checkpoint = campaign?.checkpointId
    ? BLACK_BELFRY.interactables.find((entity) => entity.id === campaign.checkpointId)
    : undefined;
  const partySpawn = checkpoint?.x ?? BLACK_BELFRY.spawnX;
  const startX: number[] = campaignMode
    ? [...session.party.map((_, index) => partySpawn - px(index * 90)), px(1130)]
    : gameMode === "fight"
      ? [...session.party.map((_, index) => px(-210 + index * 100)), px(190)]
      : [px(-18), px(18)];
  const config: SimConfig = {
    characters: combatCharacters,
    startX,
    teams,
    friendlyFire: session.options.friendlyFire,
    seed: 0x5eed,
    ...(selectedStage ? { stage: selectedStage } : {}),
  };
  const sim = new Simulation(config);
  if (gameMode === "fight") {
    sim.getState().stage.bossActive = 1;
    sim.getState().stage.arenaLocked = 1;
  }
  const timeline = new Timeline(sim, 900);
  timeline.paused = false;
  timeline.pauseOnContact = false;
  const dummy = new DummyController();
  const boss = new BellWardenController(enemyIndex);
  const partyAi = session.party.map((slot, index) => slot.controller === "ai" && slot.aiProfile
    ? new LoadoutAIController(slot.aiProfile, 0x5eed ^ (index + 1) * 0x9e37)
    : null);
  const tutorial = new TutorialController(
    syncTutorialUi,
    campaignMode ? [actionBit(3), actionBit(2), actionBit(1)] : undefined,
  );
  const keyboard = new KeyboardController(window, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP, {
    ownsModifiedActions: () => document.hasFocus() && !menuOpen() && !firstLaunchOpen(),
  });
  const secondKeyboard = new KeyboardController(window, DEFAULT_KEYMAP_P2, NO_ACTION_KEYMAP);
  const gamepad = new GamepadController();
  const renderer = new Renderer(required("stage"), sim.characters(), {
    fighters: [
      ...session.party.map(() => ({
        model: TEST_FIGHTER_MODEL,
        rig: TEST_FIGHTER_RIG,
        animations: TEST_FIGHTER_ANIMATIONS,
        playback: TEST_FIGHTER_PLAYBACK,
      })),
      bossMode
        ? {
            model: BELL_WARDEN_MODEL,
            rig: BELL_WARDEN_RIG,
            animations: BELL_WARDEN_ANIMATIONS,
            playback: BELL_WARDEN_PLAYBACK,
            presentationScale: 1.15,
          }
        : {
            model: TEST_FIGHTER_MODEL,
            rig: TEST_FIGHTER_RIG,
            animations: TEST_FIGHTER_ANIMATIONS,
            playback: TEST_FIGHTER_PLAYBACK,
          },
    ],
    stage: selectedStage,
  });
  const demonstrationAssets = {
    model: TEST_FIGHTER_MODEL,
    rig: TEST_FIGHTER_RIG,
    animations: TEST_FIGHTER_ANIMATIONS,
    playback: TEST_FIGHTER_PLAYBACK,
  };
  const moveShowcaseStage = mount.querySelector<HTMLElement>("#move-showcase-stage");
  const codexMoveStage = mount.querySelector<HTMLElement>("#codex-move-stage");
  const moveShowcase = moveShowcaseStage ? new MoveDemonstration(moveShowcaseStage, playerCharacter, demonstrationAssets) : null;
  const codexDemonstration = codexMoveStage ? new MoveDemonstration(codexMoveStage, playerCharacter, demonstrationAssets, syncCodexDemonstrationUi) : null;
  const panel = developerTools ? new DebugPanel(required("debug-panel")) : null;
  const toggles: DebugToggles = { hitboxes: false, hurtboxes: false, pushboxes: false, origins: false, skeleton: false, boneNames: false, velocity: false };

  timeline.inputProvider = () => {
    if (menuOpen()) return combatCharacters.map(() => 0);
    const playerInput = keyboard.sample() | gamepad.sample();
    lastPlayerInput = playerInput;
    if (tutorial.active) return [playerInput, tutorial.dummyInput(sim.getState())];
    const inputs = session.party.map((_, index) => index === 0
      ? playerInput
      : partyAi[index]?.inputFor(sim.getState(), index, sim.characters(), teams, timeline.lastReport) ?? 0);
    if (bossMode) return [...inputs, boss.inputFor(sim.getState())];
    const secondPlayer = secondKeyboard.sample();
    dummy.capture(secondPlayer);
    return [...inputs, dummy.inputFor(sim.getState(), enemyIndex, timeline.lastReport)];
  };

  let disposed = false;
  let animationId = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let lastReport: FrameReport | null = null;
  let activeTab: MenuTab = developerTools || trainingMode ? "training" : gameMode === "fight" ? "moves" : "loadout";
  let activeSettingsTab: SettingsTab = "audio";
  let resumeAfterMenu = false;
  let previousUi = gamepad.sampleUi();
  let focusBeforeMenu: HTMLElement | null = null;
  let lastMenuFocus: HTMLElement | null = null;
  let captionTimer = 0;
  let selectedArmorSlot: ArmorSlot = "head";
  let selectedCraftArmorId = ARMOR_CATALOG.find((item) => !buildState.inventory.armor.includes(item.id))?.id ?? ARMOR_CATALOG[0].id;
  let craftFilter = "all";
  let showcasedMoveId = -1;
  let capturedScenario: CombatScenario | null = null;
  let selectedInteraction: InteractionSelection | null = null;
  let renderedTimelineMoveId = -1;
  let renderedTimelinePlayhead = -2;
  let timelinePinnedMoveId = -1;
  let interactionRenderKey = "";
  let armedSlot = 0;
  let moveRoleFilter = "all";
  let moveFamilyFilter = "all";
  let moveTerrainFilter = "all";
  let moveSearch = "";
  let codexSearch = "";
  let pendingMatchReset = false;
  let lastPlayerInput = 0;
  let tutorialBuildInstalled = false;
  let latestTutorialSnapshot: TutorialSnapshot | null = null;
  const buildChangeCounts = [0, 0, 0];

  gamepad.setDeadzone(preferences.controls.stickDeadzone);
  gameAudio.setCaptionHandler(showCaption);
  gameAudio.update(preferences.audio);
  showMovePreview(activeBuild.loadout[0], true);
  if (mount.querySelector("#move-library")) {
    selectAction(0, false);
    applyMoveFilters();
  }
  applyCodexSearch();

  const render = (now = performance.now()): void => {
    const state = sim.getState();
    const stateHash = hashState(state);
    renderer.render(state, lastReport ?? timeline.lastReport, toggles);
    panel?.update(state, sim.characters(), lastReport ?? timeline.lastReport, stateHash);
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
      required(`stamina-text-p${player + 1}`).textContent = bossMode && player === enemyIndex
        ? (fighter.health * 100 <= dummyCharacter.health * 58 ? "PHASE II · CHAIN UNBOUND" : "PHASE I · READ THE BELL")
        : `${fighter.stamina} STA`;
      renderDebuffs(player, fighter);
    }
    if (campaign) syncCampaignHud(state);
    const move = playerCharacter.moves.find((candidate) => candidate.id === state.fighters[0].moveId);
    required("active-move").textContent = move?.key.replaceAll("_", " ") ?? "Ready";
    required("active-tags").textContent = move?.tags.join(" · ") ?? "Move, strike, and inspect the result";
    for (const pause of mount.querySelectorAll<HTMLButtonElement>("[data-action='pause']")) pause.textContent = timeline.paused ? "Play" : "Pause";
    const frameInspector = mount.querySelector<HTMLElement>("#frame-inspector");
    if (frameInspector) replaceTrustedMarkup(frameInspector, frameInspectorMarkup(state, sim.characters(), lastReport ?? timeline.lastReport, stateHash));
    renderFrameTimeline(state.fighters[0].moveId, state.fighters[0].moveFrame);
    renderInteractionHistory();
    if (menuOpen() && activeTab === "loadout") moveShowcase?.render(now);
    if (menuOpen() && activeTab === "moves") codexDemonstration?.render(now);
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
        if (tutorial.consumeResetRequest()) resetMatch();
      }
      if (campaign && sim.getState().fighters[0].health === 0 && (lastPlayerInput & InputBit.Interact) !== 0) {
        resetMatch();
      }
    }
    render(now);
    animationId = requestAnimationFrame(loop);
  };

  const click = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    const codexFrame = element.closest<HTMLElement>("[data-codex-timeline] [data-frame]");
    if (codexFrame?.dataset.frame !== undefined) {
      codexDemonstration?.seek(Number(codexFrame.dataset.frame));
      return;
    }
    const armTarget = element.closest<HTMLElement>("[data-arm-slot]");
    if (armTarget?.dataset.armSlot !== undefined) selectAction(Number(armTarget.dataset.armSlot), false);
    const button = element.closest<HTMLButtonElement>("button");
    if (!button) return;
    gameAudio.ensure();
    gameAudio.play("confirm");
    const action = button.dataset.action;
    if (action === "pause") timeline.paused = !timeline.paused;
    if (action === "menu") openMenu();
    if (action === "close-menu") closeMenu();
    if (action === "return-main") window.location.href = "/play/";
    if (action === "return-mode-select") window.location.href = `/${gameMode}/`;
    if (action === "back-10") stepFrames(-10);
    if (action === "back") stepFrames(-1);
    if (action === "forward") stepFrames(1);
    if (action === "forward-10") stepFrames(10);
    if (action === "reset" && confirmDestructive("Reset the current match?")) resetMatch();
    if (action === "scenario-capture") captureCurrentScenario();
    if (action === "scenario-replay") replayCapturedScenario();
    if (action === "scenario-export") exportCapturedScenario();
    if (action === "default-loadout") resetActiveLoadout();
    if (action === "demo-prev") codexDemonstration?.step(-1);
    if (action === "demo-toggle") {
      codexDemonstration?.toggle();
      tutorial.recordUi("demo-played");
    }
    if (action === "demo-next") codexDemonstration?.step(1);
    if (action === "craft-selected") craftSelectedArmor();
    if (action === "craft-equip") craftSelectedArmor(true);
    if (action === "campaign-preview") window.location.href = `/codex/moves/${MoveId.GraveToll}/`;
    if (action === "campaign-assign") {
      assignMove(12, MoveId.GraveToll);
      window.location.href = `/loadouts/${playerSave.loadouts.activeId}/`;
    }
    if (action === "campaign-forge") window.location.href = "/forge/";
    if (action === "reset-preferences" && confirmDestructive("Reset every setting to its default?")) replacePreferences(resetPreferences());
    if (action === "start-tutorial") startTutorial();
    if (action === "skip-tutorial") skipFirstLaunch();
    if (action === "skip-tutorial-lesson") tutorial.skipLesson();
    if (action === "next-tutorial-lesson") advanceTutorial();
    if (action === "exit-tutorial") exitTutorial();
    if (button.dataset.menuTab) showTab(button.dataset.menuTab as MenuTab);
    if (button.dataset.settingsTab) showSettingsTab(button.dataset.settingsTab as SettingsTab);
    if (button.dataset.inventoryTab) showInventoryTab(button.dataset.inventoryTab as InventoryTab);
    if (button.dataset.preset !== undefined) switchPreset(Number(button.dataset.preset));
    if (button.dataset.selectAction !== undefined) selectAction(Number(button.dataset.selectAction));
    if (button.dataset.equipMove !== undefined) assignMove(armedSlot, Number(button.dataset.equipMove));
    if (button.dataset.codexMove !== undefined) showMovePreview(Number(button.dataset.codexMove), true);
    if (button.dataset.moveFilter && button.dataset.filterValue) setMoveFilter(button.dataset.moveFilter, button.dataset.filterValue);
    if (button.dataset.presetAction) handlePresetAction(button.dataset.presetAction);
    if (button.dataset.duplicateTarget !== undefined) duplicateInto(Number(button.dataset.duplicateTarget));
    if (button.dataset.equipRoute !== undefined) showRouteChooser(button);
    if (button.dataset.equipRouteColumn !== undefined && button.dataset.routeMoves) {
      equipRoute(Number(button.dataset.equipRouteColumn), button.dataset.routeMoves);
    }
    if (button.dataset.demoMode) setDemonstrationMode(button.dataset.demoMode as MoveDemonstrationMode);
    if (button.dataset.demoSpeed) setDemonstrationSpeed(Number(button.dataset.demoSpeed));
    if (button.dataset.armorSlot) selectArmorSlot(button.dataset.armorSlot as ArmorSlot);
    if (button.dataset.armorItem) equipArmor(button.dataset.armorItem);
    if (button.dataset.materialItem) renderMaterialDetail(button.dataset.materialItem);
    if (button.dataset.craftItem) selectCraftArmor(button.dataset.craftItem);
    if (button.dataset.craftFilter) setCraftFilter(button.dataset.craftFilter);
    if (button.dataset.contactFrame !== undefined && button.dataset.contactIndex !== undefined) {
      inspectInteraction(Number(button.dataset.contactFrame), Number(button.dataset.contactIndex));
    }
    const save = button.dataset.save;
    if (save) {
      timeline.saveState(Number(save));
      mount.querySelector<HTMLButtonElement>(`[data-load='${save}']`)!.disabled = false;
    }
    const load = button.dataset.load;
    if (load && timeline.loadState(Number(load))) {
      timeline.paused = true;
      lastReport = null;
    }
    render();
  };

  const change = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.control === "speed") timeline.speed = Number(target.value) as LabSpeed;
    if (target.dataset.control === "dummy") dummy.mode = Number(target.value) as DummyModeValue;
    if (target.dataset.control === "pause-on-contact" && target instanceof HTMLInputElement) timeline.pauseOnContact = target.checked;
    if (target.dataset.control === "scenario-import" && target instanceof HTMLInputElement) void importScenarioFile(target.files?.[0] ?? null);
    const debug = target.dataset.debug as keyof DebugToggles | undefined;
    if (debug) {
      toggles[debug] = (target as HTMLInputElement).checked;
      for (const control of mount.querySelectorAll<HTMLInputElement>(`[data-debug='${debug}']`)) control.checked = toggles[debug];
    }
    const slotText = target.dataset.loadoutSlot;
    if (slotText !== undefined) assignMove(Number(slotText), Number(target.value));
    if (target.dataset.buildName !== undefined) renameActiveBuild(target.value);
    if (target.dataset.prefSection && target.dataset.prefKey) updatePreference(target);
    render();
  };

  const input = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.type === "range" && target.dataset.prefSection && target.dataset.prefKey) updatePreference(target);
    if (target.dataset.moveSearch !== undefined) {
      moveSearch = target.value.trim().toLowerCase();
      applyMoveFilters();
    }
    if (target.dataset.codexSearch !== undefined) {
      codexSearch = target.value.trim().toLowerCase();
      applyCodexSearch();
    }
    if (target.id === "codex-frame-scrubber") {
      codexDemonstration?.seek(Number(target.value) - 1);
      tutorial.recordUi("demo-scrubbed");
    }
  };

  const previewContent = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(
      "select[data-loadout-slot], [data-move-preview], [data-armor-item], [data-material-item], [data-craft-item]",
    ) : null;
    if (!target) return;
    if (event.type === "pointerover" && target.dataset.codexMove !== undefined) return;
    if (target instanceof HTMLSelectElement || target.dataset.movePreview) {
      const moveId = target instanceof HTMLSelectElement ? Number(target.value) : Number(target.dataset.movePreview);
      showMovePreview(moveId);
    } else if (target.dataset.armorItem) {
      renderArmorDetail(target.dataset.armorItem);
    } else if (target.dataset.materialItem) {
      renderMaterialDetail(target.dataset.materialItem);
    } else if (target.dataset.craftItem) {
      selectCraftArmor(target.dataset.craftItem);
    }
  };

  const keydown = (event: KeyboardEvent): void => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) gameAudio.ensure();
    if (firstLaunchOpen()) {
      if (event.code === "Tab") trapFocus(event, required("first-launch"));
      return;
    }
    if (menuOpen()) {
      if (event.code === "Tab") {
        trapFocus(event);
        return;
      }
      if (handleTabKey(event)) return;
      if (event.code === "Escape") {
        event.preventDefault();
        closeMenu();
      } else if (activeTab === "moves" && event.code === "Space" && !event.repeat) {
        event.preventDefault();
        codexDemonstration?.toggle();
      }
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      openMenu();
    } else if ((event.code === "Space" || event.code === "KeyP") && !isFormControl(event.target)) {
      if (event.repeat) return;
      event.preventDefault();
      timeline.paused = !timeline.paused;
    } else if ((event.code === "Comma" || event.code === "BracketLeft") && !isFormControl(event.target)) {
      event.preventDefault();
      stepFrames(-1);
    } else if ((event.code === "Period" || event.code === "BracketRight") && !isFormControl(event.target)) {
      event.preventDefault();
      stepFrames(1);
    } else return;
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
  mount.addEventListener("pointerover", previewContent);
  mount.addEventListener("focusin", previewContent);
  window.addEventListener("keydown", keydown);
  document.addEventListener("visibilitychange", visibility);
  motionQuery.addEventListener("change", motionChange);
  if (developerTools) {
    void fetch("/api/lab/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((session: unknown) => {
        if (typeof session === "object" && session !== null && "username" in session && typeof session.username === "string") required("session-label").textContent = session.username;
      })
      .catch(() => undefined);
  }
  syncTutorialUi(tutorial.snapshot());
  showTab(activeTab);
  if (session.options.tutorial) startTutorial();
  render();
  animationId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationId);
    window.clearTimeout(captionTimer);
    mount.removeEventListener("click", click);
    mount.removeEventListener("change", change);
    mount.removeEventListener("input", input);
    mount.removeEventListener("pointerover", previewContent);
    mount.removeEventListener("focusin", previewContent);
    window.removeEventListener("keydown", keydown);
    document.removeEventListener("visibilitychange", visibility);
    motionQuery.removeEventListener("change", motionChange);
    keyboard.dispose();
    secondKeyboard.dispose();
    renderer.dispose();
    moveShowcase?.dispose();
    codexDemonstration?.dispose();
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

  function firstLaunchOpen(): boolean {
    const firstLaunch = mount.querySelector<HTMLElement>("#first-launch");
    return firstLaunch !== null && !firstLaunch.hidden;
  }

  function setFirstLaunchInert(inert: boolean): void {
    const firstLaunch = mount.querySelector<HTMLElement>("#first-launch");
    if (!firstLaunch) return;
    for (const child of required("game-content").children) {
      if (child === firstLaunch || !(child instanceof HTMLElement)) continue;
      child.inert = inert;
      if (inert) child.setAttribute("aria-hidden", "true");
      else child.removeAttribute("aria-hidden");
    }
  }

  function openMenu(): void {
    if (menuOpen()) return;
    focusBeforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resumeAfterMenu = !timeline.paused;
    timeline.paused = true;
    required("menu-scrim").hidden = false;
    setGameContentInert(true);
    syncDemonstrationActivity();
    const remembered = lastMenuFocus && lastMenuFocus.isConnected && !lastMenuFocus.closest("[hidden]")
      ? lastMenuFocus
      : mount.querySelector<HTMLButtonElement>(`[data-menu-tab='${activeTab}']`);
    remembered?.focus();
    if (activeTab === "loadout") tutorial.recordUi("arsenal-opened");
  }

  function closeMenu(): void {
    if (!menuOpen()) return;
    if (document.activeElement instanceof HTMLElement && required("lab-menu").contains(document.activeElement)) {
      lastMenuFocus = document.activeElement;
    }
    required("menu-scrim").hidden = true;
    syncDemonstrationActivity();
    setGameContentInert(false);
    if (pendingMatchReset) {
      resetMatch();
      pendingMatchReset = false;
    }
    buildChangeCounts.fill(0);
    syncBuildUi();
    if (resumeAfterMenu) timeline.paused = false;
    resumeAfterMenu = false;
    (focusBeforeMenu ?? mount.querySelector<HTMLButtonElement>("[data-action='menu']"))?.focus();
    tutorial.recordUi("returned-to-combat");
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

  function showTab(tab: MenuTab): void {
    activeTab = tab;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-menu-tab]")) {
      const active = button.dataset.menuTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const page of mount.querySelectorAll<HTMLElement>("[data-menu-page]")) {
      const active = page.dataset.menuPage === tab;
      page.hidden = !active;
      page.classList.toggle("active", active);
    }
    syncDemonstrationActivity();
    if (tab === "loadout") tutorial.recordUi("arsenal-opened");
    if (tab === "moves") tutorial.recordUi("codex-opened");
  }

  function syncDemonstrationActivity(): void {
    const open = menuOpen();
    const autoplay = document.documentElement.dataset.motion !== "reduced";
    moveShowcase?.setActive(open && activeTab === "loadout", autoplay);
    codexDemonstration?.setActive(open && activeTab === "moves", autoplay);
  }

  function showSettingsTab(tab: SettingsTab): void {
    activeSettingsTab = tab;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")) {
      const active = button.dataset.settingsTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const page of mount.querySelectorAll<HTMLElement>("[data-settings-panel]")) page.hidden = page.dataset.settingsPanel !== tab;
  }

  function switchPreset(index: number): void {
    if (tutorialBuildInstalled) return;
    if (!Number.isInteger(index) || index < 0 || index >= buildState.presets.length) return;
    buildState.activePreset = index;
    activeBuild = buildState.presets[index];
    selectedArmorSlot = "head";
    rebuildActiveBuild();
    selectAction(armedSlot, false);
    showMovePreview(activeBuild.loadout[0], true);
    const item = armorById(activeBuild.equipment[selectedArmorSlot]);
    if (item) renderArmorDetail(item.id);
  }

  function assignMove(slot: number, moveId: number): void {
    if (slot < 0 || slot >= activeBuild.loadout.length || !validMoveIds.has(moveId)) return;
    if (moveId !== 0 && !playerSave.unlocks.moves.includes(moveId)) return;
    armedSlot = slot;
    if (activeBuild.loadout[slot] === moveId) {
      const existing = playerCharacter.moves.find((candidate) => candidate.id === moveId);
      required("equip-feedback").textContent = `${existing ? moveName(existing) : "That slot"} is already ${existing ? "equipped" : "unassigned"} in ${actionSlotLabel(slot)}.`;
      return;
    }
    activeBuild.loadout[slot] = moveId;
    markBuildChanged();
    rebuildActiveBuild();
    tutorial.recordUi("move-replaced");
    if (moveId > 0) showMovePreview(moveId, true);
    const assigned = playerCharacter.moves.find((candidate) => candidate.id === moveId);
    required("equip-feedback").textContent = assigned
      ? `EQUIPPED · ${moveName(assigned)} → ${actionSlotLabel(slot)}`
      : `CLEARED · ${actionSlotLabel(slot)} is unassigned`;
  }

  function resetActiveLoadout(): void {
    if (!confirmDestructive("Restore the starter directional loadout?")) return;
    activeBuild.loadout = DEFAULT_MOVE_LOADOUT.slice();
    markBuildChanged();
    rebuildActiveBuild();
  }

  function selectAction(slot: number, focusCatalog = true): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= activeBuild.loadout.length) return;
    armedSlot = slot;
    for (const button of mount.querySelectorAll<HTMLElement>("[data-select-action]")) button.classList.toggle("selected", Number(button.dataset.selectAction) === slot);
    for (const row of mount.querySelectorAll<HTMLElement>("[data-arm-slot]")) row.classList.toggle("armed", Number(row.dataset.armSlot) === slot);
    const column = slot % 4;
    for (const route of mount.querySelectorAll<HTMLElement>("[data-route-column]")) route.classList.toggle("route-selected", Number(route.dataset.routeColumn) === column);
    if (activeBuild.loadout[slot] > 0) showMovePreview(activeBuild.loadout[slot]);
    syncArmedSlotUi();
    applyMoveFilters();
    if (focusCatalog) {
      const firstMove = required("move-library").querySelector<HTMLButtonElement>(".move-card:not([hidden])");
      firstMove?.focus();
      required("armed-slot-panel").scrollIntoView({ block: "nearest", behavior: preferences.accessibility.motion === "reduced" ? "auto" : "smooth" });
    }
  }

  function showInventoryTab(tab: InventoryTab): void {
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")) {
      const active = button.dataset.inventoryTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of mount.querySelectorAll<HTMLElement>("[data-inventory-panel]")) panel.hidden = panel.dataset.inventoryPanel !== tab;
  }

  function selectArmorSlot(slot: ArmorSlot): void {
    if (!ARMOR_SLOTS.includes(slot)) return;
    selectedArmorSlot = slot;
    for (const button of mount.querySelectorAll<HTMLElement>("[data-armor-slot]")) button.classList.toggle("selected", button.dataset.armorSlot === slot);
    const item = armorById(activeBuild.equipment[slot]);
    if (item) renderArmorDetail(item.id);
  }

  function equipArmor(itemId: string): void {
    const item = armorById(itemId);
    if (!item || !buildState.inventory.armor.includes(item.id)) return;
    selectedArmorSlot = item.slot;
    activeBuild.equipment[item.slot] = item.id;
    markBuildChanged();
    rebuildActiveBuild();
    renderArmorDetail(item.id);
  }

  function selectCraftArmor(itemId: string): void {
    const item = armorById(itemId);
    if (!item) return;
    selectedCraftArmorId = item.id;
    for (const button of mount.querySelectorAll<HTMLElement>("[data-craft-item]")) button.classList.toggle("selected", button.dataset.craftItem === item.id);
    replaceTrustedMarkup(required("craft-detail"), craftDetailMarkup(
      item,
      buildState.inventory,
      armorById(activeBuild.equipment[item.slot]),
      activeBuild.equipment,
      playerSave.unlocks.recipes.includes(item.id),
    ));
  }

  async function craftSelectedArmor(equip = false): Promise<void> {
    const item = armorById(selectedCraftArmorId);
    if (!item || !canCraftArmor(item, buildState.inventory)) return;
    if (!playerSave.unlocks.recipes.includes(item.id)) return;
    if (preferences.controls.holdToConfirm && !confirmDestructive(`Craft ${item.name} and spend its listed materials?`)) return;
    await craftPlayerArmor(playerSave, item.id);
    buildState.inventory = playerSave.inventory;
    if (!buildState.inventory.armor.includes(item.id)) return;
    if (equip) {
      activeBuild.equipment[item.slot] = item.id;
      markBuildChanged();
    }
    persistProgress();
    if (!mount.querySelector(`[data-armor-item='${item.id}']`)) appendTrustedMarkup(required("armor-inventory-grid"), armorInventoryButton(item));
    syncInventoryUi();
    if (equip) rebuildActiveBuild();
    selectCraftArmor(item.id);
  }

  function setCraftFilter(filter: string): void {
    craftFilter = filter;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-craft-filter]")) {
      button.classList.toggle("active", button.dataset.craftFilter === filter);
    }
    for (const recipe of mount.querySelectorAll<HTMLButtonElement>("[data-craft-item]")) {
      recipe.hidden = filter !== "all" &&
        !(filter === "new" && recipe.dataset.craftNew === "true") &&
        !(filter === "craftable" && recipe.dataset.craftReady === "true") &&
        recipe.dataset.craftSlot !== filter &&
        recipe.dataset.craftGrade !== filter;
    }
  }

  function rebuildActiveBuild(): void {
    const fresh = testFighterWithBuild(activeBuild.loadout, activeBuild.equipment);
    Object.assign(playerCharacter, fresh);
    persistProgress();
    syncBuildUi();
    if (showcasedMoveId > 0) showMovePreview(showcasedMoveId, true);
    pendingMatchReset = true;
  }

  function syncBuildUi(): void {
    for (const element of mount.querySelectorAll("[data-loadout-slot]")) {
      const select = element as unknown as HTMLSelectElement;
      const slot = Number(select.dataset.loadoutSlot);
      select.value = String(activeBuild.loadout[slot]);
      const move = playerCharacter.moves.find((candidate) => candidate.id === activeBuild.loadout[slot]);
      const tags = mount.querySelector<HTMLElement>(`[data-assignment-tags='${slot}']`);
      if (tags) tags.textContent = move?.tags.slice(0, 3).join(" · ") ?? "unassigned";
      const row = select.closest<HTMLElement>("[data-move-preview]");
      if (row) row.dataset.movePreview = String(activeBuild.loadout[slot]);
      const mapped = mount.querySelector<HTMLElement>(`[data-select-action='${slot}']`);
      if (mapped) mapped.dataset.movePreview = String(activeBuild.loadout[slot]);
    }
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
      const active = Number(button.dataset.preset) === buildState.activePreset;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", `Loadout ${Number(button.dataset.preset) + 1}: ${buildState.presets[Number(button.dataset.preset)]?.name ?? "Build"}`);
    }
    for (const label of mount.querySelectorAll<HTMLElement>("[data-build-number]")) label.textContent = `BUILD ${String(buildState.activePreset + 1).padStart(2, "0")}`;
    const buildName = mount.querySelector<HTMLInputElement>("[data-build-name]");
    if (buildName && document.activeElement !== buildName) buildName.value = activeBuild.name;
    const changes = buildChangeCounts[buildState.activePreset];
    for (const dirty of mount.querySelectorAll<HTMLElement>("[data-build-dirty]")) dirty.textContent = changes > 0 ? " *" : "";
    for (const output of mount.querySelectorAll<HTMLOutputElement>("[data-build-changes]")) output.textContent = changes > 0 ? `${changes} change${changes === 1 ? "" : "s"} · saved · applies on close` : "All changes applied";
    for (const element of mount.querySelectorAll<HTMLElement>("[data-equipped-move]")) {
      const moveId = Number(element.dataset.equippedMove);
      const summary = equippedSummary(activeBuild.loadout, moveId);
      element.textContent = summary;
      element.classList.toggle("not-equipped", equippedSlots(activeBuild.loadout, moveId).length === 0);
    }
    syncArmedSlotUi();
    applyMoveFilters();
    applyCodexSearch();
    setText("character-sheet-title", activeBuild.name);
    setText("stat-vitality", String(playerCharacter.health));
    setText("stat-stamina", String(playerCharacter.stamina));
    setText("stat-armor", String(playerCharacter.armor));
    setText("stat-resist-poison", String(playerCharacter.resistances.poison));
    setText("stat-resist-fire", String(playerCharacter.resistances.fire));
    setText("stat-resist-frost", String(playerCharacter.resistances.frost));
    setText("stat-resist-shock", String(playerCharacter.resistances.shock));
    const skillBoard = mount.querySelector<HTMLElement>("#skill-board");
    if (skillBoard) replaceTrustedMarkup(skillBoard, skillBoardMarkup(armorSkillPoints(activeBuild.equipment)));
    for (const slot of ARMOR_SLOTS) {
      const item = armorById(activeBuild.equipment[slot]);
      const button = mount.querySelector<HTMLButtonElement>(`[data-armor-slot='${slot}']`);
      if (!button || !item) continue;
      button.className = `gear-slot grade-${item.grade}${selectedArmorSlot === slot ? " selected" : ""}`;
      button.setAttribute("aria-label", `${slot}: ${item.name}`);
      const icon = button.querySelector<HTMLElement>(".gear-icon");
      const name = button.querySelector<HTMLElement>("[data-equipped-name]");
      const armor = button.querySelector<HTMLElement>("[data-equipped-armor]");
      if (icon) icon.textContent = item.icon;
      if (name) name.textContent = item.name;
      if (armor) armor.textContent = `${item.armor} armor`;
    }
  }

  function syncArmedSlotUi(): void {
    const panel = mount.querySelector<HTMLElement>("#armed-slot-panel");
    if (!panel) return;
    const move = playerCharacter.moves.find((candidate) => candidate.id === activeBuild.loadout[armedSlot]);
    const bank = ACTION_BANKS[Math.trunc(armedSlot / 4)];
    const family = ["FIRE", "POISON", "FREEZE", "SHOCK"][armedSlot % 4];
    replaceTrustedMarkup(panel, `<span>${family} ROUTE</span><strong>${actionSlotInput(armedSlot)}</strong><em>${bank.input.toUpperCase()} / ${["STARTER", "LINK", "CASHOUT", "UTILITY"][Math.trunc(armedSlot / 4)]}</em><small>CURRENTLY: ${move ? moveName(move).toUpperCase() : "UNASSIGNED"}</small>`);
  }

  function markBuildChanged(amount = 1): void {
    if (tutorialBuildInstalled) return;
    buildChangeCounts[buildState.activePreset] += amount;
  }

  function renameActiveBuild(value: string): void {
    const name = value.trim().slice(0, 32);
    if (!name || name === activeBuild.name) {
      const input = mount.querySelector<HTMLInputElement>("[data-build-name]");
      if (input) input.value = activeBuild.name;
      return;
    }
    activeBuild.name = name;
    markBuildChanged();
    persistProgress();
    syncBuildUi();
  }

  function handlePresetAction(action: string): void {
    if (tutorialBuildInstalled) {
      required("equip-feedback").textContent = "Tutorial build active · your presets are protected.";
      return;
    }
    if (action === "rename") {
      const input = mount.querySelector<HTMLInputElement>("[data-build-name]");
      input?.focus();
      input?.select();
      return;
    }
    if (action === "duplicate") {
      const chooser = mount.querySelector<HTMLElement>("[data-duplicate-chooser]");
      if (chooser) {
        chooser.hidden = !chooser.hidden;
        if (!chooser.hidden) chooser.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
      }
      return;
    }
    if (action === "clear") {
      if (!confirmDestructive("Clear all sixteen move assignments and restore default equipment?")) return;
      activeBuild.loadout = Array.from({ length: activeBuild.loadout.length }, () => 0);
      activeBuild.equipment = { ...createDefaultPlayerSave().loadouts.byId["loadout-01"].equipment };
      markBuildChanged();
      rebuildActiveBuild();
      showMovePreview(playerCharacter.moves[0].id, true);
      return;
    }
    if (action === "reset") {
      if (!confirmDestructive(`Reset ${activeBuild.name} to its shipped preset?`)) return;
      const defaults = createDefaultPlayerSave();
      const fallback = defaults.loadouts.byId[defaults.loadouts.order[buildState.activePreset]];
      activeBuild.name = fallback.name;
      activeBuild.loadout = fallback.loadout.slice();
      activeBuild.equipment = { ...fallback.equipment };
      markBuildChanged();
      rebuildActiveBuild();
      showMovePreview(activeBuild.loadout[0], true);
    }
  }

  function duplicateInto(target: number): void {
    if (!Number.isInteger(target) || target < 0 || target >= buildState.presets.length || target === buildState.activePreset) return;
    const replaced = buildState.presets[target];
    if (!confirmDestructive(`Overwrite build ${target + 1}, ${replaced.name}, with a copy of ${activeBuild.name}?`)) return;
    buildState.presets[target] = {
      name: `${activeBuild.name.replace(/\s+Copy(?: \d+)?$/, "")} Copy`.slice(0, 32),
      loadout: activeBuild.loadout.slice(),
      equipment: { ...activeBuild.equipment },
    };
    buildChangeCounts[target] += 1;
    const chooser = mount.querySelector<HTMLElement>("[data-duplicate-chooser]");
    if (chooser) chooser.hidden = true;
    switchPreset(target);
  }

  function showRouteChooser(button: HTMLButtonElement): void {
    const chooser = button.parentElement?.querySelector<HTMLElement>("[data-equip-route-chooser]");
    if (!chooser) return;
    chooser.hidden = !chooser.hidden;
    tutorial.recordUi("route-inspected");
    if (!chooser.hidden) chooser.querySelector<HTMLButtonElement>("button")?.focus();
  }

  function equipRoute(column: number, routeText: string): void {
    if (!Number.isInteger(column) || column < 0 || column > 3) return;
    const route = routeText.split(",").map(Number).filter((moveId) => validMoveIds.has(moveId)).slice(0, 3);
    if (route.length < 2) return;
    route.forEach((moveId, bank) => { activeBuild.loadout[bank * 4 + column] = moveId; });
    markBuildChanged(route.length);
    rebuildActiveBuild();
    selectAction(column, false);
    showMovePreview(route[0], true);
    required("equip-feedback").textContent = `ROUTE EQUIPPED · ${["↑ / Y", "← / X", "→ / B", "↓ / A"][column]} · ${route.map((moveId) => moveName(playerCharacter.moves.find((move) => move.id === moveId)!)).join(" → ")}`;
  }

  function confirmDestructive(message: string): boolean {
    return window.confirm(message);
  }

  function persistProgress(): void {
    syncBuildStateToPlayerSave(playerSave, buildState);
    cachePlayerSave(playerSave);
    void persistPlayerSave(playerSave);
  }

  async function grantBellWardenReward(): Promise<void> {
    if (!campaign || campaign.completedBosses.includes("bell-warden")) return;
    await claimBossReward(playerSave, "black-belfry", "bell-warden");
    buildState.inventory = playerSave.inventory;
    if (!campaign.completedBosses.includes("bell-warden")) return;
    syncInventoryUi();
    const graveToll = mount.querySelector<HTMLButtonElement>(`[data-equip-move='${MoveId.GraveToll}']`);
    if (graveToll) {
      graveToll.disabled = false;
      graveToll.classList.remove("locked");
      graveToll.querySelector("em")!.textContent = "mid";
      const equipped = graveToll.querySelector<HTMLElement>("[data-equipped-move]");
      if (equipped) equipped.textContent = "NOT EQUIPPED";
    }
    const reward = required("campaign-reward");
    reward.hidden = false;
    timeline.paused = true;
    reward.querySelector<HTMLButtonElement>("[data-action='campaign-preview']")?.focus();
  }

  async function confirmStageEvent(entityId: number): Promise<void> {
    await applyStageEvent(playerSave, "black-belfry", entityId);
    buildState.inventory = playerSave.inventory;
    syncInventoryUi();
  }

  function syncCampaignHud(state: ReturnType<Simulation["getState"]>): void {
    const objective = mount.querySelector<HTMLElement>("#campaign-objective");
    const loot = mount.querySelector<HTMLElement>("#campaign-loot");
    if (!objective || !loot || !campaign) return;
    const playerX = state.fighters[0]?.x ?? BLACK_BELFRY.spawnX;
    objective.textContent = state.fighters[0].health === 0
      ? "Fallen · press E / RB to return to the checkpoint"
      : campaign.completedBosses.includes("bell-warden")
      ? "Refine your new build at the Forge"
      : state.fighters[enemyIndex].health === 0
        ? "Claim the Warden's resonant reward"
        : state.stage.bossActive === 1
          ? (state.fighters[enemyIndex].health * 100 <= dummyCharacter.health * 58 ? "Phase II · chains unbound" : "Read · defend · punish")
          : playerX < px(-300)
              ? "Traverse the Black Belfry"
              : playerX < px(390)
                ? "Reach the crossing checkpoint"
                : "Open the boss gate · E / RB";
    loot.textContent = `Iron Scrap ${buildState.inventory.materials["iron-scrap"] ?? 0} · Stormglass ${buildState.inventory.materials.stormglass ?? 0} · Warden Core ${buildState.inventory.materials["warden-core"] ?? 0}`;
  }

  function setMoveFilter(kind: string, value: string): void {
    if (kind === "role") moveRoleFilter = value;
    if (kind === "family") moveFamilyFilter = value;
    if (kind === "terrain") moveTerrainFilter = value;
    for (const button of mount.querySelectorAll<HTMLButtonElement>(`[data-move-filter='${kind}']`)) {
      const active = button.dataset.filterValue === value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    applyMoveFilters();
  }

  function applyMoveFilters(): void {
    const library = mount.querySelector<HTMLElement>("#move-library");
    if (!library) return;
    const cards = [...library.querySelectorAll<HTMLButtonElement>(".move-card[data-equip-move]")];
    const bank = Math.trunc(armedSlot / 4);
    const priority: Record<number, readonly string[]> = {
      0: ["starter", "reversal", "link", "cashout"],
      1: ["link", "starter", "reversal", "cashout"],
      2: ["link", "cashout", "starter", "reversal"],
      3: ["cashout", "reversal", "link", "starter"],
    };
    cards.sort((a, b) => {
      const roles = priority[bank] ?? priority[0];
      return roles.indexOf(a.dataset.moveRole ?? "starter") - roles.indexOf(b.dataset.moveRole ?? "starter")
        || Number(a.dataset.equipMove) - Number(b.dataset.equipMove);
    });
    let visible = 0;
    for (const card of cards) {
      const matchesRole = moveRoleFilter === "all" || card.dataset.moveRole === moveRoleFilter;
      const matchesFamily = moveFamilyFilter === "all" || (card.dataset.moveFamily ?? "").split(" ").includes(moveFamilyFilter);
      const matchesTerrain = moveTerrainFilter === "all" || card.dataset.moveTerrain === moveTerrainFilter;
      const matchesSearch = !moveSearch || (card.dataset.moveSearchText ?? "").includes(moveSearch);
      card.hidden = !(matchesRole && matchesFamily && matchesTerrain && matchesSearch);
      if (!card.hidden) visible++;
      library.appendChild(card);
    }
    setText("move-result-count", String(visible));
    const empty = mount.querySelector<HTMLElement>("#move-library-empty");
    if (empty) empty.hidden = visible > 0;
  }

  function applyCodexSearch(): void {
    let firstVisible: HTMLButtonElement | null = null;
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-codex-move]")) {
      button.hidden = Boolean(codexSearch) && !(button.dataset.codexSearchText ?? "").includes(codexSearch);
      if (!button.hidden && !firstVisible) firstVisible = button;
    }
    if (codexSearch && firstVisible && !mount.querySelector("[data-codex-move].previewing:not([hidden])")) showMovePreview(Number(firstVisible.dataset.codexMove), true);
  }

  function syncInventoryUi(): void {
    setText("owned-armor-count", String(buildState.inventory.armor.length));
    setText("craft-owned-count", String(buildState.inventory.armor.length));
    for (const element of mount.querySelectorAll<HTMLElement>("[data-material-count]")) {
      const id = element.dataset.materialCount ?? "";
      element.textContent = String(buildState.inventory.materials[id] ?? 0);
    }
    for (const button of [...mount.querySelectorAll<HTMLButtonElement>("[data-craft-item]")]) {
      const item = armorById(button.dataset.craftItem ?? "");
      if (item) replaceElementWithTrustedMarkup(button, craftRecipeButton(
        item,
        buildState.inventory,
        playerSave.unlocks.recipes.includes(item.id),
      ));
    }
    setCraftFilter(craftFilter);
  }

  function renderArmorDetail(itemId: string): void {
    const item = armorById(itemId);
    const detail = mount.querySelector<HTMLElement>("#gear-detail");
    if (!item || !detail) return;
    replaceTrustedMarkup(detail, armorDetailMarkup(
      item,
      armorById(activeBuild.equipment[item.slot]),
      activeBuild.equipment,
    ));
  }

  function renderMaterialDetail(materialId: string): void {
    const material = materialById(materialId);
    const detail = mount.querySelector<HTMLElement>("#gear-detail");
    if (!material || !detail) return;
    replaceTrustedMarkup(detail, materialDetailMarkup(material, buildState.inventory));
  }

  function showMovePreview(moveId: number, force = false): void {
    const move = playerCharacter.moves.find((candidate) => candidate.id === moveId)
      ?? (force ? playerCharacter.moves[0] : undefined);
    if (!move || (!force && showcasedMoveId === move.id)) return;
    showcasedMoveId = move.id;
    timelinePinnedMoveId = move.id;
    renderedTimelineMoveId = -1;
    const autoplay = document.documentElement.dataset.motion !== "reduced";
    moveShowcase?.select(move.id, autoplay);
    const codexTimeline = mount.querySelector<HTMLElement>("#codex-move-timeline");
    const codexDetail = mount.querySelector<HTMLElement>("#codex-move-detail");
    const routeTopology = mount.querySelector<HTMLElement>("#move-route-topology");
    if (codexTimeline) replaceTrustedMarkup(codexTimeline, moveTimelineMarkup(move));
    if (codexDetail) replaceTrustedMarkup(codexDetail, codexMoveDetailMarkup(move, playerCharacter, activeBuild.loadout));
    if (routeTopology) replaceTrustedMarkup(routeTopology, routeTopologyMarkup(move, playerCharacter, activeBuild.loadout));
    decorateCodexTimeline(move);
    codexDemonstration?.select(move.id, autoplay);
    const hitbox = move.hitboxes[0];
    const level = hitbox?.level === HitLevel.Low ? "LOW" : hitbox?.level === HitLevel.Overhead ? "OVERHEAD" : "MID";
    setText("move-showcase-code", `MOVE ${String(move.id).padStart(2, "0")} · ${level}`);
    setText("move-showcase-name", move.key.replaceAll("_", " "));
    setText("move-showcase-description", move.description);
    setText("move-stat-damage", String(hitbox?.damage ?? 0));
    setText("move-stat-stamina", String(move.staminaCost));
    setText("move-stat-startup", `${move.startup}f`);
    setText("move-stat-active", `${move.active}f`);
    setText("move-stat-recovery", `${move.recovery}f`);
    setText("move-stat-hitstun", `${hitbox?.hitstun ?? 0}f`);
    setText("move-stat-blockstun", `${hitbox?.blockstun ?? 0}f`);
    const showcaseTags = mount.querySelector<HTMLElement>("#move-showcase-tags");
    if (showcaseTags) replaceTrustedMarkup(showcaseTags, move.tags.map((tag) => `<li>${tag}</li>`).join(""));
    const showcaseEquipped = mount.querySelector<HTMLElement>(".showcase-equipped");
    if (showcaseEquipped) {
      showcaseEquipped.dataset.equippedMove = String(move.id);
      showcaseEquipped.textContent = equippedSummary(activeBuild.loadout, move.id);
      showcaseEquipped.classList.toggle("not-equipped", equippedSlots(activeBuild.loadout, move.id).length === 0);
    }
    for (const card of mount.querySelectorAll<HTMLElement>("[data-move-preview]")) card.classList.toggle("previewing", Number(card.dataset.movePreview) === move.id);
  }

  function decorateCodexTimeline(move: MoveDef): void {
    for (const cell of mount.querySelectorAll<HTMLElement>("#codex-move-timeline [data-frame]")) {
      const frame = Number(cell.dataset.frame);
      cell.title = describeMoveFrame(move, frame, playerCharacter);
    }
  }

  function syncCodexDemonstrationUi(state: MoveDemonstrationState): void {
    const readout = mount.querySelector<HTMLElement>("#codex-frame-readout");
    if (readout) readout.textContent = `${String(state.frame + 1).padStart(2, "0")} / ${String(state.move.duration).padStart(2, "0")}`;
    const scrubber = mount.querySelector<HTMLInputElement>("#codex-frame-scrubber");
    if (scrubber) {
      scrubber.max = String(state.move.duration);
      scrubber.value = String(state.frame + 1);
      scrubber.setAttribute("aria-valuetext", `Frame ${state.frame + 1} of ${state.move.duration}`);
    }
    const detail = mount.querySelector<HTMLOutputElement>("#codex-frame-detail");
    if (detail) detail.textContent = `${state.phase.toUpperCase()}\n${describeMoveFrame(state.move, state.frame, playerCharacter)}`;
    const toggle = mount.querySelector<HTMLButtonElement>("[data-action='demo-toggle']");
    if (toggle) toggle.textContent = state.playing ? "Pause" : "Play";
    for (const cell of mount.querySelectorAll<HTMLElement>("#codex-move-timeline [data-frame]")) cell.classList.toggle("playhead", Number(cell.dataset.frame) === state.frame);
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-demo-mode]")) {
      const active = button.dataset.demoMode === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const button of mount.querySelectorAll<HTMLButtonElement>("[data-demo-speed]")) {
      const active = Number(button.dataset.demoSpeed) === state.speed;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function setDemonstrationMode(mode: MoveDemonstrationMode): void {
    codexDemonstration?.setMode(mode, document.documentElement.dataset.motion !== "reduced");
    if (mode === "hit" || mode === "block") tutorial.recordUi("demo-mode-changed");
  }

  function setDemonstrationSpeed(speed: number): void {
    codexDemonstration?.setSpeed(speed);
  }

  function renderFrameTimeline(activeMoveId: number, activeMoveFrame: number): void {
    const console = mount.querySelector<HTMLElement>("#move-timeline-console");
    if (!console) return;
    const activeMove = playerCharacter.moves.find((candidate) => candidate.id === activeMoveId);
    if (activeMove) timelinePinnedMoveId = activeMove.id;
    if (timelinePinnedMoveId < 0) timelinePinnedMoveId = showcasedMoveId;
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

  function captureCurrentScenario(): void {
    const state = sim.getState();
    if (timeline.recordedInputs(state.frame).length !== state.frame) {
      setScenarioStatus("Reset the match before capturing: this run did not begin at frame 0.", false);
      return;
    }
    const move = playerCharacter.moves.find((candidate) => candidate.id === state.fighters[0].moveId)
      ?? playerCharacter.moves.find((candidate) => candidate.id === timelinePinnedMoveId);
    const name = `${playerCharacter.id}_${move?.key ?? "neutral"}_frame_${state.frame}`;
    capturedScenario = captureScenario(sim, timeline, name);
    setScenarioButtons(true);
    setScenarioStatus(`Captured ${state.frame} frames · ${capturedScenario.expected.contacts.length} contacts · expected ${capturedScenario.expected.hash}`, true);
  }

  function replayCapturedScenario(): void {
    if (!capturedScenario) return;
    try {
      const result = replayScenario(sim, timeline, capturedScenario);
      lastReport = timeline.lastReport;
      selectedInteraction = null;
      interactionRenderKey = "";
      setScenarioStatus(
        result.matches
          ? `PASS · ${result.reports} frames reproduced hash ${result.actualHash}`
          : `FAIL · expected ${result.expectedHash}, received ${result.actualHash} at frame ${result.stateFrame}`,
        result.matches,
      );
    } catch (error) {
      setScenarioStatus(error instanceof Error ? error.message : "Scenario replay failed.", false);
    }
  }

  function exportCapturedScenario(): void {
    if (!capturedScenario) return;
    const href = URL.createObjectURL(new Blob([scenarioJson(capturedScenario)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `${capturedScenario.name}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    setScenarioStatus(`Exported ${link.download}`, true);
  }

  async function importScenarioFile(file: File | null): Promise<void> {
    if (!file) return;
    try {
      capturedScenario = parseScenario(JSON.parse(await file.text()) as unknown);
      setScenarioButtons(true);
      setScenarioStatus(`Imported ${capturedScenario.name} · ${capturedScenario.inputs.length} frames · expected ${capturedScenario.expected.hash}`, true);
    } catch (error) {
      capturedScenario = null;
      setScenarioButtons(false);
      setScenarioStatus(error instanceof Error ? error.message : "Scenario import failed.", false);
    }
  }

  function setScenarioButtons(enabled: boolean): void {
    for (const action of ["scenario-replay", "scenario-export"]) {
      const button = mount.querySelector<HTMLButtonElement>(`[data-action='${action}']`);
      if (button) button.disabled = !enabled;
    }
  }

  function setScenarioStatus(message: string, success: boolean): void {
    const status = required("scenario-status");
    status.textContent = message;
    status.classList.toggle("pass", success);
    status.classList.toggle("fail", !success);
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

  function startTutorial(): void {
    markTutorialSeen();
    const firstLaunch = mount.querySelector<HTMLElement>("#first-launch");
    if (firstLaunch) firstLaunch.hidden = true;
    setFirstLaunchInert(false);
    if (menuOpen()) closeMenu();
    const defaults = createDefaultPlayerSave().loadouts.byId["loadout-01"];
    activeBuild = {
      name: "Tutorial Fire Route",
      loadout: DEFAULT_MOVE_LOADOUT.slice(),
      equipment: { ...defaults.equipment },
    };
    tutorialBuildInstalled = true;
    Object.assign(playerCharacter, testFighterWithBuild(activeBuild.loadout, activeBuild.equipment));
    syncBuildUi();
    showMovePreview(activeBuild.loadout[0], true);
    pendingMatchReset = false;
    resetMatch();
    timeline.paused = false;
    tutorial.start();
  }

  function finishTutorial(): void {
    stopTutorial(true);
  }

  function exitTutorial(): void {
    stopTutorial(false);
  }

  function stopTutorial(completed: boolean): void {
    if (menuOpen()) closeMenu();
    tutorial.stop();
    if (completed) {
      playerSave.campaign.tutorialComplete = true;
      persistProgress();
    }
    tutorialBuildInstalled = false;
    activeBuild = buildState.presets[buildState.activePreset];
    Object.assign(playerCharacter, testFighterWithBuild(activeBuild.loadout, activeBuild.equipment));
    syncBuildUi();
    pendingMatchReset = false;
    resetMatch();
    timeline.paused = false;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("tutorial");
    window.history.replaceState(null, "", cleanUrl);
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
  }

  function skipFirstLaunch(): void {
    markTutorialSeen();
    const firstLaunch = mount.querySelector<HTMLElement>("#first-launch");
    if (firstLaunch) firstLaunch.hidden = true;
    setFirstLaunchInert(false);
    timeline.paused = false;
    playerSave.campaign.tutorialComplete = true;
    persistProgress();
    if (campaign) return;
    openMenu();
    showTab("training");
    mount.querySelector<HTMLButtonElement>("[data-menu-tab='training']")?.focus();
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
    const summary = mount.querySelector<HTMLElement>("#tutorial-progress-summary");
    if (summary) replaceTrustedMarkup(summary, TUTORIAL_LESSONS.map((lesson, index) => `<article class="${snapshot.completedLessons.includes(lesson.id) ? "complete" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${lesson.title}</strong><em>${snapshot.completedLessons.includes(lesson.id) ? "COMPLETE" : "READY"}</em></article>`).join(""));
  }

  function textIn(root: HTMLElement, selector: string, value: string): void {
    const target = root.querySelector<HTMLElement>(selector);
    if (target) target.textContent = value;
  }

  function resetMatch(): void {
    timeline.reset();
    dummy.reset();
    boss.reset();
    if (gameMode === "fight") {
      sim.getState().stage.bossActive = 1;
      sim.getState().stage.arenaLocked = 1;
    }
    if (campaignMode && campaign && !tutorial.active && campaign.checkpointId !== 0) {
      const state = sim.getState();
      const checkpoint = BLACK_BELFRY.interactables.find((entity) => entity.id === campaign.checkpointId);
      if (checkpoint) state.fighters[0].x = checkpoint.x;
    }
    if (tutorial.active) {
      const state = sim.getState();
      state.fighters[0].x = px(-18);
      state.fighters[1].x = px(18);
      state.stage.arenaLocked = 0;
      state.stage.bossActive = 0;
      state.stage.bossActivatedFrame = 0;
    }
    lastPlayerInput = 0;
    lastReport = null;
    selectedInteraction = null;
    interactionRenderKey = "";
  }

  function stepFrames(count: number): void {
    timeline.paused = true;
    const reports = timeline.stepFrames(count);
    lastReport = timeline.lastReport;
    if (reports.length > 0) processReports(reports);
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
      for (const event of report.entityEvents) {
        if (!campaign) continue;
        if (event.kind === EntityEventKind.PickedUp && event.entityKind === EntityKind.MaterialPickup) void confirmStageEvent(event.entityId);
        if (event.kind === EntityEventKind.Interacted && event.owner === InteractableKind.Checkpoint) void confirmStageEvent(event.entityId);
        if (event.kind === EntityEventKind.Interacted && event.owner === InteractableKind.Chest) void confirmStageEvent(event.entityId);
        if (event.kind === EntityEventKind.Interacted && event.owner === InteractableKind.BossReward) {
          void grantBellWardenReward();
        }
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
      ["burn", fighter.burnStacks, fighter.burnFrames], ["poison", fighter.poisonStacks, fighter.poisonFrames],
      ["freeze", fighter.freezeStacks, fighter.freezeFrames], ["shock", fighter.shockStacks, fighter.shockFrames],
      ["bleed", fighter.bleedStacks, fighter.bleedFrames],
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
      previousUi = now;
      return;
    }
    if (edge(now, previousUi, "back") || edge(now, previousUi, "menu")) closeMenu();
    if (edge(now, previousUi, "leftBumper")) cycleTab(-1);
    if (edge(now, previousUi, "rightBumper")) cycleTab(1);
    if (edge(now, previousUi, "up")) focusGamepadTarget("up");
    if (edge(now, previousUi, "down")) focusGamepadTarget("down");
    if (edge(now, previousUi, "left") && !adjustFocused(-1)) focusGamepadTarget("left");
    if (edge(now, previousUi, "right") && !adjustFocused(1)) focusGamepadTarget("right");
    if (edge(now, previousUi, "confirm")) activateFocused();
    previousUi = now;
  }

  function visibleGamepadTargets(): HTMLElement[] {
    return [...mount.querySelectorAll<HTMLElement>("[data-gamepad-nav]")].filter((element) => !element.closest("[hidden]") && !(element instanceof HTMLButtonElement && element.disabled));
  }

  function focusGamepadTarget(direction: "up" | "down" | "left" | "right"): void {
    const targets = visibleGamepadTargets();
    if (targets.length === 0) return;
    const current = document.activeElement instanceof HTMLElement
      ? targets.find((target) => target === document.activeElement || target.contains(document.activeElement))
      : undefined;
    if (!current) {
      mount.querySelector<HTMLButtonElement>(`[data-menu-tab='${activeTab}']`)?.focus();
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
    if (!next && preferences.controls.menuWrap) {
      const wrapped = targets.filter((target) => target !== current).sort((a, b) => {
        const ca = centerOf(a.getBoundingClientRect());
        const cb = centerOf(b.getBoundingClientRect());
        const edgeA = direction === "left" ? -ca.x : direction === "right" ? ca.x : direction === "up" ? -ca.y : ca.y;
        const edgeB = direction === "left" ? -cb.x : direction === "right" ? cb.x : direction === "up" ? -cb.y : cb.y;
        return edgeB - edgeA;
      });
      next = wrapped[0];
    }
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

  function cycleTab(delta: number): void {
    const tabs = [...mount.querySelectorAll<HTMLElement>("[data-menu-tab]")]
      .map((tab) => tab.dataset.menuTab)
      .filter((tab): tab is MenuTab => tab !== undefined);
    const index = tabs.indexOf(activeTab);
    showTab(tabs[(index + delta + tabs.length) % tabs.length]);
    mount.querySelector<HTMLButtonElement>(`[data-menu-tab='${activeTab}']`)?.focus();
  }

  function handleTabKey(event: KeyboardEvent): boolean {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.code)) return false;
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[role='tab']") : null;
    if (!target) return false;
    event.preventDefault();
    const settings = target.dataset.settingsTab !== undefined;
    const inventory = target.dataset.inventoryTab !== undefined;
    const tabs = settings
      ? [...mount.querySelectorAll<HTMLButtonElement>("[data-settings-tab]")]
      : inventory ? [...mount.querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")]
        : [...mount.querySelectorAll<HTMLButtonElement>("[data-menu-tab]")];
    const index = tabs.indexOf(target);
    const next = event.code === "Home" ? 0 : event.code === "End" ? tabs.length - 1 : (index + (event.code === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const button = tabs[next];
    if (settings) showSettingsTab(button.dataset.settingsTab as SettingsTab);
    else if (inventory) showInventoryTab(button.dataset.inventoryTab as InventoryTab);
    else showTab(button.dataset.menuTab as MenuTab);
    button.focus();
    return true;
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

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function centerOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function cueForDebuff(debuff: number): "burn" | "poison" | "freeze" | "shock" | "bleed" {
  if (debuff === DebuffKind.Burn) return "burn";
  if (debuff === DebuffKind.Poison) return "poison";
  if (debuff === DebuffKind.Freeze) return "freeze";
  if (debuff === DebuffKind.Shock) return "shock";
  return "bleed";
}
