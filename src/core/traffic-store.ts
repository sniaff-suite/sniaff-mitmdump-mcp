import * as fs from 'fs';
import { HarEntry, HarEntrySummary } from '../types/har.js';
import { Logger } from '../utils/logger.js';

export interface QueryOptions {
  startTimeMs?: number;
  endTimeMs?: number;
  urlPattern?: string;
  method?: string;
  statusCode?: number;
  statusRange?: string;
  contentType?: string;
  limit: number;
  offset: number;
  includeBody: boolean;
}

export interface TrafficStats {
  totalEntries: number;
  totalRequestBytes: number;
  totalResponseBytes: number;
  entriesLast60s: number;
}

interface JsonlEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  request: {
    method: string;
    url: string;
    host: string;
    path: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    bodySize: number;
    body?: string;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    contentType: string;
    bodySize: number;
    body?: string;
  };
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    receive: number;
  };
  serverIPAddress?: string;
}

/**
 * TrafficStore that reads from JSONL file written by mitmdump addon.
 * Each line in the file is a complete JSON entry.
 */
export class TrafficStore {
  private entries: JsonlEntry[] = [];
  private lastReadPosition: number = 0;

  constructor(
    private jsonlPath: string,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    // Create empty file if it doesn't exist
    try {
      await fs.promises.access(this.jsonlPath);
    } catch {
      await fs.promises.writeFile(this.jsonlPath, '', 'utf-8');
    }
    this.logger.info('Traffic store initialized', { jsonlPath: this.jsonlPath });
  }

  /**
   * Reload entries from the JSONL file.
   */
  private async reloadEntries(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.jsonlPath);

      // If file hasn't grown, no new entries
      if (stats.size <= this.lastReadPosition) {
        return;
      }

      // Read entire file and parse
      const content = await fs.promises.readFile(this.jsonlPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      this.entries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JsonlEntry;
          this.entries.push(entry);
        } catch (e) {
          this.logger.warn('Failed to parse JSONL line', { error: String(e) });
        }
      }

      this.lastReadPosition = stats.size;
      this.logger.debug('Reloaded entries', { count: this.entries.length });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async query(options: QueryOptions): Promise<{ entries: HarEntrySummary[]; total: number }> {
    await this.reloadEntries();

    let filtered = [...this.entries];

    // Apply filters
    if (options.startTimeMs !== undefined) {
      filtered = filtered.filter(e => e.timestampMs >= options.startTimeMs!);
    }

    if (options.endTimeMs !== undefined) {
      filtered = filtered.filter(e => e.timestampMs <= options.endTimeMs!);
    }

    if (options.urlPattern) {
      const pattern = options.urlPattern.toLowerCase();
      filtered = filtered.filter(e => e.request.url.toLowerCase().includes(pattern));
    }

    if (options.method) {
      filtered = filtered.filter(e => e.request.method === options.method);
    }

    if (options.statusCode !== undefined) {
      filtered = filtered.filter(e => e.response.status === options.statusCode);
    }

    if (options.statusRange) {
      const rangeStart = parseInt(options.statusRange[0]) * 100;
      const rangeEnd = rangeStart + 99;
      filtered = filtered.filter(e => e.response.status >= rangeStart && e.response.status <= rangeEnd);
    }

    if (options.contentType) {
      const ct = options.contentType.toLowerCase();
      filtered = filtered.filter(e => e.response.contentType.toLowerCase().includes(ct));
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestampMs - a.timestampMs);

    const total = filtered.length;

    // Apply pagination
    const paginated = filtered.slice(options.offset, options.offset + options.limit);

    // Convert to summary format
    const entries: HarEntrySummary[] = paginated.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      request: {
        method: e.request.method,
        url: e.request.url,
        bodySize: e.request.bodySize,
      },
      response: {
        status: e.response.status,
        statusText: e.response.statusText,
        mimeType: e.response.contentType,
        bodySize: e.response.bodySize,
      },
    }));

    return { entries, total };
  }

  async getEntry(entryId: string): Promise<{ entry: HarEntry; requestBody?: string; responseBody?: string } | null> {
    await this.reloadEntries();

    const jsonlEntry = this.entries.find(e => e.id === entryId);
    if (!jsonlEntry) return null;

    // Convert to HarEntry format
    const entry: HarEntry = {
      id: jsonlEntry.id,
      timestamp: jsonlEntry.timestamp,
      timestampMs: jsonlEntry.timestampMs,
      request: {
        method: jsonlEntry.request.method,
        url: jsonlEntry.request.url,
        httpVersion: jsonlEntry.request.httpVersion,
        headers: jsonlEntry.request.headers,
        queryString: jsonlEntry.request.queryString,
        cookies: [],
        headersSize: 0,
        bodySize: jsonlEntry.request.bodySize,
      },
      response: {
        status: jsonlEntry.response.status,
        statusText: jsonlEntry.response.statusText,
        httpVersion: jsonlEntry.response.httpVersion,
        headers: jsonlEntry.response.headers,
        cookies: [],
        content: {
          size: jsonlEntry.response.bodySize,
          mimeType: jsonlEntry.response.contentType,
        },
        redirectURL: '',
        headersSize: 0,
        bodySize: jsonlEntry.response.bodySize,
      },
      timings: jsonlEntry.timings,
      serverIPAddress: jsonlEntry.serverIPAddress,
    };

    return {
      entry,
      requestBody: jsonlEntry.request.body,
      responseBody: jsonlEntry.response.body,
    };
  }

  async clear(beforeTimeMs?: number): Promise<number> {
    await this.reloadEntries();

    const originalCount = this.entries.length;

    if (beforeTimeMs !== undefined) {
      this.entries = this.entries.filter(e => e.timestampMs >= beforeTimeMs);
    } else {
      this.entries = [];
    }

    const cleared = originalCount - this.entries.length;

    // Rewrite the file with remaining entries
    const content = this.entries.map(e => JSON.stringify(e)).join('\n');
    await fs.promises.writeFile(this.jsonlPath, content ? content + '\n' : '', 'utf-8');

    const stats = await fs.promises.stat(this.jsonlPath);
    this.lastReadPosition = stats.size;

    return cleared;
  }

  async getStats(): Promise<TrafficStats> {
    await this.reloadEntries();

    const nowMs = Date.now();
    const sixtySecondsAgo = nowMs - 60000;

    let totalRequestBytes = 0;
    let totalResponseBytes = 0;
    let entriesLast60s = 0;

    for (const entry of this.entries) {
      totalRequestBytes += entry.request.bodySize;
      totalResponseBytes += entry.response.bodySize;
      if (entry.timestampMs >= sixtySecondsAgo) {
        entriesLast60s++;
      }
    }

    return {
      totalEntries: this.entries.length,
      totalRequestBytes,
      totalResponseBytes,
      entriesLast60s,
    };
  }

  async close(): Promise<void> {
    this.entries = [];
    this.lastReadPosition = 0;
    this.logger.info('Traffic store closed');
  }
}
