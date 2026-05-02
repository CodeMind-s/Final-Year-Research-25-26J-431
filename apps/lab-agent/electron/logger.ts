// Tiny file logger that mirrors a subset of @nestjs/common's Logger API so
// auto-updater (which expects info/warn/error) can use it. Writes to the
// agent logs dir if LAB_AGENT_LOGS_DIR is set, otherwise to console only.

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class Logger {
  private readonly logFile: string | null;

  constructor(private readonly context: string) {
    const dir = process.env.LAB_AGENT_LOGS_DIR;
    if (dir && existsSync(dir)) {
      this.logFile = join(dir, 'electron.log');
    } else if (dir) {
      try {
        mkdirSync(dir, { recursive: true });
        this.logFile = join(dir, 'electron.log');
      } catch {
        this.logFile = null;
      }
    } else {
      this.logFile = null;
    }
  }

  info(msg: string) { this.write('INFO', msg); }
  warn(msg: string) { this.write('WARN', msg); }
  error(msg: string) { this.write('ERROR', msg); }
  debug(msg: string) { this.write('DEBUG', msg); }

  private write(level: string, msg: string) {
    const line = `${new Date().toISOString()} [${level}] [${this.context}] ${msg}`;
    // eslint-disable-next-line no-console
    console.log(line);
    if (this.logFile) {
      try { appendFileSync(this.logFile, line + '\n'); } catch { /* ignore */ }
    }
  }
}
