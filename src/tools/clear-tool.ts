import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyManager } from '../core/proxy-manager.js';
import { ClearInputSchema } from '../types/schemas.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export function registerClearTool(
  server: McpServer,
  proxyManager: ProxyManager
): void {
  server.tool(
    'mitm.clear',
    'Clear captured traffic data for a session. Optionally clear only entries before a certain time.',
    {
      sessionId: ClearInputSchema.shape.sessionId,
      beforeTime: ClearInputSchema.shape.beforeTime,
      olderThanSeconds: ClearInputSchema.shape.olderThanSeconds,
    },
    async (args) => {
      try {
        const trafficStore = proxyManager.getTrafficStore(args.sessionId);

        if (!trafficStore) {
          throw new MitmError(
            ErrorCode.PROXY_NOT_RUNNING,
            `No traffic store for session: ${args.sessionId}`,
            { sessionId: args.sessionId }
          );
        }

        let beforeTimeMs: number | undefined;

        if (args.olderThanSeconds) {
          beforeTimeMs = Date.now() - (args.olderThanSeconds * 1000);
        } else if (args.beforeTime) {
          beforeTimeMs = new Date(args.beforeTime).getTime();
        }

        const statsBefore = await trafficStore.getStats();
        const cleared = await trafficStore.clear(beforeTimeMs);
        const statsAfter = await trafficStore.getStats();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: true,
                  entriesCleared: cleared,
                  entriesRemaining: statsAfter.totalEntries,
                  message: beforeTimeMs
                    ? `Cleared ${cleared} entries older than ${new Date(beforeTimeMs).toISOString()}`
                    : `Cleared all ${cleared} entries`,
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
