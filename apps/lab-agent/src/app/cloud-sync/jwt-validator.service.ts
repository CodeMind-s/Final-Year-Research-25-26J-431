import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const ROLE_LABORATORY = 'LABORATORY';
const MIN_PLAN_INDEX = 2;

export interface VerifiedLabClaims {
  sub: string;
  role: string;
  plan?: string;
  planIndex?: number;
  email?: string;
}

@Injectable()
export class JwtValidatorService implements OnModuleInit {
  private readonly logger = new Logger(JwtValidatorService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private rejectedCount = 0;

  onModuleInit() {
    const baseUrl = process.env.BRINEX_CLOUD_URL || 'http://localhost:3400/api/v1';
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/auth/jwks`);
    this.jwks = createRemoteJWKSet(url, {
      cooldownDuration: parseInt(process.env.JWKS_COOLDOWN_MS || `${24 * 60 * 60 * 1000}`, 10),
      cacheMaxAge: parseInt(process.env.JWKS_CACHE_MAX_AGE_MS || `${10 * 60 * 1000}`, 10),
    });
    this.logger.log(`JWT validator targeting JWKS at ${url}`);
  }

  async verify(token: string): Promise<VerifiedLabClaims> {
    if (!token || typeof token !== 'string') {
      this.recordReject('missing_token');
      throw new UnauthorizedException('Auth token required');
    }
    if (!this.jwks) {
      throw new UnauthorizedException('JWT validator not initialized');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: process.env.JWT_ISSUER || 'brinex-auth',
        algorithms: ['RS256'],
      });
      return this.assertLabClaims(payload);
    } catch (err: any) {
      this.recordReject(err?.code || err?.name || 'verify_failed');
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  rejectedSinceStart(): number {
    return this.rejectedCount;
  }

  private assertLabClaims(payload: JWTPayload): VerifiedLabClaims {
    const role = (payload.role as string | undefined)?.toUpperCase();
    if (role !== ROLE_LABORATORY) {
      this.recordReject('wrong_role');
      throw new UnauthorizedException('Lab agent requires a LABORATORY token');
    }

    const planIndex = this.derivePlanIndex(payload);
    if (planIndex < MIN_PLAN_INDEX) {
      this.recordReject('insufficient_plan');
      throw new UnauthorizedException('Lab plan required (planIndex >= 2)');
    }

    if (!payload.sub) {
      this.recordReject('missing_sub');
      throw new UnauthorizedException('Token missing sub claim');
    }

    return {
      sub: payload.sub,
      role,
      plan: payload.plan as string | undefined,
      planIndex,
      email: payload.email as string | undefined,
    };
  }

  private derivePlanIndex(payload: JWTPayload): number {
    if (typeof payload.planIndex === 'number') return payload.planIndex;
    const plan = (payload.plan as string | undefined)?.toLowerCase();
    if (plan === 'lab') return 2;
    if (plan === 'pro') return 1;
    if (plan === 'free') return 0;
    return 0;
  }

  private recordReject(reason: string) {
    this.rejectedCount += 1;
    this.logger.warn(`JWT rejected (${reason}) — total rejections: ${this.rejectedCount}`);
  }
}
