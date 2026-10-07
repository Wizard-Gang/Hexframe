export interface LabPreferences {
  audio: { master: number };
  accessibility: { contrast: "normal" | "high"; motion: "full" | "reduced"; textScale: number };
  controls: { vibration: number };
}

export const DEFAULT_PREFERENCES: LabPreferences = {
  audio: { master: 0.8 },
  accessibility: { contrast: "normal", motion: "full", textScale: 1 },
  controls: { vibration: 0.7 },
};

const STORAGE_KEY = "hexframe.preferences.v1";

export function loadPreferences(): LabPreferences {
  let saved: unknown;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { /* Storage is optional. */ }
  const root = record(saved);
  const audio = record(root.audio);
  const accessibility = record(root.accessibility);
  const controls = record(root.controls);
  const systemReduced = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  return {
    audio: { master: number(audio.master, 0, 1, DEFAULT_PREFERENCES.audio.master) },
    accessibility: {
      contrast: accessibility.contrast === "high" ? "high" : "normal",
      motion: accessibility.motion === "reduced" || (accessibility.motion !== "full" && systemReduced) ? "reduced" : "full",
      textScale: number(accessibility.textScale, 0.9, 1.6, 1),
    },
    controls: { vibration: number(controls.vibration, 0, 1, DEFAULT_PREFERENCES.controls.vibration) },
  };
}

export function persistPreferences(preferences: LabPreferences): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {
    // Device storage is an enhancement; inaccessible storage must never block play.
  }
}

export function applyPreferences(preferences: LabPreferences): void {
  const root = document.documentElement;
  root.dataset.contrast = preferences.accessibility.contrast;
  root.dataset.motion = preferences.accessibility.motion;
  root.style.setProperty("--font-scale", String(preferences.accessibility.textScale));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
