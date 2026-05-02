import { Injectable, OnModuleDestroy } from '@nestjs/common';

const FPS_WINDOW_MS = 1000;

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private frameCounter = 0;
  private currentFps = 0;
  private connectedClients = 0;
  private readonly timer: NodeJS.Timeout;
  private readonly bootedAt = Date.now();

  constructor() {
    this.timer = setInterval(() => this.rollWindow(), FPS_WINDOW_MS);
    this.timer.unref?.();
  }

  recordFrame(): void {
    this.frameCounter += 1;
  }

  clientConnected(): void {
    this.connectedClients += 1;
  }

  clientDisconnected(): void {
    this.connectedClients = Math.max(0, this.connectedClients - 1);
  }

  snapshot() {
    return {
      fps: this.currentFps,
      connectedClients: this.connectedClients,
      uptimeSeconds: Math.floor((Date.now() - this.bootedAt) / 1000),
    };
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private rollWindow() {
    // Convert frames-in-last-window to per-second rate.
    this.currentFps = (this.frameCounter * 1000) / FPS_WINDOW_MS;
    this.frameCounter = 0;
  }
}
