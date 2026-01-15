import { z } from 'zod';

export const StartInputSchema = z.object({
  sessionId: z.string().min(1)
    .describe('The session ID from core.start_session'),
  port: z.number().int().min(1024).max(65535).optional()
    .describe('Proxy port (auto-selected if not provided)'),
  listenHost: z.string().default('0.0.0.0')
    .describe('Host to listen on'),
});

export const StopInputSchema = z.object({
  sessionId: z.string().min(1)
    .describe('The session ID'),
  keepData: z.boolean().default(true)
    .describe('Keep captured traffic data'),
});

export const StatusInputSchema = z.object({
  sessionId: z.string().min(1)
    .describe('The session ID'),
});

export const QueryInputSchema = z.object({
  sessionId: z.string().min(1)
    .describe('The session ID'),
  lastNSeconds: z.number().int().min(1).max(3600).optional()
    .describe('Get entries from the last N seconds'),
  startTime: z.string().optional()
    .describe('ISO8601 timestamp for range start'),
  endTime: z.string().optional()
    .describe('ISO8601 timestamp for range end'),
  urlPattern: z.string().optional()
    .describe('Regex pattern to filter by URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional()
    .describe('Filter by HTTP method'),
  statusCode: z.number().int().min(100).max(599).optional()
    .describe('Filter by exact status code'),
  statusRange: z.enum(['1xx', '2xx', '3xx', '4xx', '5xx']).optional()
    .describe('Filter by status code range'),
  contentType: z.string().optional()
    .describe('Filter by response content-type'),
  limit: z.number().int().min(1).max(500).default(50)
    .describe('Maximum number of entries'),
  offset: z.number().int().min(0).default(0)
    .describe('Offset for pagination'),
  includeBody: z.boolean().default(false)
    .describe('Include request/response bodies'),
});

export const GetEntryInputSchema = z.object({
  sessionId: z.string().min(1)
    .describe('The session ID'),
  entryId: z.string().min(1)
    .describe('The entry ID from query results'),
});

export const ClearInputSchema = z.object({
  sessionId: z.string().min(1)
    .describe('The session ID'),
  beforeTime: z.string().optional()
    .describe('Clear entries before this ISO8601 timestamp'),
  olderThanSeconds: z.number().int().min(1).optional()
    .describe('Clear entries older than N seconds'),
});

export type StartInput = z.infer<typeof StartInputSchema>;
export type StopInput = z.infer<typeof StopInputSchema>;
export type StatusInput = z.infer<typeof StatusInputSchema>;
export type QueryInput = z.infer<typeof QueryInputSchema>;
export type GetEntryInput = z.infer<typeof GetEntryInputSchema>;
export type ClearInput = z.infer<typeof ClearInputSchema>;
