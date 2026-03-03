import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Role } from '../decorators/role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

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
        RolesGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('public routes', () => {
    it('should allow access when route is marked as public', () => {
      reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY

      const context = createMockExecutionContext();

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      // Should only check IS_PUBLIC_KEY, not ROLES_KEY
      expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1);
    });
  });

  describe('no @Roles decorator', () => {
    it('should allow access when no roles are required (undefined)', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // ROLES_KEY

      const request = { user: { role: Role.LANDOWNER } };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]); // ROLES_KEY - empty array

      const request = { user: { role: Role.LANDOWNER } };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('user role matches required role', () => {
    it('should allow access when user has the exact required role', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([Role.LANDOWNER]); // ROLES_KEY

      const request = { user: { role: Role.LANDOWNER } };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user role is one of multiple required roles', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([Role.ADMIN, Role.SUPERADMIN, Role.LABORATORY]); // ROLES_KEY

      const request = { user: { role: Role.LABORATORY } };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow SUPERADMIN when SUPERADMIN is in required roles', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([Role.SUPERADMIN]); // ROLES_KEY

      const request = { user: { role: Role.SUPERADMIN } };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow ADMIN when ADMIN is in required roles', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([Role.ADMIN, Role.LANDOWNER]); // ROLES_KEY

      const request = { user: { role: Role.ADMIN } };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('user role does not match required role', () => {
    it('should throw ForbiddenException when user role is not in required roles', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY (1st canActivate)
        .mockReturnValueOnce([Role.ADMIN, Role.SUPERADMIN]) // ROLES_KEY (1st canActivate)
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY (2nd canActivate)
        .mockReturnValueOnce([Role.ADMIN, Role.SUPERADMIN]); // ROLES_KEY (2nd canActivate)

      const request = { user: { role: Role.LANDOWNER } };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        /Access denied/,
      );
    });

    it('should include required roles and user role in error message', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([Role.ADMIN]); // ROLES_KEY

      const request = { user: { role: Role.DISTRIBUTOR } };
      const context = createMockExecutionContext(request);

      try {
        guard.canActivate(context);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toContain('ADMIN');
        expect(error.message).toContain('DISTRIBUTOR');
      }
    });

    it('should throw ForbiddenException when LANDOWNER tries to access LABORATORY-only route', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([Role.LABORATORY]);

      const request = { user: { role: Role.LANDOWNER } };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('no user on request', () => {
    it('should throw ForbiddenException when user is undefined', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN])
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN]);

      const request = {}; // no user property
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User role not found');
    });

    it('should throw ForbiddenException when user is null', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN])
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN]);

      const request = { user: null };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User role not found');
    });

    it('should throw ForbiddenException when user exists but has no role', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN])
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN]);

      const request = { user: { email: 'test@example.com' } }; // user without role
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User role not found');
    });

    it('should throw ForbiddenException when user.role is empty string', () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN])
        .mockReturnValueOnce(false).mockReturnValueOnce([Role.ADMIN]);

      const request = { user: { role: '' } };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User role not found');
    });
  });

  describe('reflector metadata resolution', () => {
    it('should check IS_PUBLIC_KEY first, then ROLES_KEY with handler and class', () => {
      const handler = jest.fn();
      const classRef = jest.fn();

      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([Role.LANDOWNER]); // ROLES_KEY

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: Role.LANDOWNER } }),
        }),
        getHandler: () => handler,
        getClass: () => classRef,
      } as unknown as ExecutionContext;

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(1, 'isPublic', [
        handler,
        classRef,
      ]);
      expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(2, 'roles', [
        handler,
        classRef,
      ]);
    });
  });
});
