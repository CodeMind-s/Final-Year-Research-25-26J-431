// Auto-updater stub (Phase 5).
//
// We import `electron-updater` lazily so the dependency is only required when
// AGENT_AUTO_UPDATE === 'true'. The actual update feed URL + signing is
// finalized in Phase 8; until then this file is intentionally a no-op.

import { Logger } from './logger';

const log = new Logger('AutoUpdater');

export function setupAutoUpdater(): void {
  if (process.env.AGENT_AUTO_UPDATE !== 'true') {
    log.info('Auto-update disabled (set AGENT_AUTO_UPDATE=true to enable in Phase 8+)');
    return;
  }

  try {
    // Lazy import — only loaded when explicitly enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater');
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.on('error', (err: Error) => log.error(`update error: ${err.message}`));
    autoUpdater.on('update-available', (info: any) =>
      log.info(`update available: ${info.version}`),
    );
    autoUpdater.on('update-downloaded', () => {
      log.info('update downloaded — will install on quit');
    });
    void autoUpdater.checkForUpdatesAndNotify();
  } catch (err: any) {
    log.warn(`electron-updater not installed or feed not configured: ${err.message}`);
  }
}
