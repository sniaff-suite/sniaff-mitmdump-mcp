import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export class Logger {
  private logFile: string | null = null;
  private logStream: fs.WriteStream | null = null;

  constructor(private name: string = 'sniaff-mitmdump') {}

  async initialize(logsDir: string): Promise<void> {
    await fs.promises.mkdir(logsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `${this.name}-${timestamp}.log`);
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  private write(entry: LogEntry): void {
    const line = JSON.stringify(entry);

    if (this.logStream) {
      this.logStream.write(line + '\n');
    }

    console.error(line);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write(this.formatEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write(this.formatEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write(this.formatEntry('warn', message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write(this.formatEntry('error', message, context));
  }

  async close(): Promise<void> {
    if (this.logStream) {
      await new Promise<void>((resolve) => {
        this.logStream!.end(resolve);
      });
      this.logStream = null;
    }
  }
}
