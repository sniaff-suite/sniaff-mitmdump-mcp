import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyManager } from '../core/proxy-manager.js';
import { QueryInputSchema } from '../types/schemas.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export function registerQueryTool(
  server: McpServer,
  proxyManager: ProxyManager
): void {
  server.tool(
    'mitm.query',
    'Query captured HTTP traffic by time range and filters. Use lastNSeconds to get recent traffic (e.g., lastNSeconds=10 to get traffic from the last 10 seconds after a UI action).',
    {
      sessionId: QueryInputSchema.shape.sessionId,
      lastNSeconds: QueryInputSchema.shape.lastNSeconds,
      startTime: QueryInputSchema.shape.startTime,
      endTime: QueryInputSchema.shape.endTime,
      urlPattern: QueryInputSchema.shape.urlPattern,
      method: QueryInputSchema.shape.method,
      statusCode: QueryInputSchema.shape.statusCode,
      statusRange: QueryInputSchema.shape.statusRange,
      contentType: QueryInputSchema.shape.contentType,
      limit: QueryInputSchema.shape.limit,
      offset: QueryInputSchema.shape.offset,
      includeBody: QueryInputSchema.shape.includeBody,
    },
    async (args) => {
      try {
        const trafficStore = proxyManager.getTrafficStore(args.sessionId);

        if (!trafficStore) {
          throw new MitmError(
            ErrorCode.PROXY_NOT_RUNNING,
            `No traffic store for session: ${args.sessionId}. Start the proxy first with mitm.start()`,
            { sessionId: args.sessionId }
          );
        }

        // Calculate time range
        let startTimeMs: number | undefined;
        let endTimeMs: number | undefined;

        if (args.lastNSeconds) {
          const now = Date.now();
          startTimeMs = now - (args.lastNSeconds * 1000);
          endTimeMs = now;
        } else {
          if (args.startTime) {
            startTimeMs = new Date(args.startTime).getTime();
          }
          if (args.endTime) {
            endTimeMs = new Date(args.endTime).getTime();
          }
        }

        const result = await trafficStore.query({
          startTimeMs,
          endTimeMs,
          urlPattern: args.urlPattern,
          method: args.method,
          statusCode: args.statusCode,
          statusRange: args.statusRange,
          contentType: args.contentType,
          limit: args.limit || 50,
          offset: args.offset || 0,
          includeBody: args.includeBody || false,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: true,
                  query: {
                    startTimeMs,
                    endTimeMs,
                    urlPattern: args.urlPattern,
                    method: args.method,
                  },
                  totalMatches: result.total,
                  returned: result.entries.length,
                  entries: result.entries,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const mitmError =
          error instanceof MitmError
            ? error
            : new MitmError(
                ErrorCode.INTERNAL_ERROR,
                error instanceof Error ? error.message : String(error)
              );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: false,
                  error: mitmError.toJSON(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
