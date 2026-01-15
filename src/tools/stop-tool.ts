import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyManager } from '../core/proxy-manager.js';
import { StopInputSchema } from '../types/schemas.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export function registerStopTool(
  server: McpServer,
  proxyManager: ProxyManager
): void {
  server.tool(
    'mitm.stop',
    'Stop the mitmdump proxy for a session.',
    {
      sessionId: StopInputSchema.shape.sessionId,
      keepData: StopInputSchema.shape.keepData,
    },
    async (args) => {
      try {
        const session = proxyManager.getSession(args.sessionId);
        const stats = session ? await proxyManager.getTrafficStore(args.sessionId)?.getStats() : undefined;

        await proxyManager.stopProxy(args.sessionId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: true,
                  sessionId: args.sessionId,
                  entriesCaptured: stats?.totalEntries || 0,
                  message: 'Proxy stopped',
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
