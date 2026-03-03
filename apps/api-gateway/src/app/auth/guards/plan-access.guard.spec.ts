import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { PlanAccessGuard } from './plan-access.guard';

describe('PlanAccessGuard', () => {
  let guard: PlanAccessGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockAuthService: any;
  let mockAuthClient: any;

  const createMockExecutionContext = (request: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  /**
   * Helper to build a TestingModule with or without AUTH_PACKAGE.
   * When withAuthClient is true, a mock ClientGrpcProxy is injected.
   */
  const createTestModule = async (withAuthClient = true) => {
    mockAuthService = {
      CheckPlanAccess: jest.fn(),
    };

    mockAuthClient = withAuthClient
      ? { getService: jest.fn().mockReturnValue(mockAuthService) }
      : null;

    const providers: any[] = [
      PlanAccessGuard,
      {
        provide: Reflector,
        useValue: { getAllAndOverride: jest.fn() },
      },
    ];

    if (withAuthClient) {
      providers.push({
        provide: 'AUTH_PACKAGE',
        useValue: mockAuthClient,
      });
    }

    const module: TestingModule = await Test.createTestingModule({
      providers,
    }).compile();

    guard = module.get<PlanAccessGuard>(PlanAccessGuard);
    reflector = module.get(Reflector);
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('public routes', () => {
    beforeEach(() => createTestModule());

    it('should allow access when route is marked as public', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY

      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('ADMIN and SUPERADMIN bypass', () => {
    beforeEach(() => createTestModule());

    it('should always allow ADMIN regardless of plan requirements', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([1, 2]); // PLAN_LEVELS_KEY

      const request = {
        user: { userId: 'admin-1', role: 'ADMIN', planIndex: 0 },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should always allow SUPERADMIN regardless of plan requirements', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([1, 2]); // PLAN_LEVELS_KEY

      const request = {
        user: { userId: 'superadmin-1', role: 'SUPERADMIN', planIndex: 0 },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('no user on request', () => {
    beforeEach(() => createTestModule());

    it('should allow access when user is not set (JwtAuthGuard handles auth)', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(false); // IS_PUBLIC_KEY

      const request = {}; // no user
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user is undefined', async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(false); // IS_PUBLIC_KEY

      const request = { user: undefined };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('no @RequirePlan decorator', () => {
    beforeEach(() => createTestModule());

    it('should allow access when no plan levels are specified (undefined)', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // PLAN_LEVELS_KEY

      const request = {
        user: { userId: 'user-1', role: 'LANDOWNER', planIndex: 0 },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when plan levels array is empty', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]); // PLAN_LEVELS_KEY - empty

      const request = {
        user: { userId: 'user-1', role: 'LANDOWNER', planIndex: 0 },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('user planIndex in required levels', () => {
    beforeEach(() => createTestModule());

    it('should allow access when user planIndex matches a required level (non-trial)', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([0, 1]); // PLAN_LEVELS_KEY

      const request = {
        user: {
          userId: 'user-1',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: false,
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.CheckPlanAccess).not.toHaveBeenCalled();
    });

    it('should allow free user (planIndex 0) when level 0 is required', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([0]); // PLAN_LEVELS_KEY

      const request = {
        user: {
          userId: 'user-free',
          role: 'LANDOWNER',
          planIndex: 0,
          isTrialActive: false,
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should default planIndex to 0 when not set on user', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([0]); // PLAN_LEVELS_KEY

      const request = {
        user: {
          userId: 'user-no-plan',
          role: 'LANDOWNER',
          // planIndex intentionally omitted
          isTrialActive: false,
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      // planIndex ?? 0 => 0, which is in [0]
      expect(result).toBe(true);
    });
  });

  describe('trial user verification via gRPC fallback', () => {
    beforeEach(() => createTestModule());

    it('should call gRPC CheckPlanAccess when user is on trial and planIndex matches', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([1]); // PLAN_LEVELS_KEY

      mockAuthService.CheckPlanAccess.mockReturnValue(
        of({ allowed: true }),
      );

      const request = {
        user: {
          userId: 'trial-user-1',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: true,
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.CheckPlanAccess).toHaveBeenCalledWith({
        userId: 'trial-user-1',
        requiredPlanLevels: [1],
      });
    });

    it('should throw ForbiddenException when gRPC says trial user not allowed', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([1]);

      mockAuthService.CheckPlanAccess.mockReturnValue(
        of({
          allowed: false,
          reason: 'trial_expired',
          requiredPlanLevels: [1],
        }),
      );

      const request = {
        user: {
          userId: 'expired-trial-user',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: true,
        },
      };
      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should include reason from gRPC response in ForbiddenException', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([2]);

      mockAuthService.CheckPlanAccess.mockReturnValue(
        of({
          allowed: false,
          reason: 'trial_expired',
          requiredPlanLevels: [2],
        }),
      );

      const request = {
        user: {
          userId: 'trial-expired',
          role: 'LABORATORY',
          planIndex: 2,
          isTrialActive: true,
        },
      };
      const context = createMockExecutionContext(request);

      try {
        await guard.canActivate(context);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = error.getResponse();
        expect(response.reason).toBe('trial_expired');
        expect(response.requiredPlanLevels).toEqual([2]);
      }
    });

    it('should use default reason when gRPC response has no reason', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([1]);

      mockAuthService.CheckPlanAccess.mockReturnValue(
        of({ allowed: false }), // no reason, no requiredPlanLevels
      );

      const request = {
        user: {
          userId: 'trial-no-reason',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: true,
        },
      };
      const context = createMockExecutionContext(request);

      try {
        await guard.canActivate(context);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = error.getResponse();
        expect(response.reason).toBe('access_denied');
        expect(response.requiredPlanLevels).toEqual([1]);
      }
    });
  });

  describe('plan not in required levels', () => {
    beforeEach(() => createTestModule());

    it('should throw ForbiddenException with reason when planIndex not in required levels', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([1, 2]); // PLAN_LEVELS_KEY

      const request = {
        user: {
          userId: 'free-user',
          role: 'LANDOWNER',
          planIndex: 0,
          isTrialActive: false,
        },
      };
      const context = createMockExecutionContext(request);

      try {
        await guard.canActivate(context);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = error.getResponse();
        expect(response.reason).toBe('plan_required');
        expect(response.message).toContain('level 0');
        expect(response.requiredPlanLevels).toEqual([1, 2]);
      }
    });

    it('should throw ForbiddenException when pro user tries to access lab-only feature', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([2]); // lab only

      const request = {
        user: {
          userId: 'pro-user',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: false,
        },
      };
      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('gRPC fallback: authService not available (graceful degradation)', () => {
    it('should allow access when AUTH_PACKAGE is not injected', async () => {
      await createTestModule(false); // no auth client

      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([1]); // PLAN_LEVELS_KEY

      const request = {
        user: {
          userId: 'trial-no-grpc',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: true, // triggers grpcFallback
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      // Should gracefully allow when authService is not available
      expect(result).toBe(true);
    });
  });

  describe('gRPC fallback: error handling', () => {
    beforeEach(() => createTestModule());

    it('should throw ForbiddenException when gRPC call throws an error', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([1]);

      mockAuthService.CheckPlanAccess.mockReturnValue(
        throwError(() => new Error('gRPC connection refused')),
      );

      const request = {
        user: {
          userId: 'grpc-error-user',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: true,
        },
      };
      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should re-throw ForbiddenException from catchError without wrapping', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([1]);

      // The catchError in grpcFallback throws ForbiddenException('Unable to verify plan access')
      // Then the outer catch re-throws it since it's already a ForbiddenException
      mockAuthService.CheckPlanAccess.mockReturnValue(
        throwError(() => new Error('Service unavailable')),
      );

      const request = {
        user: {
          userId: 'rethrow-user',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: true,
        },
      };
      const context = createMockExecutionContext(request);

      try {
        await guard.canActivate(context);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe('Unable to verify plan access');
      }
    });
  });

  describe('reflector metadata resolution', () => {
    beforeEach(() => createTestModule());

    it('should check IS_PUBLIC_KEY and PLAN_LEVELS_KEY with handler and class', async () => {
      const handler = jest.fn();
      const classRef = jest.fn();

      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([0, 1]); // PLAN_LEVELS_KEY

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: 'user-1',
              role: 'LANDOWNER',
              planIndex: 0,
              isTrialActive: false,
            },
          }),
        }),
        getHandler: () => handler,
        getClass: () => classRef,
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(
        1,
        'isPublic',
        [handler, classRef],
      );
      expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(
        2,
        'requiredPlanLevels',
        [handler, classRef],
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => createTestModule());

    it('should not call gRPC when planIndex matches but isTrialActive is false', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([1]);

      const request = {
        user: {
          userId: 'non-trial',
          role: 'LANDOWNER',
          planIndex: 1,
          isTrialActive: false,
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.CheckPlanAccess).not.toHaveBeenCalled();
    });

    it('should not call gRPC when planIndex matches but isTrialActive is undefined', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([0]);

      const request = {
        user: {
          userId: 'no-trial-field',
          role: 'LANDOWNER',
          planIndex: 0,
          // isTrialActive not set
        },
      };
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.CheckPlanAccess).not.toHaveBeenCalled();
    });

    it('should deny before checking gRPC when planIndex does not match required levels', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([2]); // lab only

      const request = {
        user: {
          userId: 'wrong-plan-trial',
          role: 'LANDOWNER',
          planIndex: 0,
          isTrialActive: true, // trial but wrong plan
        },
      };
      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      // gRPC should NOT be called because planIndex 0 is not in [2]
      expect(mockAuthService.CheckPlanAccess).not.toHaveBeenCalled();
    });
  });
});
