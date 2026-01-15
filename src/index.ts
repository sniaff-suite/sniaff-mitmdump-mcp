import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { Logger } from './utils/logger.js';
import { ProxyManager } from './core/proxy-manager.js';
import {
  registerStartTool,
  registerStopTool,
  registerStatusTool,
  registerQueryTool,
  registerGetEntryTool,
  registerClearTool,
} from './tools/index.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger('sniaff-mitmdump');

  await logger.initialize(config.logsDir);

  logger.info('Starting sniaff-mitmdump-mcp', { config });

  const server = new McpServer({
    name: 'sniaff-mitmdump-mcp',
    version: '0.1.0',
  });

  const proxyManager = new ProxyManager({
    config,
    logger,
  });

  // Register tools
  registerStartTool(server, proxyManager);
  registerStopTool(server, proxyManager);
  registerStatusTool(server, proxyManager);
  registerQueryTool(server, proxyManager);
  registerGetEntryTool(server, proxyManager);
  registerClearTool(server, proxyManager);

  logger.info('Tools registered', {
    tools: ['mitm.start', 'mitm.stop', 'mitm.status', 'mitm.query', 'mitm.get_entry', 'mitm.clear'],
  });

  // Setup graceful shutdown handlers
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Received shutdown signal, cleaning up...', { signal });

    try {
      await proxyManager.cleanup();
      logger.info('Shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown', { error: String(error) });
    }

    process.exit(0);
  };

  // Handle various termination signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  // Handle stdin close (client disconnected)
  process.stdin.on('close', () => {
    logger.info('stdin closed, client disconnected');
    shutdown('stdin-close');
  });

  // Handle stdin end
  process.stdin.on('end', () => {
    logger.info('stdin ended, client disconnected');
    shutdown('stdin-end');
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP server connected and ready');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
