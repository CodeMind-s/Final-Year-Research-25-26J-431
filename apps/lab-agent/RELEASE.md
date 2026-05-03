# Lab Agent Release Process

End-to-end checklist for cutting a new installer. The clean-VM smoke test
in §4 is the **gate** — no exceptions.

## 1. Pre-flight

- [ ] Version bumped in `apps/lab-agent/package.json`
- [ ] Changelog entry under `apps/lab-agent/CHANGELOG.md` (TODO if missing)
- [ ] All blocking issues closed
- [ ] `best.onnx` staged at `apps/lab-agent/src/assets/models/best.onnx`
- [ ] Tray icons present: `electron/assets/tray.png` + `tray.ico`
- [ ] mkcert binary staged: `installer/mkcert.exe` (see installer/README.md)
- [ ] Code-signing cert available in CI secret store as `WIN_CSC_LINK` +
      `WIN_CSC_KEY_PASSWORD` (or local keystore for manual builds)

## 2. Build + sign

On a Windows host (or Windows runner in CI):

```powershell
# From workspace root
npm ci --legacy-peer-deps

# Builds nest dist + electron wrapper + NSIS installer + signs in one step
npx nx run @brinex-server/lab-agent:package
```

This produces:

```
dist/installer/Brinex Lab Agent-Setup-<version>.exe
dist/installer/Brinex Lab Agent-Setup-<version>.exe.blockmap
dist/installer/latest.yml
```

`electron-builder` runs `signtool` automatically when `WIN_CSC_LINK` is
set. Verify the signature:

```powershell
Get-AuthenticodeSignature .\dist\installer\Brinex*Setup*.exe
# Status should be Valid; SignerCertificate.Subject should be "Brinex (Pvt) Ltd"
```

Generate the SHA-256 alongside:

```powershell
Get-FileHash .\dist\installer\*.exe -Algorithm SHA256 |
  Select-Object Hash,Path |
  Out-File .\dist\installer\Brinex-Lab-Agent-Setup.sha256 -Encoding ASCII
```

## 3. Upload

In order of preference (pick one and stick with it):

1. **Cloudflare R2** at `r2://brinex-downloads/lab-agent/`
   - Upload `.exe`, `.exe.blockmap`, `.sha256`, `latest.yml`
   - Update the `latest` alias to point at the new version
2. **GitHub Release** on the `Final-Year-Research-25-26J-431` repo
   - Tag: `lab-agent-v<version>`
   - Attach all four files
3. **api-gateway** behind a `@Public()` route — only if 1+2 are unavailable

## 4. Clean-VM smoke test (THE GATE)

This is the release gate. Skip it and you ship bugs.

Setup:
- Fresh Windows 11 VM (Hyper-V image; or a clean physical box)
- No Node.js, no dev tools, no Brinex anything
- Internet access

Steps:

- [ ] Visit the download URL → installer downloads cleanly
- [ ] SHA-256 matches the published `.sha256`
- [ ] SmartScreen behavior matches expectations:
  - With EV cert → no warning
  - With standard cert → "More info" → "Run anyway" works once, no
    block thereafter
- [ ] Installer wizard completes without errors
- [ ] Tray icon appears within 10 seconds of install completion
- [ ] Right-click tray → version matches release version
- [ ] Open <https://app.brinex.com> (or staging), log in as a lab user
- [ ] Pill on `/laboratory/dashboard` reads **"Inference: Local PC"**
- [ ] Start Detection → FPS ≥ 5 within 5 seconds
- [ ] Start Batch → batch counter visible
- [ ] End Batch → batch appears in history panel
- [ ] Cloud verification: MongoDB `vision_batches` collection has a row
      with the test user's `userId` and the new `agentVersion`
- [ ] Reboot the VM → agent auto-starts, end-to-end still works
- [ ] Uninstall via Settings → Apps → tray icon gone
- [ ] After uninstall: `Test-NetConnection -ComputerName localhost -Port 5005`
      times out (no leftover service)
- [ ] After uninstall: `%LOCALAPPDATA%\Programs\Brinex Lab Agent\` is gone

If any step fails, **rollback immediately** (see RUNBOOK.md) and file a
release-blocking issue.

## 5. Rollout

- **Stage 1 — Pilot (1 week)**: ship to one lab. Monitor via the lab's
  weekly check-in. If they see the *Inference: Offline* pill more than once
  per shift, halt and investigate.
- **Stage 2 — All labs**: keep the cloud `vision-service` inference path
  live as a server-side fallback for one full release cycle.
- **Stage 3 (post-v1)**: once `vision_sessions` shows agent uptime > 99%
  for 30 consecutive days, file the deprecation ticket for the cloud
  inference path.

## 6. Post-release

- [ ] Update `apps/lab-agent/CHANGELOG.md` with release date
- [ ] Tag git: `lab-agent-v<version>`
- [ ] Notify pilot lab on Slack with installer URL
- [ ] Schedule a check-in at +7 days

## 7. Auto-update (post-v1)

`latest.yml` is published by every release but `electron-updater` is gated
off in v1 via `AGENT_AUTO_UPDATE=false`. To enable post-v1:

1. Verify `latest.yml` URL is reachable from inside lab networks
2. Set `AGENT_AUTO_UPDATE=true` in the next release's NSIS env defaults
3. Roll out as a normal release (Stage 1/2/3)

Once enabled, future releases just need the upload step — installed agents
will fetch and apply automatically.
