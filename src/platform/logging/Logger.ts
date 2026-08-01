/**
 * Logger.ts — Centralized Structured Logging
 */

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warning = 2,
  Error = 3,
  Fatal = 4
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}

export class Logger {
  private history: LogEntry[] = [];
  private currentLevel: LogLevel = LogLevel.Info;

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.currentLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context
    };

    this.history.push(entry);

    // In a real application, this would write to stdout/stderr or rotating files.
    // For unit tests, we capture it in memory.
  }

  public info(message: string, context?: Record<string, unknown>) { this.log(LogLevel.Info, message, context); }
  public error(message: string, context?: Record<string, unknown>) { this.log(LogLevel.Error, message, context); }
  public fatal(message: string, context?: Record<string, unknown>) { this.log(LogLevel.Fatal, message, context); }

  public getHistory(): ReadonlyArray<LogEntry> {
    return this.history;
  }
}

export const globalLogger = new Logger();
