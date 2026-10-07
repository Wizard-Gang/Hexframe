import type { Clip, Pose } from "../rig/clip-types";
import { sampleClip } from "../rig/sample";

const SEQUENCE = [
  { clip: "labIdle", label: "Idle", duration: 120 },
  { clip: "labStrike", label: "Jab" },
  { clip: "sweep", label: "Sweep" },
  { clip: "labOverhead", label: "Overhead" },
  { clip: "uppercut", label: "Uppercut" },
] as const;
const BLEND_FRAMES = 12;
type ShowreelClip = typeof SEQUENCE[number]["clip"];
type Clips = Readonly<Record<ShowreelClip, Clip>>;

/** Smooth presentation transitions; neither time nor poses enter combat state. */
export function sampleShowreel(clips: Clips, frame: number): { clip: ShowreelClip; label: string; pose: Pose } {
  const durations = SEQUENCE.map((entry) => "duration" in entry ? entry.duration : clips[entry.clip].duration);
  const total = durations.reduce((sum, duration) => sum + duration + BLEND_FRAMES, 0);
  let at = ((frame % total) + total) % total;
  for (const [index, entry] of SEQUENCE.entries()) {
    const duration = durations[index]!;
    if (at < duration) return { ...entry, pose: sampleClip(clips[entry.clip], at) };
    if (at < duration + BLEND_FRAMES) {
      const next = SEQUENCE[(index + 1) % SEQUENCE.length]!;
      const from = sampleClip(clips[entry.clip], duration);
      const to = sampleClip(clips[next.clip], 0);
      const progress = (at - duration) / BLEND_FRAMES;
      const weight = progress * progress * (3 - 2 * progress);
      const pose: Pose = {};
      for (const bone of new Set([...Object.keys(from), ...Object.keys(to)])) {
        pose[bone] = {};
        for (const property of ["x", "y", "rotation"] as const) {
          const start = from[bone]?.[property] ?? 0;
          pose[bone]![property] = start + ((to[bone]?.[property] ?? 0) - start) * weight;
        }
      }
      return { ...next, pose };
    }
    at -= duration + BLEND_FRAMES;
  }
  return { ...SEQUENCE[0], pose: sampleClip(clips.labIdle, 0) };
}
