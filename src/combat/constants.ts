/**
 * Engine-wide invariants. Anything a designer would tune (walk speed, gravity, jump
 * height, frame data) belongs in character or move data, never here.
 *
 * ## The integer rule
 *
 * Every quantity the simulation stores or arithmetics on is a 32-bit integer. There are
 * no floats anywhere below `src/combat`, `src/input` or `src/rollback`, because two
 * machines that disagree in the last bit of a double will disagree about whether an
 * attack hit, and a rollback that re-runs the same frames must land on the same bits.
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

/** Frames after a stamina spend before one point per frame starts regenerating. */
export const STAMINA_REGEN_DELAY = 36;

/** How many past input frames the command parser can see when matching motions. */
export const COMMAND_HISTORY_FRAMES = 32;

/** Snapshot format tag. Bump when the serialised layout changes; readers reject others. */
export const SNAPSHOT_VERSION = 11;

/** FNV-1a 32-bit parameters, used for every determinism hash in the project. */
export const FNV_OFFSET_BASIS = 0x811c9dc5;
export const FNV_PRIME = 0x01000193;
