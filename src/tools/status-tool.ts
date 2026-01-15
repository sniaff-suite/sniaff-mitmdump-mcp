import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyManager } from '../core/proxy-manager.js';
import { StatusInputSchema } from '../types/schemas.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export function registerStatusTool(
  server: McpServer,
  proxyManager: ProxyManager
): void {
  server.tool(
    'mitm.status',
    'Get the status of the mitmdump proxy for a session, including traffic statistics.',
    {
      sessionId: StatusInputSchema.shape.sessionId,
    },
    async (args) => {
      try {
        const session = proxyManager.getSession(args.sessionId);

        if (!session) {
          throw new MitmError(
            ErrorCode.PROXY_NOT_RUNNING,
            `No proxy running for session: ${args.sessionId}`,
            { sessionId: args.sessionId }
          );
        }

        const trafficStore = proxyManager.getTrafficStore(args.sessionId);
        const stats = trafficStore ? await trafficStore.getStats() : null;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: true,
                  sessionId: session.sessionId,
                  status: session.status,
                  proxyPort: session.proxyPort,
                  proxyHost: session.proxyHost,
                  pid: session.pid,
                  startedAt: session.startedAt,
                  stats: stats || {
                    totalEntries: 0,
                    totalRequestBytes: 0,
                    totalResponseBytes: 0,
                    entriesLast60s: 0,
                  },
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
