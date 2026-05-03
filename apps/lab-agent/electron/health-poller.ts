// Polls the in-process NestJS server's /health endpoint to keep the tray
// menu populated with live FPS / queue / model state. No shared-memory
// hacks — same protocol the rest of the app uses.

import * as http from 'http';
import * as https from 'https';

export interface HealthSnapshot {
  status: 'ok' | 'unreachable';
  modelLoaded: boolean;
  modelPath?: string;
  version?: string;
  fps: number;
  connectedClients: number;
  uptimeSeconds: number;
  queuePending: number;
  queueDropped: number;
  queuePermFailures: number;
}

const EMPTY: HealthSnapshot = {
  status: 'unreachable',
  modelLoaded: false,
  fps: 0,
  connectedClients: 0,
  uptimeSeconds: 0,
  queuePending: 0,
  queueDropped: 0,
  queuePermFailures: 0,
};

export class HealthPoller {
  private latest: HealthSnapshot = EMPTY;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly url: string,
    private readonly intervalMs = 1000,
    private readonly onChange?: () => void,
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(() => undefined), this.intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  snapshot(): HealthSnapshot {
    return this.latest;
  }

  private async tick(): Promise<void> {
    try {
      const body = await this.fetch(this.url);
      const parsed = JSON.parse(body);
      this.latest = {
        status: parsed.status === 'ok' ? 'ok' : 'unreachable',
        modelLoaded: !!parsed.model,
        modelPath: parsed.modelPath,
        version: parsed.version,
        fps: parsed.metrics?.fps ?? 0,
        connectedClients: parsed.metrics?.connectedClients ?? 0,
        uptimeSeconds: parsed.metrics?.uptimeSeconds ?? 0,
        queuePending: parsed.cloudSync?.pending ?? 0,
        queueDropped: parsed.cloudSync?.droppedOnOverflow ?? 0,
        queuePermFailures: parsed.cloudSync?.permanentFailures ?? 0,
      };
    } catch {
      this.latest = { ...EMPTY };
    }
    this.onChange?.();
  }

  private fetch(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { rejectUnauthorized: false } as any, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      });
      req.setTimeout(2000, () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    });
  }
}
