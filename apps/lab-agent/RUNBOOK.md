# Lab Agent Runbook (internal)

Operational reference for engineers shipping and supporting the Brinex Lab
Agent. **Not bundled with the installer** — keep this in the repo.

## Architecture quick-ref

```
Browser  ─wss─>  Lab Agent (this PC, :5005)  ─https─>  Cloud (api-gateway)
                       │
                       └─ ONNX inference (best.onnx, in-process)
```

- Token: cloud issues, agent verifies via JWKS at `/api/v1/auth/jwks`
- HTTPS cert: mkcert root, Windows trust store
- Cloud sync queue: in-memory FIFO, max 500, exponential backoff 2s→30s

## Where things live (on a user's PC)

| Path | Purpose |
|------|---------|
| `%LOCALAPPDATA%\Programs\Brinex Lab Agent\` | Installed app |
| `%APPDATA%\Brinex\agent\logs\` | electron.log + nest.log |
| `%APPDATA%\Brinex\agent\certs\` | agent-cert.pem, agent-key.pem |
| `%APPDATA%\Brinex\agent\config.json` | Cloud URL override, telemetry opt-in |

## Reading logs

```powershell
# Most useful first
Get-Content $env:APPDATA\Brinex\agent\logs\electron.log -Tail 200

# Full NestJS log
Get-Content $env:APPDATA\Brinex\agent\logs\nest.log -Tail 500
```

What to look for, by symptom:

| Symptom | Search for | Means |
|---------|-----------|-------|
| Tray says "Agent not responding" | `Bootstrap` | NestJS startup error |
| Pill shows "Inference: Offline" | `EADDRINUSE` | Port 5005 conflict |
| `connect_error` toast on dashboard | `JWKS` | Token verification failed |
| Sync queue growing | `cloudSync` | Cloud unreachable or auth expired |
| Browser cert warning | `mkcert` | Trust store install failed (admin?) |

## Rolling back a bad release

The frontend banner points at `/downloads/lab-agent` which redirects to the
latest installer. To roll back:

1. Re-tag the previous installer in the bucket as `latest`.
2. Update the redirect target in `next.config.ts` (or wherever the redirect
   is configured) and re-deploy.
3. Update `latest.yml` to advertise the older version (post-v1, when
   `electron-updater` is enabled, this is the entire roll-back).
4. Add a release note explaining what regressed and the workaround for
   users already on the bad version.

**Do not** silently overwrite the same installer URL — users who already
downloaded the bad version need to know to re-download.

## Cert renewal failures

mkcert certs last ~2 years. Renewal is automatic at startup if `notAfter` is
within 30 days (`cert-bootstrap.ts`). If it fails:

1. User sees Notification: *"certificate needs manual install"*
2. Tray menu offers manual flow
3. Worst case: user opens the agent on a non-admin account, the agent still
   serves over HTTPS but the browser warns. They click through once and it
   works.

If many users hit this in the same week, the most likely cause is:
- A Windows update changed trust store rules
- Antivirus is silently revoking the mkcert root

Escalate via on-call. The fix is usually pushing a new installer with a
re-issued root, or adding the AV product to the install-time exception list.

## Telemetry

The agent's `/health` endpoint returns:
```json
{
  "status": "ok", "model": true, "version": "1.0.0",
  "metrics": { "fps": 14.2, "connectedClients": 1, "uptimeSeconds": 3600 },
  "cloudSync": { "pending": 0, "droppedOnOverflow": 0, "permanentFailures": 0 }
}
```

There's no central telemetry pipeline in v1. Pilot lab feedback comes from:
- The lab user reporting issues via the tray menu's *View Logs* flow
- The cloud `vision_sessions` collection — if `agentVersion` is populated,
  the agent reached the cloud successfully

Post-v1, wire `/health` into a Prometheus pull job inside the lab network.

## On-call escalation

- **Single user, install issue**: support email, `<24h` response.
- **Multiple users in one lab**: page network/IT contact for that lab,
  same-business-day.
- **Multiple labs, same symptom**: page the on-call engineer immediately —
  this is a release regression. Initiate rollback (above).
- **Cert chain breakage**: same as multiple-labs — page on-call.

## Release checklist

See `RELEASE.md`. The clean-VM smoke test is the gate; no exceptions.
