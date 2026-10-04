import type { CharacterDef, FrameReport, SimState, StageDef } from "../../combat/types";
import { ContactKind } from "../../combat/types";
import { debugBoxes } from "../../combat/collision/boxes";
import type { RawAnimation, RawRig } from "../../content/raw-types";
import type { AnimationPlayback } from "../animation/animator";
import { animationForState, animationFrameForState, sampleAnimation } from "../animation/animator";
import { applyPose, buildFighterNode } from "../character/rig";
import type { FighterNode } from "../character/rig";
import { drawHitboxes } from "./debug-overlay";
import { createStage, fmt, worldToScreen } from "./stage";
import { ContactEffectQueue, drawContactEffects, effectKind } from "./contact-effects";

export interface FighterRendererAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
  playback?: Readonly<Record<string, AnimationPlayback>>;
  presentationScale?: number;
}

export interface RendererAssets {
  fighters: readonly FighterRendererAssets[];
  stage?: StageDef;
}

export class Renderer {
  private readonly chars: readonly CharacterDef[];
  private readonly assets: readonly FighterRendererAssets[];
  private readonly stage;
  private readonly nodes: FighterNode[] = [];
  private readonly effects = new ContactEffectQueue();

  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets) {
    this.chars = chars;
    this.assets = assets.fighters;
    this.stage = createStage(mount, assets.stage);

    for (let player = 0; player < chars.length; player++) {
      const asset = this.assets[player];
      if (!asset) throw new Error(`Renderer assets are missing player ${player}`);
      const node = buildFighterNode(asset.model, asset.rig);
      node.root.classList.add(`fighter-p${player + 1}`);
      this.stage.layers.fighters.appendChild(node.root);
      this.nodes.push(node);
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
    this.stage.layers.effects.replaceChildren();
  }

  render(state: SimState, showHitboxes: boolean, reducedMotion = false): void {
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
      const clipName = animationForState(fighter, this.chars[player]);
      const clip = asset.animations[clipName] ?? asset.animations["idle"];
      if (clip) {
        const frame = animationFrameForState(
          fighter,
          this.chars[player],
          clipName,
          clip,
          asset.playback?.[clipName],
        );
        applyPose(node, sampleAnimation(clip, frame));
      }
      const position = worldToScreen(fighter.x, fighter.y);
      const scale = asset.presentationScale ?? 1;
      node.root.setAttribute(
        "transform",
        `translate(${fmt(position.x)} ${fmt(position.y)}) scale(${fmt(fighter.facing * scale)} ${fmt(scale)})`,
      );
      node.root.classList.toggle("fighter-hitstop", fighter.hitstop > 0);
    }

    drawContactEffects(this.stage.layers.effects, this.effects.active(state.frame), state.frame, reducedMotion);
    drawHitboxes(this.stage.layers.debug, debugBoxes(state, this.chars), showHitboxes);
  }

  dispose(): void {
    this.effects.clear();
    this.stage.svg.remove();
    this.nodes.length = 0;
  }
}
