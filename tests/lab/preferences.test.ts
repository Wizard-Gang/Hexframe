import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, loadPreferences, persistPreferences } from "../../src/lab/preferences";

afterEach(() => vi.unstubAllGlobals());

function stored(value: unknown): void {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
}

describe("device preferences", () => {
  it("retains valid settings and ignores retired fields", () => {
    stored({ audio: { master: .3, ui: 0, sfx: 0, captions: true }, video: { hudOpacity: 0 }, accessibility: { theme: "light", strongFocus: false, motion: "reduced", contrast: "high", textScale: 1.4 }, controls: { vibration: .2, stickDeadzone: .9 } });
    expect(loadPreferences()).toEqual({ audio: { master: .3 }, accessibility: { motion: "reduced", contrast: "high", textScale: 1.4 }, controls: { vibration: .2 } });
  });

  it("defaults malformed values and bounds numeric settings", () => {
    for (const value of [null, [], "old", { audio: null, accessibility: [], controls: false }]) {
      stored(value);
      expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    }
    stored({ audio: { master: "0" }, accessibility: { textScale: 99, contrast: "invalid", motion: "invalid" }, controls: { vibration: -2 } });
    expect(loadPreferences()).toEqual({ audio: { master: .8 }, accessibility: { textScale: 1.6, contrast: "normal", motion: "full" }, controls: { vibration: 0 } });
  });

  it("keeps play available when storage is corrupt or inaccessible", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{", setItem: () => { throw new Error("unavailable"); } });
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(() => persistPreferences(DEFAULT_PREFERENCES)).not.toThrow();
  });

  it("initializes reduced motion from the device preference", () => {
    stored({ accessibility: { motion: "system" } });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(loadPreferences().accessibility.motion).toBe("reduced");
  });
});
