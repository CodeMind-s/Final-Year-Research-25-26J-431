# Dev certs (gitignored)

For local `npx nx serve lab-agent` runs without going through the Electron
wrapper. Drop a key + cert here and point the env vars at them:

```
AGENT_CERT_KEY=apps/lab-agent/dev-certs/agent-key.pem
AGENT_CERT_CRT=apps/lab-agent/dev-certs/agent-cert.pem
```

Generate with mkcert (after running `mkcert -install` once):

```powershell
mkcert -key-file apps/lab-agent/dev-certs/agent-key.pem `
       -cert-file apps/lab-agent/dev-certs/agent-cert.pem `
       localhost 127.0.0.1 ::1
```

For Electron-launched runs, the wrapper handles everything automatically
under `%APPDATA%/Brinex/agent/certs/` — you don't need anything in this
folder.
