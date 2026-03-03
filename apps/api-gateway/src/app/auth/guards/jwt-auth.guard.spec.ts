import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;

  const createMockExecutionContext = (request: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get(Reflector);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('public routes', () => {
    it('should allow access when route is marked as public', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });
  });

  describe('valid Bearer token', () => {
    it('should extract payload and attach user to request with all fields', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'LANDOWNER',
        plan: 'pro',
        planIndex: 1,
        isTrialActive: false,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      const request: any = {
        headers: { authorization: 'Bearer valid-token-abc' },
      };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token-abc');
      expect(request.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'LANDOWNER',
        plan: 'pro',
        planIndex: 1,
        isTrialActive: false,
      });
    });

    it('should set isTrialActive from payload when it is true', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const mockPayload = {
        sub: 'user-456',
        email: 'trial@example.com',
        role: 'LABORATORY',
        plan: 'lab',
        planIndex: 2,
        isTrialActive: true,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      const request: any = {
        headers: { authorization: 'Bearer trial-token' },
      };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.user.isTrialActive).toBe(true);
      expect(request.user.planIndex).toBe(2);
    });
  });

  describe('planIndex fallback from PLAN_INDEX_MAP', () => {
    it('should use PLAN_INDEX_MAP when planIndex is not in JWT payload', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const mockPayload = {
        sub: 'user-789',
        email: 'free@example.com',
        role: 'LANDOWNER',
        plan: 'free',
        // planIndex intentionally omitted
        isTrialActive: false,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      const request: any = {
        headers: { authorization: 'Bearer some-token' },
      };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.user.planIndex).toBe(0); // free -> 0
    });

    it('should map "pro" plan to planIndex 1 when planIndex is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockReturnValue({
        sub: 'user-pro',
        email: 'pro@example.com',
        role: 'LANDOWNER',
        plan: 'pro',
        isTrialActive: false,
      });

      const request: any = {
        headers: { authorization: 'Bearer pro-token' },
      };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.user.planIndex).toBe(1); // pro -> 1
    });

    it('should map "lab" plan to planIndex 2 when planIndex is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockReturnValue({
        sub: 'user-lab',
        email: 'lab@example.com',
        role: 'LABORATORY',
        plan: 'lab',
        isTrialActive: false,
      });

      const request: any = {
        headers: { authorization: 'Bearer lab-token' },
      };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.user.planIndex).toBe(2); // lab -> 2
    });

    it('should default to 0 when planIndex is undefined and plan is unknown', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockReturnValue({
        sub: 'user-unknown',
        email: 'unknown@example.com',
        role: 'LANDOWNER',
        plan: 'enterprise',
        isTrialActive: false,
      });

      const request: any = {
        headers: { authorization: 'Bearer unknown-token' },
      };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.user.planIndex).toBe(0); // unknown plan -> fallback 0
    });

    it('should use planIndex from payload when it is explicitly 0', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockReturnValue({
        sub: 'user-explicit-zero',
        email: 'zero@example.com',
        role: 'LANDOWNER',
        plan: 'pro',
        planIndex: 0,
        isTrialActive: false,
      });

      const request: any = {
        headers: { authorization: 'Bearer zero-token' },
      };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      // planIndex 0 is falsy but not nullish, so ?? does not trigger
      expect(request.user.planIndex).toBe(0);
    });
  });

  describe('no Authorization header', () => {
    it('should throw UnauthorizedException when no Authorization header is present', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request: any = { headers: {} };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('No token provided');
    });

    it('should throw UnauthorizedException when Authorization header is undefined', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request: any = { headers: { authorization: undefined } };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('non-Bearer scheme', () => {
    it('should throw UnauthorizedException when using Basic auth scheme', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request: any = {
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('No token provided');
    });

    it('should throw UnauthorizedException when scheme is lowercase "bearer"', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request: any = {
        headers: { authorization: 'bearer some-token' },
      };
      const context = createMockExecutionContext(request);

      // The guard checks for exact 'Bearer' (case-sensitive)
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when only token without scheme is provided', () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const request: any = {
        headers: { authorization: 'some-token-without-scheme' },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('expired or invalid token', () => {
    it('should throw UnauthorizedException when token is expired', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const request: any = {
        headers: { authorization: 'Bearer expired-token' },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when token signature is invalid', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const request: any = {
        headers: { authorization: 'Bearer tampered-token' },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when token is malformed', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      const request: any = {
        headers: { authorization: 'Bearer not.a.valid.jwt' },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('reflector metadata resolution', () => {
    it('should check IS_PUBLIC_KEY with handler and class', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const handler = jest.fn();
      const classRef = jest.fn();

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
        getHandler: () => handler,
        getClass: () => classRef,
      } as unknown as ExecutionContext;

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        handler,
        classRef,
      ]);
    });
  });
});
