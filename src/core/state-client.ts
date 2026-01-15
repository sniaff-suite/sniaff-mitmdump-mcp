import * as fs from 'fs';
import * as path from 'path';
import { SessionState, MitmState } from '../types/session.js';
import { MitmError, ErrorCode } from '../types/errors.js';
import { Logger } from '../utils/logger.js';

const STATE_FILE = 'state.json';

/**
 * Client for reading/writing to the shared session state file.
 * This allows coordination between sniaff-core-mcp, sniaff-android-mcp, and sniaff-mitmdump-mcp.
 */
export class StateClient {
  constructor(
    private sessionsDir: string,
    private logger: Logger
  ) {}

  private getStatePath(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId, STATE_FILE);
  }

  getSessionDir(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId);
  }

  getMitmDir(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId, 'mitm');
  }

  async read(sessionId: string): Promise<SessionState> {
    const statePath = this.getStatePath(sessionId);
    try {
      const content = await fs.promises.readFile(statePath, 'utf-8');
      return JSON.parse(content) as SessionState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new MitmError(
          ErrorCode.SESSION_NOT_FOUND,
          `Session not found: ${sessionId}. Create a session first with core.start_session()`,
          { sessionId }
        );
      }
      throw new MitmError(
        ErrorCode.STATE_READ_FAILED,
        `Failed to read session state: ${error instanceof Error ? error.message : String(error)}`,
        { sessionId, statePath }
      );
    }
  }

  async updateMitm(sessionId: string, mitm: Partial<MitmState>): Promise<SessionState> {
    const statePath = this.getStatePath(sessionId);

    // Read current state
    const current = await this.read(sessionId);

    // Merge mitm state
    const updated: SessionState = {
      ...current,
      mitm: { ...current.mitm, ...mitm } as MitmState,
    };

    // Write back
    try {
      await fs.promises.writeFile(statePath, JSON.stringify(updated, null, 2), 'utf-8');
      this.logger.debug('Updated mitm state', { sessionId, mitm });
      return updated;
    } catch (error) {
      throw new MitmError(
        ErrorCode.STATE_WRITE_FAILED,
        `Failed to write session state: ${error instanceof Error ? error.message : String(error)}`,
        { sessionId, statePath }
      );
    }
  }

  async isSessionStopping(sessionId: string): Promise<boolean> {
    try {
      const state = await this.read(sessionId);
      return state.status === 'stopping' || state.status === 'stopped';
    } catch {
      return true; // If we can't read state, assume session is gone
    }
  }

  async ensureMitmDir(sessionId: string): Promise<string> {
    const mitmDir = this.getMitmDir(sessionId);
    await fs.promises.mkdir(mitmDir, { recursive: true });
    return mitmDir;
  }
}
