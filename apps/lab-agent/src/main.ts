import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Request, Response, NextFunction } from 'express';

// The bundled best.onnx ships next to main.js (see webpack assets config).
// Resolve a default before AppModule loads so InferenceService.constructor
// — which reads VISION_MODEL_PATH at instantiation — picks it up.
if (!process.env.VISION_MODEL_PATH && !process.env.MODEL_PATH) {
  process.env.VISION_MODEL_PATH = join(__dirname, 'assets/models/best.onnx');
}

import { AppModule } from './app/app.module';

const PORT = parseInt(process.env.LAB_AGENT_PORT || '5005', 10);
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  (process.env.NODE_ENV === 'production'
    ? 'https://app.brinex.com'
    : 'http://localhost:3000');

function loadHttpsOptions() {
  const keyPath = process.env.AGENT_CERT_KEY;
  const certPath = process.env.AGENT_CERT_CRT;

  if (!keyPath || !certPath) return undefined;
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    Logger.warn(
      `AGENT_CERT_KEY/AGENT_CERT_CRT set but files missing — falling back to plain HTTP`,
      'Bootstrap',
    );
    return undefined;
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

async function bootstrap() {
  const httpsOptions = loadHttpsOptions();
  const protocol = httpsOptions ? 'https' : 'http';

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    httpsOptions ? { httpsOptions } : {},
  );

  app.enableCors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS'],
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  // Catch-all 404. The agent only exposes GET /health and the /vision socket
  // namespace — anything else (including stolen-cert probes) gets a flat 404
  // before it can reach a controller.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isHealth = req.method === 'GET' && (req.path === '/health' || req.path === '/health/');
    const isSocketUpgrade = req.path?.startsWith('/socket.io') || req.path?.startsWith('/vision');
    if (isHealth || isSocketUpgrade) return next();
    res.status(404).json({ error: 'Not Found' });
  });

  await app.listen(PORT);

  Logger.log(`Lab Agent listening on ${protocol}://localhost:${PORT}`, 'Bootstrap');
  Logger.log(`WebSocket namespace: ${protocol === 'https' ? 'wss' : 'ws'}://localhost:${PORT}/vision`, 'Bootstrap');
  if (!httpsOptions) {
    Logger.warn(
      'Running over plain HTTP. Browsers loaded from HTTPS origins will block ws:// — ' +
        'launch via the Electron wrapper (which generates a cert via mkcert) or set ' +
        'AGENT_CERT_KEY/AGENT_CERT_CRT manually for `nx serve` runs.',
      'Bootstrap',
    );
  }
}

bootstrap();
