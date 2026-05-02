// Electron entry point for the Brinex Lab Agent.
//
// Ownership: this process owns both the Electron tray UI and the in-process
// NestJS server. NestJS boots as a side effect of importing the bundled
// dist/apps/lab-agent/main.js (Phase 2's bootstrap()), and the tray polls the
// resulting /health endpoint over HTTP for live status.

import { app, Notification, Tray, nativeImage } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { setupAgentPaths, AgentPaths } from './app-paths';
import { ensureCert, CertResult } from './cert-bootstrap';
import { HealthPoller } from './health-poller';
import { buildTrayMenu, TrayMenuContext } from './tray-menu';
import { setupAutoUpdater } from './auto-updater';
import { Logger } from './logger';

// Single-instance lock — second copy exits silently.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const log = new Logger('Electron');
let tray: Tray | null = null;
let poller: HealthPoller | null = null;

// Auto-launch on Windows boot. Skipped during dev when ELECTRON_DISABLE_AUTOLAUNCH=1.
function configureAutoLaunch() {
  if (process.env.ELECTRON_DISABLE_AUTOLAUNCH === '1') return;
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ['--hidden'], // honored by app code that hides windows on launch
    });
  } catch (err: any) {
    log.warn(`auto-launch setup failed: ${err.message}`);
  }
}

function loadTrayIcon(electronDir: string): Electron.NativeImage {
  const iconPath = join(electronDir, 'assets', 'tray.png');
  if (existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  // Fall back to a 16x16 transparent placeholder so Tray() doesn't throw.
  // Replace assets/tray.png + tray.ico before publishing the installer.
  return nativeImage.createEmpty();
}

async function bootNestServer(): Promise<void> {
  // Resolve the bundled NestJS entry. In dev (electron .) the file lives at
  // ../../dist/apps/lab-agent/main.js relative to this file's source location;
  // in a packaged app electron-builder copies dist/apps/lab-agent into the
  // resources dir and rewrites paths, so we resolve relative to __dirname.
  const candidates = [
    join(__dirname, '..', 'main.js'),                       // packaged: dist/apps/lab-agent/electron/main.js -> ../main.js
    join(__dirname, '..', '..', 'dist', 'apps', 'lab-agent', 'main.js'), // dev fallback
  ];
  const target = candidates.find((p) => existsSync(p));
  if (!target) {
    throw new Error(
      `Could not locate the bundled NestJS entry. Did you run "nx build lab-agent"? ` +
        `Looked at: ${candidates.join(', ')}`,
    );
  }
  log.info(`Loading NestJS server from ${target}`);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(target);
}

function buildTrayContext(paths: AgentPaths, certResult: CertResult | null): TrayMenuContext {
  const protocol = process.env.AGENT_CERT_KEY && existsSync(process.env.AGENT_CERT_KEY) ? 'https' : 'http';
  const port = process.env.LAB_AGENT_PORT || '5005';
  return {
    agentUrl: `${protocol}://localhost:${port}`,
    webAppUrl: process.env.BRINEX_WEB_APP_URL || 'http://localhost:3000',
    logsDir: paths.logs,
    certsDir: paths.certs,
    certTrusted: certResult?.trusted ?? true,
    onQuit: () => app.quit(),
  };
}

function notifyCertNotTrusted() {
  if (!Notification.isSupported()) return;
  try {
    new Notification({
      title: 'Brinex — certificate needs manual install',
      body:
        "Couldn't install the security certificate automatically. " +
        'Open the tray menu → Help → Install Certificate Manually.',
      urgency: 'critical',
    }).show();
  } catch (err: any) {
    log.warn(`Failed to show cert notification: ${err.message}`);
  }
}

app.whenReady().then(async () => {
  const paths = setupAgentPaths();
  log.info(`Agent data dir: ${paths.root}`);

  configureAutoLaunch();

  // mkcert bootstrap — must run before NestJS boots so the env vars are set
  // when AppModule's HTTPS loader reads them.
  let certResult: CertResult | null = null;
  try {
    certResult = await ensureCert(paths.certs);
    if (existsSync(certResult.cert) && existsSync(certResult.key)) {
      process.env.AGENT_CERT_KEY = certResult.key;
      process.env.AGENT_CERT_CRT = certResult.cert;
    }
    if (!certResult.trusted) {
      notifyCertNotTrusted();
    }
  } catch (err: any) {
    log.error(`Cert bootstrap threw: ${err.message}. Continuing without HTTPS.`);
  }

  try {
    await bootNestServer();
  } catch (err: any) {
    log.error(`Failed to start NestJS: ${err.message}`);
    app.quit();
    return;
  }

  // Tray icon
  const icon = loadTrayIcon(__dirname);
  tray = new Tray(icon);
  tray.setToolTip('Brinex Lab Agent');

  // Live status poller — refreshes the menu every second.
  const ctx = buildTrayContext(paths, certResult);
  poller = new HealthPoller(`${ctx.agentUrl}/health`, 1000, () => {
    if (tray && poller) tray.setContextMenu(buildTrayMenu(poller.snapshot(), ctx));
  });
  poller.start();

  setupAutoUpdater();
});

// Stay alive in tray when all windows close (we don't open any windows).
// Registering a listener at all is what keeps the app from auto-quitting on
// non-macOS — Electron's default "quit when no windows" only fires when no
// 'window-all-closed' listener is attached.
app.on('window-all-closed', () => {
  /* intentional no-op: tray app keeps running */
});

// Second-instance signal — focus the existing tray (no-op since we have no windows).
app.on('second-instance', () => {
  log.info('Second instance attempted to launch — ignoring.');
});

app.on('before-quit', () => {
  poller?.stop();
});
