// First-run + renewal logic for the localhost HTTPS cert.
//
// Strategy:
//   1. If <certDir>/agent-cert.pem exists and isn't within 30 days of expiry,
//      reuse it.
//   2. Else run mkcert: install the local CA into the Windows trust store
//      (admin rights), then issue a cert for localhost / 127.0.0.1 / ::1.
//   3. If `mkcert -install` fails (GPO-locked, non-admin), still generate the
//      cert (it will be untrusted by browsers — surface a notification so the
//      user can install it manually). The agent still serves over HTTPS,
//      satisfying the wss-from-https-origin requirement once the user accepts
//      the warning or installs the cert by hand.
//
// The bundled mkcert binary lives under Electron's resources dir
// (electron-builder copies it from apps/lab-agent/installer/mkcert.exe via
// extraResources). In dev runs (`electron .`), process.resourcesPath points at
// node_modules/electron/dist/resources/, so we accept an env override.

import { execFile } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { promisify } from 'util';
import { join } from 'path';
import { X509Certificate } from 'crypto';
import { Logger } from './logger';

const exec = promisify(execFile);
const log = new Logger('CertBootstrap');

export interface CertResult {
  key: string;
  cert: string;
  trusted: boolean;     // true if `mkcert -install` succeeded this session or earlier
  regenerated: boolean; // true if we re-issued during this call
}

const RENEWAL_THRESHOLD_DAYS = 30;
const KEY_FILE = 'agent-key.pem';
const CRT_FILE = 'agent-cert.pem';
const TRUST_MARKER = '.mkcert-installed';

export async function ensureCert(certDir: string): Promise<CertResult> {
  await mkdir(certDir, { recursive: true });

  const keyPath = join(certDir, KEY_FILE);
  const crtPath = join(certDir, CRT_FILE);
  const trustMarkerPath = join(certDir, TRUST_MARKER);

  const reuseable = canReuse(crtPath, keyPath);
  if (reuseable) {
    log.info(`Reusing existing cert at ${crtPath}`);
    return {
      key: keyPath,
      cert: crtPath,
      trusted: existsSync(trustMarkerPath),
      regenerated: false,
    };
  }

  const mkcertBin = resolveMkcertBinary();
  if (!mkcertBin) {
    log.warn('mkcert.exe not found — skipping HTTPS cert generation. Agent will run over HTTP.');
    return { key: keyPath, cert: crtPath, trusted: false, regenerated: false };
  }

  // Install the mkcert root CA into the Windows trust store. Idempotent —
  // mkcert detects an existing root and exits 0.
  let trustInstalled = false;
  try {
    await exec(mkcertBin, ['-install']);
    trustInstalled = true;
    // Drop a marker so subsequent launches can render the tray correctly
    // without re-running -install (which is fast, but noisy in logs).
    try {
      await writeFile(trustMarkerPath, new Date().toISOString());
    } catch { /* non-fatal */ }
  } catch (err: any) {
    log.warn(
      `mkcert -install failed (likely no admin rights): ${err.message}. ` +
        `Will generate cert anyway; user must install it manually for browser trust.`,
    );
  }

  try {
    await exec(mkcertBin, [
      '-key-file', keyPath,
      '-cert-file', crtPath,
      'localhost',
      '127.0.0.1',
      '::1',
    ]);
    log.info(`Issued localhost cert at ${crtPath}`);
  } catch (err: any) {
    log.error(`mkcert cert issuance failed: ${err.message}`);
    return { key: keyPath, cert: crtPath, trusted: false, regenerated: false };
  }

  return {
    key: keyPath,
    cert: crtPath,
    trusted: trustInstalled,
    regenerated: true,
  };
}

function canReuse(crtPath: string, keyPath: string): boolean {
  if (!existsSync(crtPath) || !existsSync(keyPath)) return false;
  try {
    const cert = new X509Certificate(readFileSync(crtPath));
    const expiresAt = new Date(cert.validTo).getTime();
    const daysLeft = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < RENEWAL_THRESHOLD_DAYS) {
      log.info(`Existing cert expires in ${daysLeft.toFixed(0)} days — regenerating.`);
      return false;
    }
    return true;
  } catch (err: any) {
    log.warn(`Failed to parse existing cert (${err.message}) — regenerating.`);
    return false;
  }
}

function resolveMkcertBinary(): string | null {
  // Allow dev override: useful when running `electron .` from source where
  // process.resourcesPath points into node_modules/electron/dist.
  if (process.env.MKCERT_BIN && existsSync(process.env.MKCERT_BIN)) {
    return process.env.MKCERT_BIN;
  }
  if (process.resourcesPath) {
    const bundled = join(process.resourcesPath, 'mkcert.exe');
    if (existsSync(bundled)) return bundled;
  }
  return null;
}
