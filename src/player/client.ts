import { createDefaultPlayerSave, normalizePlayerSave, PLAYER_SAVE_CACHE_KEY } from "./save";
import type { PlayerSave } from "./save";

const LEGACY_BUILD_KEY = "hexframe.builds.v4";

export async function loadPlayerSave(): Promise<PlayerSave> {
  const cached = loadCachedPlayerSave();
  try {
    const response = await fetch("/api/save", { headers: { accept: "application/json" } });
    if (!response.ok) return cached;
    const remote = normalizePlayerSave(await response.json());
    cachePlayerSave(remote);
    return remote;
  } catch {
    return cached;
  }
}

export function loadCachedPlayerSave(): PlayerSave {
  try {
    const current = localStorage.getItem(PLAYER_SAVE_CACHE_KEY);
    if (current) return normalizePlayerSave(JSON.parse(current) as unknown);
  } catch {
    // Fall through to the legacy build migration/default save.
  }
  return migrateLegacyBuilds();
}

export function cachePlayerSave(save: PlayerSave): void {
  try {
    localStorage.setItem(PLAYER_SAVE_CACHE_KEY, JSON.stringify(save));
  } catch {
    // The active in-memory save remains usable when device cache is unavailable.
  }
}

function migrateLegacyBuilds(): PlayerSave {
  const next = createDefaultPlayerSave();
  try {
    const builds = JSON.parse(localStorage.getItem(LEGACY_BUILD_KEY) ?? "null") as Record<string, unknown> | null;
    if (builds && Array.isArray(builds.presets)) {
      for (let index = 0; index < 3; index++) {
        const preset = builds.presets[index];
        const id = next.loadouts.order[index];
        if (id && preset && typeof preset === "object") next.loadouts.byId[id] = preset as PlayerSave["loadouts"]["byId"][string];
      }
      if (Number.isInteger(builds.activePreset)) next.loadouts.activeId = next.loadouts.order[Number(builds.activePreset)] ?? next.loadouts.activeId;
      if (builds.inventory && typeof builds.inventory === "object") next.inventory = builds.inventory as PlayerSave["inventory"];
    }
    const migrated = normalizePlayerSave(next);
    cachePlayerSave(migrated);
    return migrated;
  } catch {
    return next;
  }
}
