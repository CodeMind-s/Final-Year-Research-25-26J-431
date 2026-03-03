import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: any; // Use any to avoid stale .d.ts type issues
  let authService: any;

  const mockAuthResponse = {
    accessToken: 'mock-jwt-token',
    isNewUser: false,
    isOnboarded: true,
  };

  const mockSubscription = {
    _id: 'sub1',
    planKey: 'pro',
    status: 'active',
  };

  const mockPlan = {
    key: 'pro',
    name: 'Pro Plan',
    level: 1,
    priceMonthlyLkr: 1500,
    priceAnnualLkr: 15000,
    featureKeys: ['weather_data', 'salinity', 'deals'],
    duration: 'monthly',
    isActive: true,
  };

  beforeEach(async () => {
    const mockAuthService = {
      signIn: jest.fn(),
      signUp: jest.fn(),
      verifyOtp: jest.fn(),
      completeOnboarding: jest.fn(),
      oAuthSignIn: jest.fn(),
      login: jest.fn(),
      createSubscription: jest.fn(),
      getSubscription: jest.fn(),
      getPlans: jest.fn(),
      getPlan: jest.fn(),
      updateSubscription: jest.fn(),
      checkPlanAccess: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      deletePlan: jest.fn(),
      getPersonalDetail: jest.fn(),
      getAllSubscriptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────
  // SignIn
  // ──────────────────────────────────────────────────────────────────
  describe('signIn', () => {
    it('should delegate to authService.signIn', async () => {
      const mockResult = { success: true, user: 'test@example.com' };
      authService.signIn.mockResolvedValue(mockResult);

      const dto = { email: 'test@example.com' } as any;
      const result = await controller.signIn(dto);

      expect(result).toEqual(mockResult);
      expect(authService.signIn).toHaveBeenCalledWith(dto);
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.signIn.mockRejectedValue(new BadRequestException('User not found. Please sign up first'));

      const dto = { email: 'notfound@example.com' } as any;

      try {
        await controller.signIn(dto);
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
        expect(rpcError.message).toContain('User not found');
      }
    });

    it('should wrap other errors as RpcException with code 2', async () => {
      authService.signIn.mockRejectedValue(new Error('Internal error'));

      const dto = { email: 'test@example.com' } as any;

      try {
        await controller.signIn(dto);
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // SignUp
  // ──────────────────────────────────────────────────────────────────
  describe('signUp', () => {
    it('should delegate to authService.signUp', async () => {
      const mockResult = { success: true, user: 'test@example.com' };
      authService.signUp.mockResolvedValue(mockResult);

      const dto = { email: 'test@example.com', role: 'LANDOWNER' };
      const result = await controller.signUp(dto);

      expect(result).toEqual(mockResult);
      expect(authService.signUp).toHaveBeenCalledWith(dto);
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.signUp.mockRejectedValue(new BadRequestException('Email or phone required'));

      await expect(controller.signUp({} as any)).rejects.toThrow(RpcException);

      try {
        await controller.signUp({} as any);
      } catch (error) {
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // VerifyOtp
  // ──────────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    it('should delegate to authService.verifyOtp', async () => {
      authService.verifyOtp.mockResolvedValue(mockAuthResponse);

      const dto = { email: 'test@example.com', code: '123456' };
      const result = await controller.verifyOtp(dto);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.verifyOtp).toHaveBeenCalledWith(dto);
    });

    it('should wrap UnauthorizedException as RpcException with code 16', async () => {
      authService.verifyOtp.mockRejectedValue(new UnauthorizedException('Invalid OTP'));

      try {
        await controller.verifyOtp({ email: 'test@example.com', code: '000000' });
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(16);
      }
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.verifyOtp.mockRejectedValue(new BadRequestException('Email or phone required'));

      try {
        await controller.verifyOtp({ code: '123456' } as any);
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });

    it('should wrap other errors as RpcException with code 2', async () => {
      authService.verifyOtp.mockRejectedValue(new Error('Internal error'));

      try {
        await controller.verifyOtp({ email: 'test@example.com', code: '123456' });
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // CompleteOnboarding
  // ──────────────────────────────────────────────────────────────────
  describe('completeOnboarding', () => {
    it('should delegate to authService.completeOnboarding', async () => {
      const mockResult = { isOnboarded: true };
      authService.completeOnboarding.mockResolvedValue(mockResult);

      const data = { userId: 'user1', name: 'Test', gender: 'male', preferredLanguage: 'English', preferredCurrency: 'LKR' };
      const result = await controller.completeOnboarding(data);

      expect(result).toEqual(mockResult);
      expect(authService.completeOnboarding).toHaveBeenCalledWith('user1', data);
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.completeOnboarding.mockRejectedValue(new BadRequestException('User not found'));

      try {
        await controller.completeOnboarding({ userId: 'bad', name: 'T' } as any);
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // OAuthSignIn
  // ──────────────────────────────────────────────────────────────────
  describe('oAuthSignIn', () => {
    it('should delegate to authService.oAuthSignIn', async () => {
      authService.oAuthSignIn.mockResolvedValue(mockAuthResponse);

      const data = { email: 'oauth@google.com', name: 'OAuth User', providerId: 'g-123', provider: 'google' };
      const result = await controller.oAuthSignIn(data);

      expect(result).toEqual(mockAuthResponse);
      expect(authService.oAuthSignIn).toHaveBeenCalledWith(data);
    });

    it('should wrap errors as RpcException with code 2', async () => {
      authService.oAuthSignIn.mockRejectedValue(new Error('OAuth failed'));

      try {
        await controller.oAuthSignIn({ email: 'a@b.com', name: 'x', providerId: '1', provider: 'google' });
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Login (admin)
  // ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should delegate to authService.login', async () => {
      const mockResult = { token: 'jwt', user: { id: 'u1', email: 'admin@test.com', role: 'ADMIN' } };
      authService.login.mockResolvedValue(mockResult);

      const data = { email: 'admin@test.com', password: 'pass123' };
      const result = await controller.login(data);

      expect(result).toEqual(mockResult);
      expect(authService.login).toHaveBeenCalledWith('admin@test.com', 'pass123');
    });

    it('should wrap UnauthorizedException as RpcException with code 16', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      try {
        await controller.login({ email: 'admin@test.com', password: 'wrong' });
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(16);
      }
    });

    it('should wrap other errors as RpcException with code 2', async () => {
      authService.login.mockRejectedValue(new Error('DB failure'));

      try {
        await controller.login({ email: 'admin@test.com', password: 'pass' });
        fail('Expected RpcException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // CreateSubscription
  // ──────────────────────────────────────────────────────────────────
  describe('createSubscription', () => {
    it('should delegate to authService.createSubscription', async () => {
      const mockResult = { success: true, message: 'Subscription created', subscription: mockSubscription };
      authService.createSubscription.mockResolvedValue(mockResult);

      const data = { userId: 'u1', planKey: 'pro', paymentMethod: 'payhere' };
      const result = await controller.createSubscription(data);

      expect(result).toEqual(mockResult);
      expect(authService.createSubscription).toHaveBeenCalledWith(data);
    });

    it('should wrap errors as RpcException', async () => {
      authService.createSubscription.mockRejectedValue(new Error('Plan not found'));

      await expect(controller.createSubscription({ userId: 'u1', planKey: 'bad' })).rejects.toThrow(RpcException);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GetSubscription
  // ──────────────────────────────────────────────────────────────────
  describe('getSubscription', () => {
    it('should delegate to authService.getSubscription', async () => {
      const mockResult = { success: true, message: 'Subscription fetched', subscription: mockSubscription };
      authService.getSubscription.mockResolvedValue(mockResult);

      const result = await controller.getSubscription({ userId: 'u1' });

      expect(result).toEqual(mockResult);
      expect(authService.getSubscription).toHaveBeenCalledWith('u1');
    });

    it('should wrap errors as RpcException', async () => {
      authService.getSubscription.mockRejectedValue(new BadRequestException('Not found'));

      try {
        await controller.getSubscription({ userId: 'bad' });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GetPlans
  // ──────────────────────────────────────────────────────────────────
  describe('getPlans', () => {
    it('should delegate to authService.getPlans', async () => {
      const mockResult = { success: true, plans: [mockPlan] };
      authService.getPlans.mockResolvedValue(mockResult);

      const result = await controller.getPlans();

      expect(result).toEqual(mockResult);
      expect(authService.getPlans).toHaveBeenCalled();
    });

    it('should wrap errors as RpcException with code 2', async () => {
      authService.getPlans.mockRejectedValue(new Error('DB error'));

      try {
        await controller.getPlans();
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GetPlan
  // ──────────────────────────────────────────────────────────────────
  describe('getPlan', () => {
    it('should delegate to authService.getPlan', async () => {
      const mockResult = { success: true, plan: mockPlan };
      authService.getPlan.mockResolvedValue(mockResult);

      const result = await controller.getPlan({ planKey: 'pro' });

      expect(result).toEqual(mockResult);
      expect(authService.getPlan).toHaveBeenCalledWith('pro');
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.getPlan.mockRejectedValue(new BadRequestException('Plan not found: bad'));

      try {
        await controller.getPlan({ planKey: 'bad' });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // UpdateSubscription
  // ──────────────────────────────────────────────────────────────────
  describe('updateSubscription', () => {
    it('should delegate to authService.updateSubscription', async () => {
      const mockResult = { success: true, message: 'Subscription updated', subscription: mockSubscription };
      authService.updateSubscription.mockResolvedValue(mockResult);

      const data = { userId: 'u1', planKey: 'lab' };
      const result = await controller.updateSubscription(data);

      expect(result).toEqual(mockResult);
      expect(authService.updateSubscription).toHaveBeenCalledWith('u1', 'lab');
    });

    it('should wrap errors as RpcException', async () => {
      authService.updateSubscription.mockRejectedValue(new Error('Failed'));

      await expect(controller.updateSubscription({ userId: 'u1', planKey: 'bad' })).rejects.toThrow(RpcException);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // CheckPlanAccess
  // ──────────────────────────────────────────────────────────────────
  describe('checkPlanAccess', () => {
    it('should delegate to authService.checkPlanAccess', async () => {
      const mockResult = { allowed: true, reason: 'allowed', requiredPlanLevels: [] };
      authService.checkPlanAccess.mockResolvedValue(mockResult);

      const data = { userId: 'u1', requiredPlanLevels: [0, 1] };
      const result = await controller.checkPlanAccess(data);

      expect(result).toEqual(mockResult);
      expect(authService.checkPlanAccess).toHaveBeenCalledWith('u1', [0, 1]);
    });

    it('should wrap errors as RpcException with code 2', async () => {
      authService.checkPlanAccess.mockRejectedValue(new Error('Check failed'));

      try {
        await controller.checkPlanAccess({ userId: 'u1', requiredPlanLevels: [1] });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // CreatePlan
  // ──────────────────────────────────────────────────────────────────
  describe('createPlan', () => {
    it('should delegate to authService.createPlan', async () => {
      const mockResult = { success: true, message: 'Plan created', plan: mockPlan };
      authService.createPlan.mockResolvedValue(mockResult);

      const data = { key: 'enterprise', name: 'Enterprise', level: 3 };
      const result = await controller.createPlan(data);

      expect(result).toEqual(mockResult);
      expect(authService.createPlan).toHaveBeenCalledWith(data);
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.createPlan.mockRejectedValue(new BadRequestException('Plan already exists'));

      try {
        await controller.createPlan({ key: 'pro' });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // UpdatePlan
  // ──────────────────────────────────────────────────────────────────
  describe('updatePlan', () => {
    it('should delegate to authService.updatePlan', async () => {
      const mockResult = { success: true, message: 'Plan updated', plan: mockPlan };
      authService.updatePlan.mockResolvedValue(mockResult);

      const data = { key: 'pro', name: 'Pro Plus' };
      const result = await controller.updatePlan(data);

      expect(result).toEqual(mockResult);
      expect(authService.updatePlan).toHaveBeenCalledWith('pro', data);
    });

    it('should wrap errors as RpcException', async () => {
      authService.updatePlan.mockRejectedValue(new Error('Plan not found'));

      await expect(controller.updatePlan({ key: 'bad' })).rejects.toThrow(RpcException);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // DeletePlan
  // ──────────────────────────────────────────────────────────────────
  describe('deletePlan', () => {
    it('should delegate to authService.deletePlan', async () => {
      const mockResult = { success: true, message: "Plan 'pro' deactivated" };
      authService.deletePlan.mockResolvedValue(mockResult);

      const result = await controller.deletePlan({ key: 'pro' });

      expect(result).toEqual(mockResult);
      expect(authService.deletePlan).toHaveBeenCalledWith('pro');
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.deletePlan.mockRejectedValue(new BadRequestException('Cannot deactivate free'));

      try {
        await controller.deletePlan({ key: 'free' });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GetPersonalDetails
  // ──────────────────────────────────────────────────────────────────
  describe('getPersonalDetail', () => {
    it('should delegate to authService.getPersonalDetail', async () => {
      const mockResult = { success: true, user: { role: 'LANDOWNER' }, landOwnerDetails: {} };
      authService.getPersonalDetail.mockResolvedValue(mockResult);

      const result = await controller.getPersonalDetail({ userId: 'u1' });

      expect(result).toEqual(mockResult);
      expect(authService.getPersonalDetail).toHaveBeenCalledWith('u1');
    });

    it('should wrap BadRequestException as RpcException with code 3', async () => {
      authService.getPersonalDetail.mockRejectedValue(new BadRequestException('User not found'));

      try {
        await controller.getPersonalDetail({ userId: 'bad' });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(3);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // GetAllSubscriptions
  // ──────────────────────────────────────────────────────────────────
  describe('getAllSubscriptions', () => {
    it('should delegate to authService.getAllSubscriptions with defaults', async () => {
      const mockResult = { success: true, subscriptions: [], total: 0, page: 1, limit: 10 };
      authService.getAllSubscriptions.mockResolvedValue(mockResult);

      const result = await controller.getAllSubscriptions({ page: 0, limit: 0 });

      expect(result).toEqual(mockResult);
      // Controller uses page || 1, limit || 10
      expect(authService.getAllSubscriptions).toHaveBeenCalledWith(1, 10);
    });

    it('should pass provided page and limit', async () => {
      const mockResult = { success: true, subscriptions: [], total: 0, page: 2, limit: 5 };
      authService.getAllSubscriptions.mockResolvedValue(mockResult);

      await controller.getAllSubscriptions({ page: 2, limit: 5 });

      expect(authService.getAllSubscriptions).toHaveBeenCalledWith(2, 5);
    });

    it('should wrap errors as RpcException with code 2', async () => {
      authService.getAllSubscriptions.mockRejectedValue(new Error('DB error'));

      try {
        await controller.getAllSubscriptions({ page: 1, limit: 10 });
        fail('Expected RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        const rpcError = (error as RpcException).getError() as any;
        expect(rpcError.code).toBe(2);
      }
    });
  });
});
