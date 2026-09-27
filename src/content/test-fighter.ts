/**
 * The built Test Fighter, and the match it starts in.
 *
 * The JSON goes through the validator before the loader on the way in, every time. It
 * costs microseconds once at module load and it means a malformed character is a clear
 * error at a known place rather than an `undefined` that surfaces four frames into a
 * hitbox comparison.
 *
 * Deliberately free of any browser-only import: the whole test suite builds this fighter
 * under Node. The model SVG, the rig and the animations live in `test-fighter-assets.ts`
 * next door, so that importing a fighter never drags a `?raw` asset into a test run.
 */

import characterJson from "../../characters/test_fighter/character.json";
import standingLightJson from "../../characters/test_fighter/moves/standing_light.json";
import crouchingLightJson from "../../characters/test_fighter/moves/crouching_light.json";

import type { CharacterDef, CommandDef, SimConfig } from "../combat/types";
import { ACTION_SLOT_COUNT, actionBit } from "../combat/types";
import { px } from "../combat/constants";
import { loadCharacter } from "./loader";
import { validateCharacter, validateMove } from "./validate";
import { ADDITIONAL_MOVES } from "./additional-moves";

const BASE_TEST_FIGHTER: CharacterDef = loadCharacter(validateCharacter(characterJson), [
  validateMove(standingLightJson),
  validateMove(crouchingLightJson),
  ...ADDITIONAL_MOVES,
]);

/** Move ids by name, so callers never spell a bare number. */
export const MoveId = {
  StandingLight: 1,
  CrouchingLight: 2,
  EmberPalm: 3,
  VenomFang: 4,
  FrostHeel: 5,
  StormKnuckle: 6,
  CrimsonArc: 7,
  RiftUppercut: 8,
  BastionBreak: 9,
  ShadowStep: 10,
  AshenSweep: 11,
  GlacierSpike: 12,
  StaticRush: 13,
  ToxicBloom: 14,
  BloodMoon: 15,
  VoidHook: 16,
  IronReversal: 17,
  PhoenixDrive: 18,
  Permafrost: 19,
  PlagueTouch: 20,
  ThunderClap: 21,
  ReaperKick: 22,
  EclipseBreaker: 23,
  PrismBurst: 24,
  AstralJab: 25,
  WitchKnee: 26,
  MeteorHeel: 27,
  VoidDive: 28,
  GraveToll: 29,
} as const;

/**
 * The beginner build reads vertically: direction chooses a family and modifiers advance
 * its route. The final bank stays utility-heavy until every family has a fourth stage.
 */
export const DEFAULT_MOVE_LOADOUT: number[] = [
  MoveId.EmberPalm, MoveId.VenomFang, MoveId.FrostHeel, MoveId.StormKnuckle,
  MoveId.AshenSweep, MoveId.ToxicBloom, MoveId.GlacierSpike, MoveId.StaticRush,
  MoveId.PhoenixDrive, MoveId.PlagueTouch, MoveId.Permafrost, MoveId.ThunderClap,
  MoveId.RiftUppercut, MoveId.ShadowStep, MoveId.IronReversal, MoveId.BastionBreak,
];

export function commandsForLoadout(
  character: CharacterDef,
  loadout: readonly number[],
): CommandDef[] {
  const commands: CommandDef[] = [];
  for (let slot = 0; slot < ACTION_SLOT_COUNT; slot++) {
    const moveId = loadout[slot];
    const move = character.moves.find((candidate) => candidate.id === moveId);
    if (!move) continue;
    commands.push({
      moveId,
      buttons: actionBit(slot),
      motion: [],
      motionWindow: 0,
      requiresCrouch: move.requiresCrouch,
      requiresAir: move.airOk,
      priority: ACTION_SLOT_COUNT - slot,
    });
  }
  return commands;
}

/** A fresh definition so a lab loadout can change without mutating global content. */
export function testFighterWithLoadout(loadout: readonly number[]): CharacterDef {
  const character: CharacterDef = {
    ...BASE_TEST_FIGHTER,
    moves: BASE_TEST_FIGHTER.moves,
    commands: [],
  };
  character.commands = commandsForLoadout(character, loadout);
  return character;
}

export const TEST_FIGHTER: CharacterDef = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);

/**
 * A match of Test Fighter against itself.
 *
 * 240 px apart: comfortably outside standing light's 88 px reach, so nothing can connect
 * until somebody walks in and the first frame of a test is never already a hit. Both
 * players share one `CharacterDef` object because character data is read-only — the
 * simulation writes only to `SimState`.
 */
export function testFighterSimConfig(seed = 0x5eed): SimConfig {
  return {
    characters: [TEST_FIGHTER, TEST_FIGHTER],
    startX: [px(-120), px(120)],
    seed,
  };
}
