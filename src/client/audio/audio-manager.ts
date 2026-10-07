import type { LabPreferences } from "../../lab/preferences";

export type AudioCue = "navigate" | "confirm" | "hit" | "block";

class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ui: GainNode | null = null;
  private preferences: LabPreferences["audio"] | null = null;
  ensure(): void {
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.sfx = this.context.createGain();
      this.ui = this.context.createGain();
      this.sfx.connect(this.master);
      this.ui.connect(this.master);
      this.master.connect(this.context.destination);
      this.applyVolumes();
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  update(preferences: LabPreferences["audio"]): void {
    this.preferences = preferences;
    this.applyVolumes();
  }

  play(cue: AudioCue): void {
    if (!this.context) return;
    const output = cue === "navigate" || cue === "confirm" ? this.ui : this.sfx;
    if (!output) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const [start, end, duration] = cueShape(cue);
    oscillator.type = cue === "hit" || cue === "block" ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = this.sfx = this.ui = null;
  }

  private applyVolumes(): void {
    if (!this.context || !this.preferences || !this.master || !this.sfx || !this.ui) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.preferences.master, now, 0.02);
    this.sfx.gain.setTargetAtTime(0.85, now, 0.02);
    this.ui.gain.setTargetAtTime(0.7 * 0.55, now, 0.02);
  }
}

function cueShape(cue: AudioCue): [number, number, number] {
  if (cue === "navigate") return [330, 390, 0.055];
  if (cue === "confirm") return [440, 660, 0.1];
  if (cue === "hit") return [170, 75, 0.16];
  if (cue === "block") return [145, 55, 0.15];
  return [145, 55, 0.15];
}

export const gameAudio = new AudioManager();
