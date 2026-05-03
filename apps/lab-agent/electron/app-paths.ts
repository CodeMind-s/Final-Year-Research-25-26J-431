// Sets up the Brinex agent's data directory layout under %APPDATA%/Brinex/agent.
//
// Layout:
//   %APPDATA%/Brinex/agent/
//   ├── certs/          (Phase 6 — mkcert writes localhost cert here)
//   ├── logs/
//   └── config.json     (cloud URL override, telemetry opt-in, etc.)
//
// Also pushes the resolved paths into process.env so the in-process NestJS
// bootstrap (which reads VISION_MODEL_PATH, AGENT_CERT_KEY/CRT, etc.) picks
// them up automatically when the user hasn't set them explicitly.

import { app } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface AgentPaths {
  root: string;
  certs: string;
  logs: string;
  config: string;
  modelDir: string;
}

export function setupAgentPaths(): AgentPaths {
  const root = join(app.getPath('appData'), 'Brinex', 'agent');
  const certs = join(root, 'certs');
  const logs = join(root, 'logs');
  const config = join(root, 'config.json');
  const modelDir = join(process.resourcesPath || root, 'models');

  for (const dir of [root, certs, logs]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(config)) {
    writeFileSync(
      config,
      JSON.stringify(
        {
          // Override the default cloud URL here if your lab points at a
          // different environment. Empty/missing falls back to env / built-in.
          cloudUrl: '',
          telemetry: { optIn: true },
        },
        null,
        2,
      ),
    );
  }

  // Hand the resolved paths to NestJS via env vars unless the user already set them.
  process.env.LAB_AGENT_LOGS_DIR ??= logs;
  process.env.AGENT_DATA_DIR ??= root;

  // AGENT_CERT_KEY / AGENT_CERT_CRT are populated by cert-bootstrap.ts after
  // mkcert writes the cert. Setting them here would cause NestJS's HTTPS
  // loader to log "files missing" warnings during the cert generation window.

  // Bundled best.onnx ships under resources/models/ via electron-builder's extraResources.
  if (!process.env.VISION_MODEL_PATH && process.resourcesPath) {
    const bundledModel = join(process.resourcesPath, 'models', 'best.onnx');
    if (existsSync(bundledModel)) process.env.VISION_MODEL_PATH = bundledModel;
  }

  return { root, certs, logs, config, modelDir };
}
