import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import characterSchema from "../../schemas/character.schema.json";
import moveSchema from "../../schemas/move.schema.json";
import character from "../../characters/test_fighter/character.json";
import standingLight from "../../characters/test_fighter/moves/standing_light.json";
import crouchingLight from "../../characters/test_fighter/moves/crouching_light.json";
import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { validateCharacter, validateMove } from "../../src/content/validate";

describe("authored content", () => {
  const ajv = new Ajv({ allErrors: true, strict: true });

  it("matches the checked-in JSON schemas", () => {
    expect(ajv.compile(characterSchema)(character)).toBe(true);
    const moveValidator = ajv.compile(moveSchema);
    expect(moveValidator(standingLight), JSON.stringify(moveValidator.errors)).toBe(true);
    expect(moveValidator(crouchingLight), JSON.stringify(moveValidator.errors)).toBe(true);
  });

  it("also passes the browser-side validators", () => {
    expect(validateCharacter(character).id).toBe("test_fighter");
    expect(validateMove(standingLight).key).toBe("standing_light");
  });

  it("loads authored pixels into exact integer sim units", () => {
    expect(TEST_FIGHTER.walkBackwardSpeed).toBe(150);
    expect(TEST_FIGHTER.gravity).toBe(60);
    expect(TEST_FIGHTER.moves[0].hitboxes[0].pushbackHitAttacker).toBe(-120);
  });
});
