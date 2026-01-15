import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyManager } from '../core/proxy-manager.js';
import { StartInputSchema } from '../types/schemas.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export function registerStartTool(
  server: McpServer,
  proxyManager: ProxyManager
): void {
  server.tool(
    'mitm.start',
    'Start a mitmdump proxy for a sniaff session. The proxy will capture all HTTP/HTTPS traffic. Use the returned androidProxyConfig to configure the Android emulator.',
    {
      sessionId: StartInputSchema.shape.sessionId,
      port: StartInputSchema.shape.port,
      listenHost: StartInputSchema.shape.listenHost,
    },
    async (args) => {
      try {
        const session = await proxyManager.startProxy({
          sessionId: args.sessionId,
          port: args.port,
          listenHost: args.listenHost,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: true,
                  sessionId: session.sessionId,
                  proxyPort: session.proxyPort,
                  proxyHost: session.proxyHost,
                  androidProxyConfig: {
                    host: '10.0.2.2',
                    port: session.proxyPort,
                  },
                  message: `Proxy started on ${session.proxyHost}:${session.proxyPort}. Configure Android with sniaff.set_proxy(host="10.0.2.2", port=${session.proxyPort})`,
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
