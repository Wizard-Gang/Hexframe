import { moveOf } from "../../combat/commands/resolve";
import type { CharacterDef, FrameReport, SimState, StageDef } from "../../combat/types";
import { ContactKind, StateId } from "../../combat/types";
import { debugBoxes } from "../../combat/collision/boxes";
import type { Clip } from "../../rig/clip-types";
import { sampleClip } from "../../rig/sample";
import type { Rig } from "../../rig/types";
import { FigureView } from "../character/figure-view";
import { depthProfileForClip, fightLabPresentation } from "../character/fightlab-presentation";
import { drawHitboxes } from "./debug-overlay";
import {
  drawMotionTrails,
  placeTrailPoint,
  sampleMotionTrail,
  strikingBoneForMove,
  strikingTip,
} from "./motion-trail";
import type { TrailPoint } from "./motion-trail";
import { createStage, worldToScreen } from "./stage";
import { ContactEffectQueue, drawContactEffects, effectKind } from "./contact-effects";

export interface FighterRendererAssets {
  readonly rig: Rig;
  readonly parts: Readonly<Record<string, string>>;
  readonly clips: Readonly<Record<string, Clip>>;
  readonly presentationScale: number;
}

export interface RendererAssets {
  fighters: readonly FighterRendererAssets[];
  stage?: StageDef;
}

export class Renderer {
  private readonly chars: readonly CharacterDef[];
  private readonly assets: readonly FighterRendererAssets[];
  private readonly stage;
  private readonly nodes: FigureView[] = [];
  private readonly trails: TrailPoint[][] = [];
  private readonly effects = new ContactEffectQueue();

  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets) {
    this.chars = chars;
    this.assets = assets.fighters;
    this.stage = createStage(mount, assets.stage);

    for (let player = 0; player < chars.length; player++) {
      const asset = this.assets[player];
      if (!asset) throw new Error(`Renderer assets are missing player ${player}`);
      const node = new FigureView({ rig: asset.rig, parts: asset.parts });
      node.root.classList.add(`fighter-p${player + 1}`);
      this.stage.layers.fighters.appendChild(node.root);
      this.nodes.push(node);
      this.trails.push([]);
    }
  }

  enqueueReports(reports: readonly FrameReport[]): void {
    for (const report of reports) {
      for (const contact of report.contacts) {
        const move = this.chars[contact.attacker]?.moves.find((candidate) => candidate.id === contact.moveId);
        const large = contact.kind === ContactKind.Hit && (move?.key === "overhead" || move?.key === "uppercut");
        this.effects.spawn({
          kind: effectKind(contact.kind),
          x: contact.x,
          y: contact.y,
          large,
        }, report.frame + 1);
      }
    }
  }

  clearEffects(): void {
    this.effects.clear();
    for (const trail of this.trails) trail.length = 0;
    this.stage.layers.trails.replaceChildren();
    this.stage.layers.effects.replaceChildren();
  }

  render(state: SimState, showHitboxes: boolean, reducedMotion = false, showSkeleton = false): void {
    const leadX = state.fighters[0]?.x ?? 0;
    const framed = state.fighters.filter((fighter) => fighter.health > 0 && Math.abs(fighter.x - leadX) <= 90_000);
    const focusX = framed.length > 0
      ? Math.trunc((Math.min(...framed.map((fighter) => fighter.x)) + Math.max(...framed.map((fighter) => fighter.x))) / 2)
      : leadX;
    this.stage.setCamera(focusX);

    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      const node = this.nodes[player];
      const asset = this.assets[player];
      if (!fighter || !node || !asset) continue;

      const presentation = fightLabPresentation(fighter, this.chars[player]);
      const clip = asset.clips[presentation.clip];
      if (!clip) throw new Error(`FightLab clip '${presentation.clip}' is missing`);
      const facing = fighter.facing === -1 ? -1 : 1;
      const placed = node.pose(
        sampleClip(clip, presentation.frame),
        facing,
        depthProfileForClip(asset.rig, presentation.clip),
      );
      const position = worldToScreen(fighter.x, fighter.y);
      node.place(position.x, position.y, facing, asset.presentationScale);

      let trailPoint = null;
      if (!reducedMotion && fighter.state === StateId.Attack) {
        const move = moveOf(this.chars[player], fighter.moveId);
        const active = move !== null
          && fighter.moveFrame >= move.startup
          && fighter.moveFrame < move.startup + move.active;
        const bone = active ? strikingBoneForMove(move?.key) : null;
        const localTip = bone ? strikingTip(placed, asset.rig, bone) : null;
        trailPoint = localTip
          ? placeTrailPoint(localTip, position, facing, asset.presentationScale)
          : null;
      }
      this.trails[player] = reducedMotion
        ? []
        : sampleMotionTrail(this.trails[player] ?? [], state.frame, trailPoint);

      node.drawSkeleton(showSkeleton ? placed : null);
      node.root.classList.toggle("fighter-hitstop", fighter.hitstop > 0);
    }

    drawMotionTrails(this.stage.layers.trails, this.trails, state.frame, reducedMotion);
    drawContactEffects(this.stage.layers.effects, this.effects.active(state.frame), state.frame, reducedMotion);
    drawHitboxes(this.stage.layers.debug, debugBoxes(state, this.chars), showHitboxes);
  }

  dispose(): void {
    this.effects.clear();
    this.stage.svg.remove();
    this.nodes.length = 0;
  }
}
