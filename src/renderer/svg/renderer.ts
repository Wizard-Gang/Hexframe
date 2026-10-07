import { moveOf } from "../../combat/commands/resolve";
import type { CharacterDef, FrameReport, SimState } from "../../combat/types";
import { ContactKind, StateId } from "../../combat/types";
import { debugBoxes } from "../../combat/collision/boxes";
import { inBone } from "../../rig/fk";
import type { Clip } from "../../rig/clip-types";
import { sampleClip } from "../../rig/sample";
import type { Rig } from "../../rig/types";
import { FigureView } from "../character/figure-view";
import { depthProfileForClip, fightLabPresentation } from "../character/fightlab-presentation";
import type { FightLabPresentation } from "../character/fightlab-presentation";
import { drawHitboxes } from "./debug-overlay";
import {
  drawMotionTrails,
  placeTrailPoint,
  sampleMotionTrail,
  strikingBoneForMove,
  strikingTip,
} from "./motion-trail";
import type { TrailPoint } from "./motion-trail";
import { createStage, worldToScreen, SVG_NS, fmt } from "./stage";
import { ContactEffectQueue, drawContactEffects, effectKind } from "./contact-effects";
import { StageMotionEffectQueue, applyStageShake, drawLandingDust } from "./stage-effects";

export interface FighterRendererAssets {
  readonly rig: Rig;
  readonly parts: Readonly<Record<string, string>>;
  readonly clips: Readonly<Record<string, Clip>>;
  readonly presentationScale: number;
}

export interface RendererAssets {
  fighters: readonly FighterRendererAssets[];
}

export class Renderer {
  private readonly chars: readonly CharacterDef[];
  private readonly assets: readonly FighterRendererAssets[];
  private readonly stage;
  private readonly nodes: FigureView[] = [];
  private readonly trails: TrailPoint[][] = [];
  private readonly effects = new ContactEffectQueue();
  private readonly stageMotion = new StageMotionEffectQueue();

  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets) {
    this.chars = chars;
    this.assets = assets.fighters;
    this.stage = createStage(mount);

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
        if (large) this.stageMotion.spawnImpact(report.frame + 1);
      }
    }
  }

  clearEffects(): void {
    this.effects.clear();
    this.stageMotion.clear();
    for (const trail of this.trails) trail.length = 0;
    this.stage.layers.groundEffects.replaceChildren();
    this.stage.layers.trails.replaceChildren();
    this.stage.layers.effects.replaceChildren();
    this.stage.world.removeAttribute("transform");
  }

  render(state: SimState, showHitboxes: boolean, reducedMotion = false, showSkeleton = false, playerPresentation?: FightLabPresentation): void {
    this.stage.setCamera(state.fighters);
    this.stage.layers.shadows.replaceChildren();
    if (reducedMotion) this.stageMotion.clearAnimated();

    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      const node = this.nodes[player];
      const asset = this.assets[player];
      if (!fighter || !node || !asset) continue;

      const presentation = player === 0 && playerPresentation
        ? playerPresentation
        : fightLabPresentation(fighter, this.chars[player]);
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
      for (const name of ["shin-front", "shin-back"]) {
        const bone = asset.rig.byName.get(name);
        const at = placed.get(name);
        if (!bone?.tip || !at) continue;
        const foot = inBone(at, bone.tip);
        const altitude = Math.max(0, -(position.y + foot.y * asset.presentationScale));
        const shadow = document.createElementNS(SVG_NS, "ellipse");
        shadow.setAttribute("cx", fmt(position.x + foot.x * facing * asset.presentationScale));
        shadow.setAttribute("cy", "2");
        shadow.setAttribute("rx", fmt(12 + Math.min(altitude, 100) * .06));
        shadow.setAttribute("ry", "3");
        shadow.setAttribute("fill", "#02060b");
        shadow.setAttribute("opacity", fmt(.3 / (1 + altitude / 35)));
        shadow.style.filter = "blur(2px)";
        this.stage.layers.shadows.appendChild(shadow);
      }

      if (fighter.state === StateId.Landing && fighter.stateFrame === 0) {
        this.stageMotion.observeLanding(player, fighter.x, fighter.y, state.frame, !reducedMotion);
      }

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

    drawLandingDust(
      this.stage.layers.groundEffects,
      this.stageMotion.activeDust(state.frame),
      state.frame,
      reducedMotion,
    );
    applyStageShake(this.stage.world, this.stageMotion.shakeOffset(state.frame), reducedMotion);
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
