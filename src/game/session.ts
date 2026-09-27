import { px } from "../combat/constants";
import type { StageDef } from "../combat/types";

export type GameMode = "training";
export type StageId = "training-grid";

export interface SessionOptions {
  developerTools: boolean;
  tutorial: boolean;
}

export interface GameSession {
  mode: GameMode;
  options: SessionOptions;
}

export interface StageCatalogEntry {
  id: StageId;
  familyId: string;
  name: string;
  variant: "training";
  stage: StageDef;
}

const TRAINING_GRID: StageDef = {
  id: "training-grid",
  width: px(960),
  spawnX: 0,
  cameraBounds: { minX: px(-480), maxX: px(480) },
  bossArena: { gateX: px(-480), minX: px(-480), maxX: px(480) },
  checkpoints: [],
  interactables: [],
  breakables: [],
  hazards: [],
  backdrop: "training-grid",
};

export const STAGE_CATALOG: Record<StageId, StageCatalogEntry> = {
  "training-grid": {
    id: "training-grid",
    familyId: "training",
    name: "Training Grid",
    variant: "training",
    stage: TRAINING_GRID,
  },
};

export function defaultSession(mode: GameMode = "training"): GameSession {
  return {
    mode,
    options: {
      developerTools: false,
      tutorial: false,
    },
  };
}

export function readGameSession(url: URL): GameSession | null {
  if (url.searchParams.get("mode") !== "training") return null;
  const session = defaultSession();
  session.options.developerTools = url.searchParams.get("debug") === "1";
  session.options.tutorial = url.searchParams.get("tutorial") === "1";
  return session;
}

export function sessionUrl(session: GameSession): string {
  const query = new URLSearchParams({ mode: "training" });
  if (session.options.developerTools) query.set("debug", "1");
  if (session.options.tutorial) query.set("tutorial", "1");
  return `/play/?${query.toString()}`;
}
