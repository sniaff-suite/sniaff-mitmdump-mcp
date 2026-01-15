import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyManager } from '../core/proxy-manager.js';
import { GetEntryInputSchema } from '../types/schemas.js';
import { MitmError, ErrorCode } from '../types/errors.js';

export function registerGetEntryTool(
  server: McpServer,
  proxyManager: ProxyManager
): void {
  server.tool(
    'mitm.get_entry',
    'Get the full details of a captured HTTP entry, including request and response bodies.',
    {
      sessionId: GetEntryInputSchema.shape.sessionId,
      entryId: GetEntryInputSchema.shape.entryId,
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

        const result = await trafficStore.getEntry(args.entryId);

        if (!result) {
          throw new MitmError(
            ErrorCode.ENTRY_NOT_FOUND,
            `Entry not found: ${args.entryId}`,
            { sessionId: args.sessionId, entryId: args.entryId }
          );
        }

        // Bodies are already strings from JSONL format
        const requestBodyText = result.requestBody;
        const responseBodyText = result.responseBody;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  ok: true,
                  entry: {
                    ...result.entry,
                    requestBodyText,
                    responseBodyText,
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
