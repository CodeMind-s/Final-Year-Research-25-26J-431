# Brinex Lab Agent — Build & Package

The Lab Agent ships two ways:

1. **Docker container** (Phase 2-4 dev path) — runs the NestJS server only.
   No tray, no installer. Used during development and CI smoke-tests.
2. **Windows installer** (Phase 5+) — Electron-wrapped `.exe` for end users.
   Includes tray UX, single-instance lock, auto-launch, bundled `best.onnx`.

The Docker path is fully covered by the workspace's existing `docker-compose`
flow. The installer path needs a Windows host with Node.js installed — once.

## Prerequisites for packaging

- Windows 10/11 (or a Windows VM)
- Node.js 20.x
- Either run from the workspace root, or have the workspace's `node_modules`
  installed: `npm ci --legacy-peer-deps`
- A trained model staged at `apps/lab-agent/src/assets/models/best.onnx`
- Tray icons at `apps/lab-agent/electron/assets/tray.png` (16×16 PNG) and
  `apps/lab-agent/electron/assets/tray.ico` (multi-size .ico)
- mkcert binary at `apps/lab-agent/installer/mkcert.exe` (Phase 6).
  See `apps/lab-agent/installer/README.md` for the pinned download URL.

## Producing the installer

```powershell
# From workspace root
npx nx run @brinex-server/lab-agent:package
```

This runs three steps in order:

1. `nx build lab-agent` — webpack-bundles the NestJS server into
   `dist/apps/lab-agent/main.js` (with assets including `best.onnx`).
2. `tsc -p apps/lab-agent/electron/tsconfig.json` — compiles the Electron
   wrapper into `dist/apps/lab-agent/electron/main.js`.
3. `electron-builder --config apps/lab-agent/electron-builder.yml --win` —
   produces `dist/installer/Brinex Lab Agent-Setup-1.0.0.exe`.

## Code signing

Phase 5 produces an **unsigned** installer. SmartScreen will warn on first
launch; that's expected during dev. Phase 8 wires the code-signing
certificate before public distribution.

## Auto-update

Disabled by default in v1. Set `AGENT_AUTO_UPDATE=true` once Phase 8's update
feed is configured.

## Troubleshooting

- *"Cannot find tray.ico"* — drop a real icon at the path above. A 16×16 PNG
  + multi-size ICO works; export from any icon editor.
- *"onnxruntime-node not found at runtime"* — verify `asarUnpack` in
  `electron-builder.yml` covers the install path. Sharp ships per-platform
  binaries under `node_modules/@img/sharp-*` on recent versions; both globs
  are already configured.
- *"Port 5005 in use"* — set `LAB_AGENT_PORT` before launching; the tray
  picks up the env var.
- *"mkcert -install failed"* — the user installed without admin rights or
  on a GPO-locked machine. The agent still serves over HTTPS with an
  untrusted cert; use the tray's *Help → Install Certificate Manually*
  flow to install `agent-cert.pem` into the Trusted Root store.
- *"Browser shows ERR_CERT_AUTHORITY_INVALID"* — root CA hasn't been
  installed yet. Restart the agent (it'll retry `mkcert -install`) or use
  the manual flow above.
