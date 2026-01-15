import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { ProcessSupervisor } from './process-supervisor.js';
import { StateClient } from './state-client.js';
import { TrafficStore } from './traffic-store.js';
import { PortFinder } from '../utils/port-finder.js';
import { Logger } from '../utils/logger.js';
import { Config } from '../config.js';
import { ProxySession, ProxyStatus } from '../types/session.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export interface ProxyManagerDeps {
  config: Config;
  logger: Logger;
}

export interface StartProxyInput {
  sessionId: string;
  port?: number;
  listenHost?: string;
}

export class ProxyManager extends EventEmitter {
  private sessions: Map<string, ProxySession> = new Map();
  private trafficStores: Map<string, TrafficStore> = new Map();
  private config: Config;
  private logger: Logger;
  private supervisor: ProcessSupervisor;
  private stateClient: StateClient;
  private portFinder: PortFinder;

  constructor(deps: ProxyManagerDeps) {
    super();
    this.config = deps.config;
    this.logger = deps.logger;
    this.supervisor = new ProcessSupervisor(deps.logger);
    this.stateClient = new StateClient(deps.config.sessionsDir, deps.logger);
    this.portFinder = new PortFinder();
  }

  async startProxy(input: StartProxyInput): Promise<ProxySession> {
    const { sessionId } = input;

    // Check if already running for this session
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      if (existing.status === 'ready' || existing.status === 'starting') {
        throw new MitmError(
          ErrorCode.PROXY_ALREADY_RUNNING,
          `Proxy already running for session: ${sessionId}`,
          { sessionId, status: existing.status }
        );
      }
    }

    // Verify session exists in shared state
    const sessionState = await this.stateClient.read(sessionId);
    if (sessionState.status !== 'active') {
      throw new MitmError(
        ErrorCode.SESSION_INVALID_STATE,
        `Session is not active: ${sessionId}`,
        { sessionId, status: sessionState.status }
      );
    }

    // Find available port
    const port = input.port || await this.portFinder.findAvailablePort(
      this.config.portRangeStart,
      this.config.portRangeEnd
    );

    if (!port) {
      throw new MitmError(
        ErrorCode.PORT_UNAVAILABLE,
        `No available port in range ${this.config.portRangeStart}-${this.config.portRangeEnd}`,
        { portRangeStart: this.config.portRangeStart, portRangeEnd: this.config.portRangeEnd }
      );
    }

    const listenHost = input.listenHost || '0.0.0.0';

    // Ensure mitm directory exists
    const mitmDir = await this.stateClient.ensureMitmDir(sessionId);
    const jsonlPath = path.join(mitmDir, 'traffic.jsonl');
    const logPath = path.join(mitmDir, 'mitmdump.log');

    // Create session object
    const session: ProxySession = {
      sessionId,
      status: 'starting',
      proxyPort: port,
      proxyHost: listenHost,
      pid: null,
      jsonlPath,
      logPath,
      startedAt: null,
      stoppedAt: null,
    };

    this.sessions.set(sessionId, session);

    // Register session-specific log file (mitm logs go in sessionId/mitm/)
    await this.logger.registerSessionLog(sessionId, mitmDir);

    // Update shared state
    await this.stateClient.updateMitm(sessionId, {
      status: 'starting',
      proxyPort: port,
      proxyHost: listenHost,
    });

    try {
      // Initialize traffic store
      const trafficStore = new TrafficStore(jsonlPath, this.logger);
      await trafficStore.initialize();
      this.trafficStores.set(sessionId, trafficStore);

      // Start mitmdump process
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });

      const args = [
        '-s', this.config.addonScriptPath,
        '--set', `har_file=${jsonlPath}`,
        '--listen-host', listenHost,
        '--listen-port', String(port),
        '--ssl-insecure',
        '--set', 'stream_large_bodies=10m',
      ];

      this.logger.info('Starting mitmdump', { sessionId, port, args });

      const processInfo = await this.supervisor.spawn(this.config.mitmdumpPath, args, {
        onStdout: (data) => logStream.write(data),
        onStderr: (data) => logStream.write(data),
        onExit: (code, signal) => {
          this.handleProcessExit(sessionId, code, signal);
          logStream.end();
        },
      });

      session.pid = processInfo.pid;
      session.status = 'ready';
      session.startedAt = new Date().toISOString();

      // Update shared state with full info
      await this.stateClient.updateMitm(sessionId, {
        status: 'ready',
        proxyPort: port,
        proxyHost: listenHost,
        pid: processInfo.pid,
        androidProxyConfig: {
          host: '10.0.2.2',
          port: port,
        },
      });

      this.logger.info('Mitmdump started', { sessionId, pid: processInfo.pid, port });

      return session;
    } catch (error) {
      // Cleanup on failure
      session.status = 'error';
      await this.stateClient.updateMitm(sessionId, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });

      throw new MitmError(
        ErrorCode.MITMDUMP_START_FAILED,
        `Failed to start mitmdump: ${error instanceof Error ? error.message : String(error)}`,
        { sessionId }
      );
    }
  }

  async stopProxy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new MitmError(
        ErrorCode.PROXY_NOT_RUNNING,
        `No proxy running for session: ${sessionId}`,
        { sessionId }
      );
    }

    this.logger.info('Stopping proxy', { sessionId, pid: session.pid });

    // Kill the process
    if (session.pid && this.supervisor.isRunning(session.pid)) {
      await this.supervisor.kill(session.pid);
    }

    // Close traffic store
    const trafficStore = this.trafficStores.get(sessionId);
    if (trafficStore) {
      await trafficStore.close();
      this.trafficStores.delete(sessionId);
    }

    // Update state
    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();

    await this.stateClient.updateMitm(sessionId, {
      status: 'stopped',
      pid: undefined,
    });

    // Unregister session log
    this.logger.unregisterSessionLog(sessionId);

    this.sessions.delete(sessionId);
    this.logger.info('Proxy stopped', { sessionId });
  }

  private handleProcessExit(sessionId: string, code: number | null, signal: string | null): void {
    this.logger.info('Mitmdump process exited', { sessionId, code, signal });

    const session = this.sessions.get(sessionId);
    if (session && session.status === 'ready') {
      session.status = 'error';
      this.stateClient.updateMitm(sessionId, {
        status: 'error',
        error: `Process exited with code ${code}, signal ${signal}`,
      }).catch((err) => {
        this.logger.error('Failed to update state after crash', { sessionId, error: String(err) });
      });
    }
  }

  getSession(sessionId: string): ProxySession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ProxySession[] {
    return Array.from(this.sessions.values());
  }

  getTrafficStore(sessionId: string): TrafficStore | undefined {
    return this.trafficStores.get(sessionId);
  }

  async cleanup(): Promise<void> {
    for (const [sessionId] of this.sessions) {
      try {
        await this.stopProxy(sessionId);
      } catch (error) {
        this.logger.error('Error during cleanup', { sessionId, error: String(error) });
        // Still unregister session log even if stop failed
        this.logger.unregisterSessionLog(sessionId);
      }
    }
  }
}
