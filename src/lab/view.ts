import type { CharacterDef } from "../combat/types";
import { HitLevel } from "../combat/types";
import type { LabPreferences } from "./preferences";

interface LabViewOptions {
  character: CharacterDef;
  preferences: LabPreferences;
  dummyOptions: readonly [number, string][];
  hitboxesEnabled?: boolean;
  slowMotionEnabled?: boolean;
  skeletonEnabled?: boolean;
}

const KIT_INPUTS = ["↑ / Y", "← / X", "→ / B", "↓ / A"] as const;

export function buildLabView({ character, preferences, dummyOptions, hitboxesEnabled = false, slowMotionEnabled = false, skeletonEnabled = false }: LabViewOptions): string {
  const hud = fighterHudMarkup(character.health);
  return `<a class="skip-link" href="#game-content">Skip to game content</a>
  <main class="lab-shell" id="game-content">
    <section class="training-bar" aria-label="Training controls">
      <button class="primary" id="pause-control" type="button" data-action="pause" data-gamepad-nav>Pause</button>
      <button type="button" data-action="reset" data-gamepad-nav>Reset</button>
      <label data-gamepad-nav tabindex="0"><span>Dummy</span><select data-control="dummy" aria-label="Training dummy">${dummyOptions.map(([value, label]) => option(value, label)).join("")}</select></label>
      <button class="training-toggle" type="button" data-action="slow-mo" data-gamepad-nav aria-pressed="${slowMotionEnabled}">Slow-mo</button>
      <button class="training-toggle" type="button" data-action="hitboxes" data-gamepad-nav aria-pressed="${hitboxesEnabled}">Hitboxes</button>
      <button class="training-toggle" type="button" data-action="skeleton" data-gamepad-nav aria-pressed="${skeletonEnabled}">Skeleton</button>
      <button type="button" data-action="menu" data-gamepad-nav aria-haspopup="dialog">Menu</button>
    </section>

    <aside class="tutorial-hud" id="tutorial-hud" aria-live="polite" hidden><header><span id="tutorial-lesson-count">LESSON 1 / 4</span><strong id="tutorial-title">Move</strong></header><div class="tutorial-objective"><small>OBJECTIVE</small><b id="tutorial-objective">Walk with A or D</b><em id="tutorial-success"></em></div><p id="tutorial-hint"></p><footer><button class="primary" type="button" data-action="next-tutorial-lesson" data-gamepad-nav hidden>Next lesson</button><button type="button" data-action="exit-tutorial" data-gamepad-nav>Exit tutorial</button></footer></aside>

    <section class="playfield-card" aria-label="Combat arena"><div class="hud" aria-label="Fighter health">${hud}</div><div id="stage" class="stage"></div><div class="paused-overlay" id="paused-overlay" role="status" hidden><strong>PAUSED</strong><span>Press Start or Space to resume</span></div><div class="current-route"><span>ACTIVE</span><strong id="active-move">Ready</strong><em id="active-tags">Move, strike, and practice the route</em></div></section>

    <footer class="control-hint">WASD / stick: move · Arrows / Y X B A: attacks · Space / Start: pause · Esc / View: menu · Pause, then D-pad ↑↓ + A: controls<span class="sr-only" id="controller-state">Keyboard ready</span></footer>

    <div class="menu-scrim" id="menu-scrim" hidden><aside class="lab-menu" id="lab-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title" tabindex="-1"><header class="menu-header"><div><p class="eyebrow">HEXFRAME / TRAINING</p><h2 id="menu-title">Pause menu</h2></div></header><nav class="pause-menu-list" aria-label="Pause menu"><button class="primary" type="button" data-action="close-menu" data-gamepad-nav>Resume</button><button type="button" data-action="reset" data-gamepad-nav>Restart</button><button type="button" data-action="start-tutorial" data-gamepad-nav>Tutorial</button><button type="button" data-menu-detail-target="moves" data-gamepad-nav>Moves</button><button type="button" data-menu-detail-target="settings" data-gamepad-nav>Settings</button><button type="button" data-menu-detail-target="controls" data-gamepad-nav>Controls</button><button type="button" data-action="return-main" data-gamepad-nav>Exit</button></nav><section class="menu-detail" id="menu-detail" aria-live="polite"><section data-menu-detail="moves" hidden><div class="settings-heading"><h2>Move list</h2><span>The fixed four-button kit and its authored frame data.</span></div>${moveListMarkup(character)}</section><section data-menu-detail="settings" hidden><div class="settings-heading"><h2>Settings</h2><span>One page of settings with behavior in the current Training MVP.</span></div>${settingsMarkup(preferences)}</section><section data-menu-detail="controls" hidden><div class="settings-heading"><h2>Controls</h2></div>${controlsMarkup()}</section></section><footer class="menu-footer"><span>Keyboard: Tab / arrows · Gamepad: D-pad + A · B/View closes</span></footer></aside></div>
  </main>`;
}

function fighterHudMarkup(health: number): string {
  return ["You", "Dummy"].map((label, player) => `<div class="hud-player"><span id="health-label-p${player + 1}">${label}</span><div class="health-track" id="health-track-p${player + 1}" role="progressbar" aria-labelledby="health-label-p${player + 1}" aria-valuemin="0" aria-valuemax="${health}" aria-valuenow="${health}"><i class="health-chip" id="health-chip-p${player + 1}"></i><i class="health-fill" id="health-p${player + 1}"></i></div></div>`).join("");
}

function moveListMarkup(character: CharacterDef): string {
  const rows = character.commands.map((command, index) => { const move = character.moves.find((candidate) => candidate.id === command.moveId); if (!move) return ""; const hitbox = move.hitboxes[0]; return `<tr data-move-id="${move.id}"><th scope="row"><strong>${KIT_INPUTS[index] ?? "—"}</strong><span>${titleCase(move.key)}</span></th><td>${hitbox ? hitLevelLabel(hitbox.level) : "—"}</td><td>${hitbox?.damage ?? 0}</td><td>${move.startup}</td><td>${move.active}</td><td>${move.recovery}</td></tr>`; }).join("");
  return `<div class="move-list-wrap"><table class="move-list"><thead><tr><th>Move</th><th>Level</th><th>Damage</th><th>Startup</th><th>Active</th><th>Recovery</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function hitLevelLabel(level: number): string { if (level === HitLevel.Overhead) return "Overhead"; if (level === HitLevel.Low) return "Low"; return "Mid"; }
function titleCase(value: string): string { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

function settingsMarkup(preferences: LabPreferences): string {
  const x = preferences.accessibility;
  return `<div class="settings-content settings-fields">${rangeMarkup("Volume", "audio", "master", preferences.audio.master, 0, 1, .05)}${selectMarkup("Reduced motion", "accessibility", "motion", x.motion, [["full", "Off"], ["reduced", "On"]])}${selectMarkup("High contrast", "accessibility", "contrast", x.contrast, [["normal", "Off"], ["high", "On"]])}${rangeMarkup("Text size", "accessibility", "textScale", x.textScale, .9, 1.6, .1)}${rangeMarkup("Vibration", "controls", "vibration", preferences.controls.vibration, 0, 1, .05)}</div>`;
}
function controlsMarkup(): string { return `<dl class="controls-list"><div><dt>Move</dt><dd>WASD / left stick</dd></div><div><dt>Jab</dt><dd>↑ / Y</dd></div><div><dt>Sweep</dt><dd>← / X</dd></div><div><dt>Overhead</dt><dd>→ / B</dd></div><div><dt>Uppercut</dt><dd>↓ / A</dd></div><div><dt>Play / pause</dt><dd>Space or P / Start</dd></div><div><dt>Skeleton</dt><dd>Training bar</dd></div><div><dt>Hitboxes</dt><dd>\` or Training bar</dd></div><div><dt>Slow-mo</dt><dd>Training bar · 25%</dd></div><div><dt>Pause menu</dt><dd>Esc / View</dd></div><div><dt>Navigate Training controls</dt><dd>Pause, then D-pad + A</dd></div></dl>`; }
function rangeMarkup(label: string, section: string, key: string, value: number, min: number, max: number, step: number): string { const percent = Math.round(value * 100); return `<label class="setting-row setting-range" data-gamepad-nav tabindex="0"><strong>${label}</strong><span class="range-control"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" ${pref(section, key)} data-pref-number aria-label="${label}" aria-valuetext="${percent}%"><output data-pref-output="${section}.${key}">${percent}%</output></span></label>`; }
function selectMarkup(label: string, section: string, key: string, value: string, options: readonly (readonly [string, string])[]): string { return `<label class="setting-row" data-gamepad-nav tabindex="0"><strong>${label}</strong><select ${pref(section, key)} aria-label="${label}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`).join("")}</select></label>`; }
function pref(section: string, key: string): string { return `data-pref-section="${section}" data-pref-key="${key}"`; }
function option(value: string | number, label: string): string { return `<option value="${value}">${label}</option>`; }
