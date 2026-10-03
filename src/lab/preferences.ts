export type ThemePreference = "system" | "dark" | "light";
export type MotionPreference = "system" | "full" | "reduced";
export type ColorVisionMode = "default" | "deuteranopia" | "protanopia" | "tritanopia" | "monochrome";

export interface LabPreferences {
  audio: {
    master: number;
    sfx: number;
    ui: number;
    captions: boolean;
    muteUnfocused: boolean;
  };
  video: {
    particles: "off" | "reduced" | "full";
    cameraShake: number;
    combatFlashes: "off" | "reduced" | "full";
    damageNumbers: boolean;
    hudOpacity: number;
  };
  accessibility: {
    theme: ThemePreference;
    contrast: "normal" | "high";
    motion: MotionPreference;
    textScale: number;
    colorVision: ColorVisionMode;
    dyslexiaFont: boolean;
    strongFocus: boolean;
    screenReaderCombat: boolean;
  };
  controls: {
    glyphs: "auto" | "keyboard" | "xbox";
    stickDeadzone: number;
    vibration: number;
  };
}

export const DEFAULT_PREFERENCES: LabPreferences = {
  audio: { master: 0.8, sfx: 0.85, ui: 0.7, captions: true, muteUnfocused: true },
  video: { particles: "full", cameraShake: 0.35, combatFlashes: "reduced", damageNumbers: true, hudOpacity: 0.92 },
  accessibility: { theme: "system", contrast: "normal", motion: "system", textScale: 1, colorVision: "default", dyslexiaFont: false, strongFocus: true, screenReaderCombat: false },
  controls: { glyphs: "auto", stickDeadzone: 0.45, vibration: 0.7 },
};

const STORAGE_KEY = "hexframe.preferences.v1";

export function loadPreferences(): LabPreferences {
  let saved: Partial<LabPreferences> = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<LabPreferences>;
  } catch {
    saved = {};
  }
  return {
    audio: { ...DEFAULT_PREFERENCES.audio, ...saved.audio },
    video: { ...DEFAULT_PREFERENCES.video, ...saved.video },
    accessibility: { ...DEFAULT_PREFERENCES.accessibility, ...saved.accessibility },
    controls: { ...DEFAULT_PREFERENCES.controls, ...saved.controls },
  };
}

export function persistPreferences(preferences: LabPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Device storage is an enhancement; inaccessible storage must never block play.
  }
}

export function applyPreferences(preferences: LabPreferences): void {
  const root = document.documentElement;
  const { accessibility, video } = preferences;
  if (accessibility.theme === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = accessibility.theme;
  root.dataset.contrast = accessibility.contrast;
  const systemReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  root.dataset.motion = accessibility.motion === "system"
    ? (systemReduced ? "reduced" : "full")
    : accessibility.motion;
  root.dataset.colorVision = accessibility.colorVision;
  root.dataset.dyslexia = accessibility.dyslexiaFont ? "on" : "off";
  root.dataset.strongFocus = accessibility.strongFocus ? "on" : "off";
  root.dataset.flashes = video.combatFlashes;
  root.dataset.particles = video.particles;
  root.dataset.damageNumbers = video.damageNumbers ? "on" : "off";
  root.dataset.cameraShake = video.cameraShake <= 0 ? "off" : video.cameraShake < 0.5 ? "reduced" : "full";
  root.dataset.glyphs = preferences.controls.glyphs;
  root.style.setProperty("--font-scale", String(clamp(accessibility.textScale, 0.9, 1.6)));
  root.style.setProperty("--hud-opacity", String(clamp(video.hudOpacity, 0.45, 1)));
  root.style.setProperty("--shake-strength", `${Math.round(clamp(video.cameraShake, 0, 1) * 7)}px`);
}

export function resetPreferences(): LabPreferences {
  const next: LabPreferences = {
    audio: { ...DEFAULT_PREFERENCES.audio },
    video: { ...DEFAULT_PREFERENCES.video },
    accessibility: { ...DEFAULT_PREFERENCES.accessibility },
    controls: { ...DEFAULT_PREFERENCES.controls },
  };
  persistPreferences(next);
  applyPreferences(next);
  return next;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
