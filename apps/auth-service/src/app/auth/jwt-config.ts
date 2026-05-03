import { JwtModuleOptions } from '@nestjs/jwt';
import { createHash, createPublicKey, KeyObject } from 'crypto';

const ISSUER = process.env.JWT_ISSUER || 'brinex-auth';
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || '7d';

// Lazily computed so a missing key doesn't crash module load when we're in HS256 mode.
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

// Returns JwtModule options that sign + verify with whichever algorithm is configured.
// RS256 takes precedence when JWT_PRIVATE_KEY is set; otherwise we fall back to HS256
// using JWT_SECRET (legacy mode). Lab-agent (Phase 4) requires RS256.
export function getJwtModuleOptions(): JwtModuleOptions {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const pub = process.env.JWT_PUBLIC_KEY;

  if (privateKey && pub) {
    const kid = getKid();
    return {
      privateKey: normalizePem(privateKey),
      publicKey: normalizePem(pub),
      signOptions: {
        algorithm: 'RS256',
        expiresIn: ACCESS_TOKEN_TTL,
        issuer: ISSUER,
        ...(kid ? { keyid: kid } : {}),
      },
      verifyOptions: {
        algorithms: ['RS256'],
        issuer: ISSUER,
      },
    };
  }

  return {
    secret: process.env.JWT_SECRET || 'secret',
    signOptions: {
      expiresIn: ACCESS_TOKEN_TTL,
      algorithm: 'HS256',
    },
    verifyOptions: {
      algorithms: ['HS256'],
    },
  };
}
