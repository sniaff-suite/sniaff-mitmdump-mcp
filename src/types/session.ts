export type ProxyStatus = 'pending' | 'starting' | 'ready' | 'stopped' | 'error';

export interface ProxySession {
  sessionId: string;
  status: ProxyStatus;
  proxyPort: number;
  proxyHost: string;
  pid: number | null;
  jsonlPath: string;
  logPath: string;
  startedAt: string | null;
  stoppedAt: string | null;
}

// Shared state types (from core MCP)
export type SessionStatus = 'active' | 'stopping' | 'stopped';

export interface MitmState {
  status: ProxyStatus;
  proxyPort?: number;
  proxyHost?: string;
  pid?: number;
  androidProxyConfig?: {
    host: string;
    port: number;
  };
  error?: string;
}

export interface SessionState {
  sessionId: string;
  type: string;
  status: SessionStatus;
  createdAt: string;
  stoppedAt?: string;
  android?: unknown;
  mitm?: MitmState;
}
