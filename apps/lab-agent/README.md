# Brinex Lab Agent

A Windows app that runs Brinex's salt detection model **locally** on your lab
PC, so the camera feed never leaves your network. Detection results sync to
the Brinex cloud over HTTPS.

---

## Install

1. Download the installer from <https://downloads.brinex.com/lab-agent>.
2. Double-click `Brinex-Lab-Agent-Setup.exe` and follow the wizard.
   - **Admin rights required** on first run so the agent can install its
     local TLS certificate into the Windows trust store.
3. After install, look for the Brinex icon in your system tray
   (bottom-right of the taskbar, next to the clock).
4. Open the Brinex web app, log in, and go to **Laboratory → Dashboard**.
   The pill in the top-right should read **"Inference: Local PC"**.

That's it. The agent starts automatically on boot from now on.

---

## What it does

- Receives camera frames from the Brinex web app over a local-only WebSocket
  (`wss://localhost:5005`).
- Runs the YOLOv8 detection model on each frame using your CPU (or GPU if
  available).
- Sends only the **detection results** (counts, purity, classifications) to
  the Brinex cloud — never raw images.
- Buffers up to 500 results offline if your internet drops, then drains the
  queue when connectivity returns.

---

## System requirements

- Windows 10 (build 1903+) or Windows 11
- 8 GB RAM minimum, 16 GB recommended
- 500 MB free disk space
- Local administrator rights for the **first install only**

---

## Troubleshooting

**Browser shows certificate error on `https://localhost:5005`**
The agent's local TLS root wasn't installed. Right-click the tray icon →
**Help → Install Certificate Manually** and follow the steps.

**Tray icon shows "Disconnected"**
The agent's HTTP server didn't start. Right-click the tray icon → **Quit**,
then re-launch from the Start menu. If it still fails, check
`%APPDATA%\Brinex\agent\logs\electron.log`.

**Pill on the dashboard reads "Inference: Offline"**
The web app can't reach the agent. Common causes:
- Agent isn't running (look for the tray icon)
- Antivirus is blocking port 5005 — add an exception
- A different process is already on port 5005 — restart Windows or use
  `netstat -ano | findstr :5005` to identify the conflict.

**Inference is slow**
The agent picks the fastest provider available: CUDA → DirectML → CPU.
- Update your GPU drivers (NVIDIA Studio Driver if you have an NVIDIA card).
- Right-click tray → **View Health Endpoint** and check the `provider:`
  field; if it says `cpu`, the GPU path didn't initialise.

**Sync queue: pending count keeps growing**
Either your internet is down, or the cloud rejected your token. Check the
*Already installed?* link on the dashboard banner. If you've been signed out
of the web app, sign in again — the agent will pick up the new token on the
next reconnect.

---

## Uninstall

**Settings → Apps → Brinex Lab Agent → Uninstall.**

What gets removed:
- The agent application
- The Start Menu shortcut and desktop shortcut
- The local TLS certificate (revoked from the trust store)

What's preserved (delete manually if desired):
- `%APPDATA%\Brinex\agent\logs\` — past activity logs
- `%APPDATA%\Brinex\agent\config.json` — your overrides

---

## Privacy

- The agent forwards detection results (counts, purity scores, batch
  metadata) to the Brinex cloud. **Raw images are never uploaded.**
- All cloud communication uses HTTPS with the same JWT you use to log in.
- Logs are stored locally in `%APPDATA%\Brinex\agent\logs\` and never sent
  anywhere automatically.
- If you suspect a privacy issue, the dashboard's network tab will show
  exactly what the web app is sending — there is no hidden traffic.

---

## Support

Open the tray menu → **View Logs** and email
`logs/electron.log` + a description of the problem to support@brinex.com.
