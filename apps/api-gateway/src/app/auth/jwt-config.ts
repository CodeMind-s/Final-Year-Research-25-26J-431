import { JwtModuleOptions } from '@nestjs/jwt';
import { createHash, createPublicKey, KeyObject } from 'crypto';

const ISSUER = process.env.JWT_ISSUER || 'brinex-auth';

let cachedKid: string | null = null;
let cachedPublicJwk: Record<string, unknown> | null = null;

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function publicKey(): KeyObject | null {
  const pub = process.env.JWT_PUBLIC_KEY;
  if (!pub) return null;
  return createPublicKey(normalizePem(pub));
}

export function getKid(): string | null {
  if (cachedKid !== null) return cachedKid;
  const key = publicKey();
  if (!key) return null;
  const der = key.export({ type: 'spki', format: 'der' });
  cachedKid = createHash('sha256').update(der).digest('hex').slice(0, 16);
  return cachedKid;
}

export function getJwks(): { keys: Record<string, unknown>[] } {
  if (cachedPublicJwk) return { keys: [cachedPublicJwk] };
  const key = publicKey();
  if (!key) return { keys: [] };

  const jwk = key.export({ format: 'jwk' }) as Record<string, unknown>;
  jwk.kid = getKid();
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  cachedPublicJwk = jwk;
  return { keys: [jwk] };
}

// Verify-only JwtModule options: api-gateway never signs tokens, only checks them.
// In RS256 mode (JWT_PUBLIC_KEY present) we accept only RS256 + matching issuer.
// In HS256 mode (legacy) we keep the shared-secret behavior unchanged.
export function getJwtVerifyOptions(): JwtModuleOptions {
  const pub = process.env.JWT_PUBLIC_KEY;
  if (pub) {
    return {
      publicKey: normalizePem(pub),
      verifyOptions: {
        algorithms: ['RS256'],
        issuer: ISSUER,
      },
    };
  }
  return {
    secret: process.env.JWT_SECRET || 'secret',
    verifyOptions: {
      algorithms: ['HS256'],
    },
  };
}

// For places that historically read JWT_SECRET directly (e.g., passport strategies).
// Returns either { type: 'public', publicKey, algorithms } or { type: 'secret', secret, algorithms }.
export function getVerifierMaterial():
  | { type: 'public'; publicKey: string; algorithms: string[] }
  | { type: 'secret'; secret: string; algorithms: string[] } {
  const pub = process.env.JWT_PUBLIC_KEY;
  if (pub) {
    return { type: 'public', publicKey: normalizePem(pub), algorithms: ['RS256'] };
  }
  return {
    type: 'secret',
    secret: process.env.JWT_SECRET || 'secret',
    algorithms: ['HS256'],
  };
}
