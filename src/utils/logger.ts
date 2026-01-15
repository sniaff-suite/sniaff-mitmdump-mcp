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
  private sessionLogFiles: Map<string, string> = new Map();

  constructor(private name: string = 'sniaff-mitmdump') {}

  async initialize(_logsDir: string): Promise<void> {
    // No-op: we only log to session-specific files now
  }

  private async ensureLogDir(dir: string): Promise<void> {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch {
      // Best effort
    }
  }

  /**
   * Register a session-specific log file. Logs with matching sessionId will be written there.
   */
  async registerSessionLog(sessionId: string, logsDir: string): Promise<void> {
    await this.ensureLogDir(logsDir);
    const sessionLogFile = path.join(logsDir, 'session.log');
    this.sessionLogFiles.set(sessionId, sessionLogFile);
  }

  /**
   * Unregister a session log file (call when session ends).
   */
  unregisterSessionLog(sessionId: string): void {
    this.sessionLogFiles.delete(sessionId);
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

    // Always write to stderr for MCP compliance
    console.error(line);

    // If context contains sessionId, write to session-specific log
    if (entry.context && 'sessionId' in entry.context) {
      const sessionId = entry.context.sessionId as string;
      const sessionLogFile = this.sessionLogFiles.get(sessionId);
      if (sessionLogFile) {
        try {
          fs.appendFileSync(sessionLogFile, line + '\n');
        } catch {
          // Ignore session log write errors
        }
      }
    }
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
    // No-op: session logs are written synchronously
  }
}
