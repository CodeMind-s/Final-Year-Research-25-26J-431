# Lab Agent installer assets

Binaries that get bundled with the Windows installer via
`extraResources` in `electron-builder.yml`.

## mkcert.exe

Used by the Electron entry on first launch to:

1. Install a local CA into the Windows trust store (`mkcert -install`).
2. Issue a cert for `localhost` / `127.0.0.1` / `::1`.

### How to obtain

Download the pinned release from the official mkcert repo:

- Version: **v1.4.4**
- File: `mkcert-v1.4.4-windows-amd64.exe`
- URL: <https://github.com/FiloSottile/mkcert/releases/tag/v1.4.4>

Rename to `mkcert.exe` and place at:

```
apps/lab-agent/installer/mkcert.exe
```

Verify the SHA-256 (from the release page) before committing or staging.

### Why pinned

mkcert generates a per-machine root CA. If we silently bumped versions
across releases we could end up reissuing roots on already-installed
machines, which would briefly break browser trust. Lock the version and
treat upgrades as an explicit migration.

### Why not download in CI

The packaging step runs on a Windows host; relying on a network fetch at
package time means the installer build fails when GitHub is rate-limiting
or blocked by a corporate firewall. Committing the binary (or pulling it
from internal artifact storage) makes the build hermetic.

## Files in this directory

```
apps/lab-agent/installer/
├── README.md         (this file)
└── mkcert.exe        (NOT committed — fetch per the URL above)
```
