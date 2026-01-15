import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Config {
  // Base sniaff directory
  sniaffDir: string;
  // Directory for session state files (shared with other MCPs)
  sessionsDir: string;
  // Directory for logs
  logsDir: string;

  // Executables
  mitmdumpPath: string;

  // Addon script path
  addonScriptPath: string;

  // Port configuration
  defaultProxyPort: number;
  portRangeStart: number;
  portRangeEnd: number;

  // Timeouts (ms)
  startTimeout: number;
  stopTimeout: number;
}

export function loadConfig(): Config {
  const homeDir = os.homedir();
  const sniaffDir = process.env.SNIAFF_DIR || path.join(homeDir, '.sniaff');

  // Addon script is in src/addon relative to this file, or build/addon after build
  const addonScriptPath =
    process.env.MITM_ADDON_PATH ||
    path.join(__dirname, 'addon', 'har_capture.py');

  return {
    sniaffDir,
    sessionsDir: process.env.SNIAFF_SESSIONS_DIR || path.join(sniaffDir, 'sessions'),
    logsDir: process.env.SNIAFF_LOGS_DIR || path.join(sniaffDir, 'logs'),

    mitmdumpPath: process.env.MITM_MITMDUMP_PATH || 'mitmdump',
    addonScriptPath,

    defaultProxyPort: parseInt(process.env.MITM_DEFAULT_PORT || '8080', 10),
    portRangeStart: parseInt(process.env.MITM_PORT_RANGE_START || '8080', 10),
    portRangeEnd: parseInt(process.env.MITM_PORT_RANGE_END || '8180', 10),

    startTimeout: parseInt(process.env.MITM_START_TIMEOUT || '10000', 10),
    stopTimeout: parseInt(process.env.MITM_STOP_TIMEOUT || '5000', 10),
  };
}
