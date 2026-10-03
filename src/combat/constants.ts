/**
 * Engine-wide invariants. Anything a designer would tune (walk speed, gravity, jump
 * height, frame data) belongs in character or move data, never here.
 *
 * ## The integer rule
 *
 * Every quantity the simulation stores or arithmetics on is a 32-bit integer. There are
 * no floats anywhere below `src/combat` or `src/input`, because two machines that
 * disagree in the last bit of a double can disagree about whether an attack hit. Fixed
 * integer arithmetic keeps the same inputs producing the same state.
 *
 * Positions are stored in *sim units*. One world pixel is `SCALE` sim units, so the
 * simulation carries 1/100th-pixel precision while still being exact integer maths.
 * Content is authored in whole world pixels and multiplied up by the loader.
 */

/** Simulation frames per second. Fixed, and never derived from a browser `deltaTime`. */
export const FPS = 60;

/** Sim units per world pixel. All stored positions, velocities and boxes use sim units. */
export const SCALE = 100;

/** Convert whole world pixels (as authored in JSON) to sim units. Exact for integers. */
export function px(worldPixels: number): number {
  return Math.trunc(worldPixels * SCALE);
}

/** Convert sim units back to world pixels, truncated toward zero. Rendering only. */
export function toPixels(simUnits: number): number {
  return Math.trunc(simUnits / SCALE);
}

/** Ground plane. A fighter with `y === GROUND_Y` and no upward velocity is grounded. */
export const GROUND_Y = 0;

/** Half the playable stage width in sim units; the camera is fixed and shows all of it. */
export const STAGE_HALF_WIDTH = px(460);

/** Fighter count is fixed: one player and one Training dummy. */
export const PLAYER_COUNT = 2;

/** Sentinel in `FighterState.moveId` meaning "not performing a move". */
export const NO_MOVE = -1;

/**
 * How many frames a button press stays eligible to start a move after it was pressed.
 * This is the classic input buffer: a light pressed two frames before recovery ends
 * still comes out on the first actionable frame.
 */
export const INPUT_BUFFER_FRAMES = 4;

/** How many past input frames the command parser can see when matching motions. */
export const COMMAND_HISTORY_FRAMES = 32;
