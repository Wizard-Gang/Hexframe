import type { LabPreferences } from "../../lab/preferences";

export type AudioCue = "navigate" | "confirm" | "hit" | "block" | "burn" | "freeze";

export const AUDIO_CAPTIONS: Record<AudioCue, string> = {
  navigate: "Menu focus moves",
  confirm: "Selection confirmed",
  hit: "Heavy impact",
  block: "Attack blocked",
  burn: "Burn applied",
  freeze: "Freeze builds",
};

const NOTES = [110, 146.83, 164.81, 220, 246.94, 293.66];

class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ui: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private preferences: LabPreferences["audio"] | null = null;
  private caption: ((text: string) => void) | null = null;

  setCaptionHandler(handler: ((text: string) => void) | null): void {
    this.caption = handler;
  }

  ensure(): void {
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.sfx = this.context.createGain();
      this.ui = this.context.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.ui.connect(this.master);
      this.master.connect(this.context.destination);
      this.applyVolumes();
    }
    if (this.context.state === "suspended") void this.context.resume();
    if (this.preferences?.music && this.preferences.master > 0) this.startMusic();
  }

  update(preferences: LabPreferences["audio"]): void {
    this.preferences = preferences;
    this.applyVolumes();
    if (preferences.music > 0 && preferences.master > 0) this.startMusic();
    else this.stopMusic();
  }

  play(cue: AudioCue): void {
    if (this.preferences?.captions && cue !== "navigate" && cue !== "confirm") this.caption?.(AUDIO_CAPTIONS[cue]);
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
    gain.gain.exponentialRampToValueAtTime(this.peak(), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  handleVisibility(hidden: boolean): void {
    if (!this.context || !this.preferences?.muteUnfocused) return;
    if (hidden) void this.context.suspend();
    else void this.context.resume();
  }

  dispose(): void {
    this.stopMusic();
    void this.context?.close();
    this.context = null;
    this.master = this.music = this.sfx = this.ui = null;
  }

  private applyVolumes(): void {
    if (!this.context || !this.preferences || !this.master || !this.music || !this.sfx || !this.ui) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.preferences.master, now, 0.02);
    this.music.gain.setTargetAtTime(this.preferences.music * this.preferences.ambience * 0.45, now, 0.05);
    this.sfx.gain.setTargetAtTime(this.preferences.sfx, now, 0.02);
    this.ui.gain.setTargetAtTime(this.preferences.ui * 0.55, now, 0.02);
  }

  private startMusic(): void {
    if (!this.context || !this.music || this.musicTimer) return;
    this.musicTimer = setInterval(() => this.playMusicNote(), 420);
  }

  private stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private playMusicNote(): void {
    if (!this.context || !this.music) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = NOTES[this.musicStep % NOTES.length];
    this.musicStep++;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    oscillator.connect(gain).connect(this.music);
    oscillator.start(now);
    oscillator.stop(now + 0.4);
  }

  private peak(): number {
    if (this.preferences?.dynamicRange === "night") return 0.12;
    if (this.preferences?.dynamicRange === "wide") return 0.3;
    return 0.2;
  }
}

function cueShape(cue: AudioCue): [number, number, number] {
  if (cue === "navigate") return [330, 390, 0.055];
  if (cue === "confirm") return [440, 660, 0.1];
  if (cue === "hit") return [170, 75, 0.16];
  if (cue === "block") return [145, 55, 0.15];
  if (cue === "burn") return [260, 620, 0.18];
  return [740, 920, 0.16];
}

export const gameAudio = new AudioManager();
