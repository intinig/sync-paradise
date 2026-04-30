export class OffsetEstimator {
  private samples: number[] = [];
  constructor(private readonly capacity = 5) {}

  addSample(t0: number, t1: number, t2: number): void {
    const rtt = t2 - t0;
    const offset = t1 - (t0 + rtt / 2);
    this.samples.push(offset);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  offsetMs(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
