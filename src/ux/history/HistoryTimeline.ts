/**
 * HistoryTimeline.ts — Chronological operation history
 */

export interface HistoryEntry {
  readonly id: string;
  readonly title: string;
  readonly details: string;
  readonly timestamp: number;
}

export class HistoryTimeline {
  private entries: HistoryEntry[] = [];

  public addEntry(title: string, details: string): void {
    this.entries.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title,
      details,
      timestamp: Date.now()
    });
  }

  public getTimeline(): ReadonlyArray<HistoryEntry> {
    return this.entries;
  }

  public search(query: string): HistoryEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(e => 
      e.title.toLowerCase().includes(q) || e.details.toLowerCase().includes(q)
    );
  }
}
