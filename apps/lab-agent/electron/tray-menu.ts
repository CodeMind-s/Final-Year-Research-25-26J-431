import { Menu, MenuItemConstructorOptions, app, shell, dialog } from 'electron';
import { HealthSnapshot } from './health-poller';

export interface TrayMenuContext {
  agentUrl: string;       // e.g., https://localhost:5005
  webAppUrl: string;      // Brinex web app URL
  logsDir: string;        // %APPDATA%/Brinex/agent/logs
  certsDir: string;       // %APPDATA%/Brinex/agent/certs
  certTrusted: boolean;   // false when mkcert -install failed
  onQuit: () => void;
}

export function buildTrayMenu(snapshot: HealthSnapshot, ctx: TrayMenuContext): Menu {
  const status =
    snapshot.status === 'ok' ? `Connected (${snapshot.connectedClients} client${snapshot.connectedClients === 1 ? '' : 's'})` : 'Agent not responding';

  const items: MenuItemConstructorOptions[] = [
    { label: `Brinex Lab Agent v${snapshot.version ?? '?.?.?'}`, enabled: false },
    { type: 'separator' },
    { label: `Status: ${status}`, enabled: false },
    { label: `Model: ${snapshot.modelLoaded ? 'Loaded' : 'Not loaded'}`, enabled: false },
    { label: `FPS: ${snapshot.fps.toFixed(1)}`, enabled: false },
    { label: `Sync queue: ${snapshot.queuePending} pending`, enabled: false },
  ];

  if (snapshot.queueDropped > 0 || snapshot.queuePermFailures > 0) {
    items.push({
      label: `   ${snapshot.queueDropped} dropped, ${snapshot.queuePermFailures} rejected`,
      enabled: false,
    });
  }

  if (!ctx.certTrusted) {
    items.push({
      label: 'Certificate not installed — browser will warn',
      enabled: false,
    });
  }

  items.push(
    { type: 'separator' },
    {
      label: 'Open Brinex Web App',
      click: () => {
        void shell.openExternal(ctx.webAppUrl);
      },
    },
    {
      label: 'Open Health Endpoint',
      click: () => {
        void shell.openExternal(`${ctx.agentUrl}/health`);
      },
    },
    {
      label: 'View Logs',
      click: () => {
        void shell.openPath(ctx.logsDir);
      },
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Install Certificate Manually',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'Install Brinex certificate',
              message: 'Manual certificate installation',
              detail:
                `1. The certs folder will open shortly.\n` +
                `2. Right-click "agent-cert.pem" → Install Certificate.\n` +
                `3. Choose "Local Machine" → "Place all certificates in the following store".\n` +
                `4. Browse → "Trusted Root Certification Authorities" → OK.\n` +
                `5. Restart your browser.\n\n` +
                `Path: ${ctx.certsDir}`,
              buttons: ['Open certs folder', 'Cancel'],
              defaultId: 0,
              cancelId: 1,
            }).then((res) => {
              if (res.response === 0) void shell.openPath(ctx.certsDir);
            });
          },
        },
        {
          label: 'View Logs Folder',
          click: () => {
            void shell.openPath(ctx.logsDir);
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => ctx.onQuit(),
    },
  );

  return Menu.buildFromTemplate(items);
}

// Re-export so callers can do app.quit() through this module without
// needing a direct electron import.
export { app };
