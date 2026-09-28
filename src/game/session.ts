import { px } from "../combat/constants";
import type { StageDef } from "../combat/types";

export type StageId = "training-grid";

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
  cameraBounds: { minX: px(-480), maxX: px(480) },
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
