/**
 * The schema-validated Test Fighter and its fixed four-button Training kit.
 *
 * standing_light and crouching_light remain loaded as engine fixtures, but no command
 * maps to them. The playable commands are the four authored kit attacks below.
 */
import characterJson from "../../characters/test_fighter/character.json";
import standingLightJson from "../../characters/test_fighter/moves/standing_light.json";
import crouchingLightJson from "../../characters/test_fighter/moves/crouching_light.json";

import type { CharacterDef, CommandDef, SimConfig } from "../combat/types";
import { actionBit } from "../combat/types";
import { px } from "../combat/constants";
import { loadCharacter } from "./loader";
import { validateCharacter, validateMove } from "./validate";
import { ADDITIONAL_MOVES } from "./additional-moves";

const BASE_TEST_FIGHTER: CharacterDef = loadCharacter(validateCharacter(characterJson), [
  validateMove(standingLightJson),
  validateMove(crouchingLightJson),
  ...ADDITIONAL_MOVES,
]);

export const MoveId = {
  StandingLight: 1,
  CrouchingLight: 2,
  EmberPalm: 3,
  FrostHeel: 5,
  AshenSweep: 11,
  PhoenixDrive: 18,
} as const;

export const KIT_MOVE_IDS = [
  MoveId.EmberPalm,
  MoveId.AshenSweep,
  MoveId.FrostHeel,
  MoveId.PhoenixDrive,
] as const;

function fixedCommands(character: CharacterDef): CommandDef[] {
  return KIT_MOVE_IDS.map((moveId, slot) => {
    const move = character.moves.find((candidate) => candidate.id === moveId);
    if (!move) throw new Error(`Fixed kit move ${moveId} is missing`);
    return {
      moveId,
      buttons: actionBit(slot),
      motion: [],
      motionWindow: 0,
      requiresCrouch: false,
      requiresAir: false,
      priority: KIT_MOVE_IDS.length - slot,
    };
  });
}

/** A fresh definition for a Training participant without any runtime kit selection. */
export function createTestFighter(): CharacterDef {
  const character: CharacterDef = {
    ...BASE_TEST_FIGHTER,
    moves: BASE_TEST_FIGHTER.moves,
    commands: [],
  };
  character.commands = fixedCommands(character);
  return character;
}

export const TEST_FIGHTER: CharacterDef = createTestFighter();

export function testFighterSimConfig(seed = 0x5eed): SimConfig {
  return {
    characters: [TEST_FIGHTER, TEST_FIGHTER],
    startX: [px(-120), px(120)],
    seed,
  };
}
