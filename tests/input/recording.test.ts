import { describe, expect, it } from "vitest";
import { InputBit } from "../../src/combat/types";
import { InputPlayback, InputRecorder } from "../../src/input/recording/recorder";

describe("input recording", () => {
  it("round-trips movement and action bits through deterministic capture and replay", () => {
    const recorder = new InputRecorder();
    recorder.start(12);
    recorder.record(12, [InputBit.Action1, 0]);
    recorder.record(13, [InputBit.Right | InputBit.Action2, 0]);
    const playback = new InputPlayback(recorder.stop(), false);
    expect(playback.at(12, 0)).toBe(InputBit.Action1);
    expect(playback.at(13, 0)).toBe(InputBit.Right | InputBit.Action2);
  });
});
