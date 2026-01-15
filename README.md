# sniaff-mitmdump-mcp

MCP server for mitmproxy traffic capture and analysis. Part of the [Sniaff](https://github.com/sniaff) toolkit.

## Prerequisites

### 1. mitmproxy

Install mitmproxy (includes `mitmdump`):

```bash
# macOS
brew install mitmproxy

# Linux (pip)
pip install mitmproxy

# Or with pipx (recommended)
pipx install mitmproxy
```

Verify installation:
```bash
mitmdump --version
```

### 2. Node.js

Node.js 18.0.0 or higher is required.

```bash
node --version  # Should be >= 18.0.0
```

## Installation

```bash
# Clone the repository
git clone https://github.com/sniaff/sniaff-mitmdump-mcp.git
cd sniaff-mitmdump-mcp

# Install dependencies
npm install

# Build
npm run build
```

## Configuration

Environment variables for customization:

| Variable | Default | Description |
|----------|---------|-------------|
| `SNIAFF_DIR` | `~/.sniaff` | Base directory for sniaff data |
| `SNIAFF_SESSIONS_DIR` | `~/.sniaff/sessions` | Directory for session state files |
| `MITM_MITMDUMP_PATH` | `mitmdump` | Path to mitmdump executable |
| `MITM_ADDON_PATH` | (auto-detected) | Path to har_capture.py addon |
| `MITM_DEFAULT_PORT` | `8080` | Default proxy port |
| `MITM_PORT_RANGE_START` | `8080` | Start of port range for auto-selection |
| `MITM_PORT_RANGE_END` | `8180` | End of port range for auto-selection |

## MCP Tools

### `mitm.start`

Start the MITM proxy for a session.

**Input:**
```json
{
  "sessionId": "sniaff-abc123",
  "port": 8080,
  "listenHost": "0.0.0.0"
}
```

**Output:**
```json
{
  "sessionId": "sniaff-abc123",
  "proxyPort": 8080,
  "proxyHost": "0.0.0.0",
  "androidProxyConfig": {
    "host": "10.0.2.2",
    "port": 8080
  }
}
```

### `mitm.stop`

Stop the MITM proxy for a session.

**Input:**
```json
{
  "sessionId": "sniaff-abc123"
}
```

### `mitm.query`

Query captured traffic with filters.

**Input:**
```json
{
  "sessionId": "sniaff-abc123",
  "lastNSeconds": 10,
  "urlPattern": "api\\.example\\.com",
  "method": "POST",
  "statusCode": 200,
  "limit": 50,
  "includeBody": false
}
```

**Available filters:**
- `lastNSeconds` - Get requests from the last N seconds
- `startTime` / `endTime` - ISO8601 time range
- `urlPattern` - Regex pattern for URL matching
- `method` - HTTP method (GET, POST, etc.)
- `statusCode` - Response status code
- `host` - Filter by host
- `limit` - Maximum number of results (default: 50)
- `includeBody` - Include request/response bodies (default: false)

### `mitm.status`

Get proxy status and statistics.

**Input:**
```json
{
  "sessionId": "sniaff-abc123"
}
```

### `mitm.clear`

Clear captured traffic for a session.

**Input:**
```json
{
  "sessionId": "sniaff-abc123"
}
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sniaff-mitmdump": {
      "command": "node",
      "args": ["/path/to/sniaff-mitmdump-mcp/build/index.js"]
    }
  }
}
```

## Architecture

```
sniaff-mitmdump-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config.ts             # Configuration
│   ├── addon/
│   │   └── har_capture.py    # mitmproxy addon for traffic capture
│   ├── core/
│   │   ├── proxy-manager.ts  # Manages mitmdump processes
│   │   ├── traffic-store.ts  # JSONL traffic storage
│   │   ├── state-client.ts   # Shared state management
│   │   └── process-supervisor.ts
│   ├── tools/                # MCP tool implementations
│   └── types/                # TypeScript types
└── build/                    # Compiled output
```

## Traffic Storage

Traffic is captured in JSONL format (one JSON object per line) at:
```
~/.sniaff/sessions/{sessionId}/mitm/traffic.jsonl
```

Each entry contains:
- Request: method, URL, headers, body, query string
- Response: status, headers, body, content type
- Timing information
- Timestamps (ISO8601 and milliseconds)

## Integration with Sniaff

This MCP works together with:
- **sniaff-core-mcp** - Session orchestration
- **sniaff-android-mcp** - Android emulator management

Typical workflow:
```
1. core.start_session()        → Creates session
2. sniaff.start(sessionId)     → Starts Android emulator
3. mitm.start(sessionId)       → Starts MITM proxy
4. sniaff.set_proxy(...)       → Configures proxy on emulator
5. [interact with app]
6. mitm.query(lastNSeconds=10) → Get recent traffic
7. core.stop_session()         → Cleanup
```

## License

MIT
