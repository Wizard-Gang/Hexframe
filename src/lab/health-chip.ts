/** Presentation-only delayed damage trail, measured in browser milliseconds. */
export class HealthChip {
  private health = 100;
  private trail = 100;
  private from = 100;
  private damagedAt = 0;

  update(health: number, now: number): number {
    if (health > this.health) this.reset(health);
    if (health < this.health) {
      this.from = this.trail;
      this.damagedAt = now;
    }
    this.health = health;
    const progress = Math.max(0, Math.min(1, (now - this.damagedAt - 120) / 380));
    this.trail = this.from + (health - this.from) * progress;
    return this.trail;
  }

  reset(health = 100): void {
    this.health = this.trail = this.from = health;
  }
}
