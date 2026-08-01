/**
 * TraceExporter.ts — JSON, Markdown, HTML exporters
 */

import { TraceEngine } from '../tracing/TraceEngine';

export class TraceExporter {
  constructor(private traceEngine: TraceEngine) {}

  public exportJSON(): string {
    return JSON.stringify(this.traceEngine.getHistory(), null, 2);
  }

  public exportMarkdown(): string {
    const history = this.traceEngine.getHistory();
    let md = '# Execution Trace Export\n\n';
    
    history.forEach(evt => {
      md += `### [${new Date(evt.timestamp).toISOString()}] ${evt.subsystem} :: ${evt.eventName}\n`;
      md += '```json\n';
      md += JSON.stringify(evt.payload, null, 2) + '\n';
      md += '```\n\n';
    });

    return md;
  }
}
