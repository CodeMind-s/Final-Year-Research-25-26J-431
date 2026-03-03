import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription/subscription.service';
import axios from 'axios';
import * as bcrypt from 'bcrypt';

// Mock external libraries at the top level
jest.mock('axios');
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  let service: any; // Use any to avoid stale .d.ts type issues
  let userModel: any;
  let landOwnerModel: any;
  let serviceProviderModel: any;
  let laboratoryModel: any;
  let emailClient: any;
  let auditLogClient: any;
  let jwtService: any;
  let subscriptionService: any;

  const mockUserId = '507f1f77bcf86cd799439011';

  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    phone: '+94771234567',
    role: 'LANDOWNER',
    isOnboarded: false,
    plan: 'pro',
    isSubscribed: false,
    isVerified: false,
    isTrialActive: true,
    password: 'hashedPassword123',
    linkedAccounts: {},
    save: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlanDoc = {
    key: 'pro',
    name: 'Pro Plan',
    level: 1,
    priceMonthlyLKR: 1500,
    priceAnnualLKR: 15000,
    featureKeys: ['weather_data', 'salinity', 'deals'],
    duration: 'monthly',
    isActive: true,
  };

  const mockLandOwnerDetails = {
    _id: '507f1f77bcf86cd799439012',
    userId: mockUserId,
    docUrls: ['http://example.com/doc1.pdf'],
    totalBeds: 100,
    nic: '123456789V',
    address: '123 Main St',
  };

  const mockServiceProviderDetails = {
    _id: '507f1f77bcf86cd799439013',
    userId: mockUserId,
    docUrls: ['http://example.com/doc1.pdf'],
    companyName: 'Test Company',
    registrationNumber: 'REG123',
    address: '456 Business St',
  };

  const mockLaboratoryDetails = {
    _id: '507f1f77bcf86cd799439014',
    userId: mockUserId,
    docUrls: ['http://example.com/doc1.pdf'],
    laboratoryName: 'Test Lab',
    registrationNumber: 'LAB123',
    address: '789 Lab Ave',
  };

  const createMockQuery = (data: any) => {
    const query: any = {
      exec: jest.fn().mockResolvedValue(data),
      select: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn(),
      populate: jest.fn(),
      then: function (resolve: any, reject: any) {
        return Promise.resolve(data).then(resolve, reject);
      },
    };
    query.select.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    query.populate.mockReturnValue(query);
    return query;
  };

  const createMockModel = (mockData: any = null) => {
    const model = jest.fn().mockImplementation((data) => ({
      ...data,
      _id: mockUserId,
      save: jest.fn().mockResolvedValue({ ...data, _id: mockUserId }),
    }));

    Object.assign(model, {
      findOne: jest.fn().mockReturnValue(createMockQuery(mockData)),
      findById: jest.fn().mockReturnValue(createMockQuery(mockData)),
      findByIdAndUpdate: jest.fn().mockReturnValue(createMockQuery(mockData)),
      findOneAndUpdate: jest.fn().mockReturnValue(createMockQuery(mockData)),
      find: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockData]),
          }),
        }),
      }),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      }),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    });

    return model;
  };

  const createMockKafkaClient = () => ({
    emit: jest.fn().mockReturnValue({
      toPromise: jest.fn().mockResolvedValue(true),
    }),
  });

  beforeEach(async () => {
    userModel = createMockModel(mockUser);
    landOwnerModel = createMockModel(mockLandOwnerDetails);
    serviceProviderModel = createMockModel(mockServiceProviderDetails);
    laboratoryModel = createMockModel(mockLaboratoryDetails);
    emailClient = createMockKafkaClient();
    auditLogClient = createMockKafkaClient();

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    subscriptionService = {
      startProTrial: jest.fn().mockResolvedValue({}),
      getPlan: jest.fn().mockResolvedValue(mockPlanDoc),
      getPlans: jest.fn().mockResolvedValue([mockPlanDoc]),
      createSubscription: jest.fn().mockResolvedValue({ _id: 'sub1', planKey: 'pro', status: 'active' }),
      getActiveSubscription: jest.fn().mockResolvedValue({ _id: 'sub1', planKey: 'pro', status: 'active' }),
      checkPlanAccess: jest.fn().mockResolvedValue({ allowed: true, reason: 'allowed', requiredPlanLevels: [] }),
      createPlan: jest.fn().mockResolvedValue(mockPlanDoc),
      updatePlan: jest.fn().mockResolvedValue(mockPlanDoc),
      deletePlan: jest.fn().mockResolvedValue(undefined),
      getAllSubscriptions: jest.fn().mockResolvedValue({
        subscriptions: [{
          _id: 'sub1',
          userId: mockUserId,
          planId: 'plan1',
          planKey: 'pro',
          status: 'active',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-01'),
          isTrial: false,
          paymentMethod: 'payhere',
        }],
        total: 1,
        page: 1,
        limit: 10,
      }),
    };

    // Set env vars for Notify.lk
    process.env.NOTIFY_LK_USER_ID = 'test-user-id';
    process.env.NOTIFY_LK_API_KEY = 'test-api-key';
    process.env.NOTIFY_LK_SENDER_ID = 'BrinexTest';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken('User'), useValue: userModel },
        { provide: getModelToken('LandOwnerDetails'), useValue: landOwnerModel },
        { provide: getModelToken('ServiceProviderDetails'), useValue: serviceProviderModel },
        { provide: getModelToken('LaboratoryDetails'), useValue: laboratoryModel },
        { provide: 'EMAIL_SERVICE', useValue: emailClient },
        { provide: 'AUDIT_LOG_SERVICE', useValue: auditLogClient },
        { provide: JwtService, useValue: jwtService },
        { provide: SubscriptionService, useValue: subscriptionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────
  // signUp
  // ──────────────────────────────────────────────────────────────────
  describe('signUp', () => {
    it('should send OTP via email and return success', async () => {
      const dto = { email: 'test@example.com', role: 'LANDOWNER' };

      const result = await service.signUp(dto);

      expect(result.success).toBe(true);
      expect(result.user).toBe('test@example.com');
      expect(emailClient.emit).toHaveBeenCalledWith('send_verification_code_email', expect.objectContaining({
        user: { email: 'test@example.com' },
      }));
    });

    it('should send OTP via SMS for phone signUp', async () => {
      mockedAxios.post.mockResolvedValue({ data: { status: 'success' } });

      const dto = { phone: '+94771234567', role: 'LANDOWNER' };

      const result = await service.signUp(dto);

      expect(result.success).toBe(true);
      expect(result.user).toBe('+94771234567');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/send'),
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            to: '94771234567',
          }),
        }),
      );
    });

    it('should throw BadRequestException when no email or phone provided', async () => {
      const dto = { role: 'LANDOWNER' } as any;

      await expect(service.signUp(dto)).rejects.toThrow(BadRequestException);
    });

    it('should emit audit log on successful email OTP send', async () => {
      const dto = { email: 'test@example.com', role: 'LANDOWNER' };

      await service.signUp(dto);

      expect(auditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'SIGN_UP_OTP_SENT',
          serviceName: 'auth-service',
          status: 'success',
        }),
      );
    });

    it('should emit audit log on failed signUp', async () => {
      // Make emailClient.emit throw an error
      emailClient.emit.mockReturnValue({
        toPromise: jest.fn().mockRejectedValue(new Error('Kafka failure')),
      });

      const dto = { email: 'test@example.com', role: 'LANDOWNER' };

      await expect(service.signUp(dto)).rejects.toThrow(InternalServerErrorException);

      // The audit log for failure should still be attempted
      expect(auditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'SIGN_UP_FAILED',
          status: 'error',
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // signIn
  // ──────────────────────────────────────────────────────────────────
  describe('signIn', () => {
    it('should send OTP to existing user via email', async () => {
      const dto = { email: 'test@example.com' } as any;

      const result = await service.signIn(dto);

      expect(result.success).toBe(true);
      expect(result.user).toBe('test@example.com');
      expect(emailClient.emit).toHaveBeenCalledWith('send_verification_code_email', expect.objectContaining({
        user: { email: 'test@example.com' },
      }));
    });

    it('should throw BadRequestException when user not found', async () => {
      userModel.findOne.mockReturnValue(createMockQuery(null));

      const dto = { email: 'notfound@example.com' } as any;

      await expect(service.signIn(dto)).rejects.toThrow(BadRequestException);
      await expect(service.signIn(dto)).rejects.toThrow('User not found. Please sign up first');
    });

    it('should throw BadRequestException when no identifier provided', async () => {
      const dto = {} as any;

      await expect(service.signIn(dto)).rejects.toThrow(BadRequestException);
    });

    it('should send OTP via SMS for existing user with phone', async () => {
      mockedAxios.post.mockResolvedValue({ data: { status: 'success' } });

      const phoneUser = { ...mockUser, phone: '+94771234567', role: 'LANDOWNER' };
      userModel.findOne.mockReturnValue(createMockQuery(phoneUser));

      const dto = { phone: '+94771234567' } as any;

      const result = await service.signIn(dto);

      expect(result.success).toBe(true);
      expect(result.user).toBe('+94771234567');
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // verifyOtp
  // ──────────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    it('should create a new user and return JWT when OTP is valid for new user', async () => {
      // First, trigger signUp to populate the OTP store
      await service.signUp({ email: 'new@example.com', role: 'LANDOWNER' });

      // Extract the OTP code from the emailClient.emit call
      const emailEmitCall = emailClient.emit.mock.calls[0];
      const otpCode = emailEmitCall[1].code;

      // findOne returns null (new user)
      userModel.findOne.mockReturnValue(createMockQuery(null));

      // The model constructor returns a saveable instance
      const savedUser = {
        _id: mockUserId,
        email: 'new@example.com',
        role: 'LANDOWNER',
        isOnboarded: false,
        plan: 'free',
        isSubscribed: false,
        isVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.mockImplementation(() => savedUser);

      // findById after save returns user with updated plan
      const updatedUser = {
        ...savedUser,
        plan: 'pro',
        isTrialActive: true,
      };
      userModel.findById.mockReturnValue(createMockQuery(updatedUser));

      const result = await service.verifyOtp({
        email: 'new@example.com',
        code: otpCode,
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.isNewUser).toBe(true);
      expect(result.isOnboarded).toBe(false);
      expect(subscriptionService.startProTrial).toHaveBeenCalledWith(mockUserId);
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
        sub: mockUserId,
        email: 'new@example.com',
        role: 'LANDOWNER',
      }));
    });

    it('should return JWT for existing user when OTP is valid', async () => {
      // Trigger signUp to populate OTP store
      await service.signUp({ email: 'test@example.com', role: 'LANDOWNER' });

      const emailEmitCall = emailClient.emit.mock.calls[0];
      const otpCode = emailEmitCall[1].code;

      // findOne returns existing user
      userModel.findOne.mockReturnValue(createMockQuery(mockUser));

      const result = await service.verifyOtp({
        email: 'test@example.com',
        code: otpCode,
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.isNewUser).toBe(false);
      expect(result.isOnboarded).toBe(false);
      // Should not start trial for existing user
      expect(subscriptionService.startProTrial).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired/not-found OTP', async () => {
      const dto = { email: 'unknown@example.com', code: '123456' };

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid OTP code', async () => {
      // Trigger signUp to populate OTP store
      await service.signUp({ email: 'test@example.com', role: 'LANDOWNER' });

      const dto = { email: 'test@example.com', code: '000000' };

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should skip trial for LABORATORY role', async () => {
      // Trigger signUp with LABORATORY role
      await service.signUp({ email: 'lab@example.com', role: 'LABORATORY' });

      const emailEmitCall = emailClient.emit.mock.calls[0];
      const otpCode = emailEmitCall[1].code;

      // findOne returns null (new user)
      userModel.findOne.mockReturnValue(createMockQuery(null));

      const savedLabUser = {
        _id: mockUserId,
        email: 'lab@example.com',
        role: 'LABORATORY',
        isOnboarded: false,
        plan: 'free',
        isSubscribed: false,
        isVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.mockImplementation(() => savedLabUser);

      userModel.findById.mockReturnValue(createMockQuery(savedLabUser));

      subscriptionService.getPlan.mockResolvedValue({ key: 'free', level: 0 });

      const result = await service.verifyOtp({
        email: 'lab@example.com',
        code: otpCode,
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.isNewUser).toBe(true);
      // startProTrial should NOT be called for LABORATORY
      expect(subscriptionService.startProTrial).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when no identifier provided', async () => {
      const dto = { code: '123456' } as any;

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // completeOnboarding
  // ──────────────────────────────────────────────────────────────────
  describe('completeOnboarding', () => {
    it('should set isOnboarded to true', async () => {
      const onboardedUser = { ...mockUser, isOnboarded: true };
      userModel.findByIdAndUpdate.mockReturnValue(createMockQuery(onboardedUser));

      const dto = { name: 'Test User', gender: 'male', preferredLanguage: 'English', preferredCurrency: 'LKR' };

      const result = await service.completeOnboarding(mockUserId, dto);

      expect(result).toBeDefined();
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ isOnboarded: true }),
        { new: true },
      );
    });

    it('should throw BadRequestException when user not found', async () => {
      userModel.findByIdAndUpdate.mockReturnValue(createMockQuery(null));

      const dto = { name: 'Test User' } as any;

      await expect(service.completeOnboarding('invalidId', dto)).rejects.toThrow(BadRequestException);
      await expect(service.completeOnboarding('invalidId', dto)).rejects.toThrow('User not found');
    });

    it('should emit audit log on successful onboarding', async () => {
      const onboardedUser = { ...mockUser, isOnboarded: true };
      userModel.findByIdAndUpdate.mockReturnValue(createMockQuery(onboardedUser));

      const dto = { name: 'Test User' } as any;
      await service.completeOnboarding(mockUserId, dto);

      expect(auditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'USER_ONBOARDING_COMPLETED',
          userId: mockUserId,
          status: 'success',
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // oAuthSignIn
  // ──────────────────────────────────────────────────────────────────
  describe('oAuthSignIn', () => {
    it('should create new user for new Google OAuth login and start trial', async () => {
      // First findOne by googleId returns null, second by email returns null
      userModel.findOne
        .mockReturnValueOnce(createMockQuery(null))
        .mockReturnValueOnce(createMockQuery(null));

      const savedOAuthUser = {
        _id: mockUserId,
        email: 'oauth@google.com',
        name: 'OAuth User',
        googleId: 'google-12345',
        role: 'LANDOWNER',
        isOnboarded: false,
        plan: 'free',
        linkedAccounts: { google: true },
        isTrialActive: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.mockImplementation(() => savedOAuthUser);

      const updatedOAuthUser = { ...savedOAuthUser, plan: 'pro', isTrialActive: true };
      userModel.findById.mockReturnValue(createMockQuery(updatedOAuthUser));

      const data = {
        email: 'oauth@google.com',
        name: 'OAuth User',
        providerId: 'google-12345',
        provider: 'google',
      };

      const result = await service.oAuthSignIn(data);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.isNewUser).toBe(true);
      expect(result.isOnboarded).toBe(false);
      expect(subscriptionService.startProTrial).toHaveBeenCalledWith(mockUserId);
    });

    it('should link account for existing user on Google OAuth', async () => {
      const existingOAuthUser = {
        ...mockUser,
        email: 'existing@google.com',
        linkedAccounts: {},
        save: jest.fn().mockResolvedValue(undefined),
      };

      // findOne by googleId returns null, findOne by email returns existing user
      userModel.findOne
        .mockReturnValueOnce(createMockQuery(null))
        .mockReturnValueOnce(createMockQuery(existingOAuthUser));

      const data = {
        email: 'existing@google.com',
        name: 'Existing User',
        providerId: 'google-99999',
        provider: 'google',
      };

      const result = await service.oAuthSignIn(data);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.isNewUser).toBe(false);
      expect(existingOAuthUser.save).toHaveBeenCalled();
      expect(existingOAuthUser.linkedAccounts).toEqual({ google: true });
      // Should not start trial for existing user
      expect(subscriptionService.startProTrial).not.toHaveBeenCalled();
    });

    it('should handle Facebook provider', async () => {
      userModel.findOne
        .mockReturnValueOnce(createMockQuery(null))
        .mockReturnValueOnce(createMockQuery(null));

      const savedFbUser = {
        _id: mockUserId,
        email: 'fb@facebook.com',
        name: 'FB User',
        facebookId: 'fb-12345',
        role: 'LANDOWNER',
        isOnboarded: false,
        plan: 'free',
        linkedAccounts: { facebook: true },
        isTrialActive: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      userModel.mockImplementation(() => savedFbUser);

      const updatedFbUser = { ...savedFbUser, plan: 'pro', isTrialActive: true };
      userModel.findById.mockReturnValue(createMockQuery(updatedFbUser));

      const data = {
        email: 'fb@facebook.com',
        name: 'FB User',
        providerId: 'fb-12345',
        provider: 'facebook',
      };

      const result = await service.oAuthSignIn(data);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.isNewUser).toBe(true);
    });

    it('should find existing user by providerId directly', async () => {
      const existingByProviderId = {
        ...mockUser,
        googleId: 'google-12345',
        linkedAccounts: { google: true },
        save: jest.fn().mockResolvedValue(undefined),
      };

      // findOne by googleId returns the user directly
      userModel.findOne.mockReturnValueOnce(createMockQuery(existingByProviderId));

      const data = {
        email: 'test@example.com',
        name: 'Test User',
        providerId: 'google-12345',
        provider: 'google',
      };

      const result = await service.oAuthSignIn(data);

      expect(result.isNewUser).toBe(false);
      expect(existingByProviderId.save).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // login (admin email + password)
  // ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should return token and user for valid admin credentials', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@example.com', 'validPassword');

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('LANDOWNER');
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
        sub: mockUserId,
        email: 'test@example.com',
      }));
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@example.com', 'wrongPassword')).rejects.toThrow(UnauthorizedException);
      await expect(service.login('test@example.com', 'wrongPassword')).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userModel.findOne.mockReturnValue(createMockQuery(null));

      await expect(service.login('notfound@example.com', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should emit audit log on failed login', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      try {
        await service.login('test@example.com', 'wrongPassword');
      } catch {
        // expected
      }

      expect(auditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'ADMIN_LOGIN_FAILED',
          status: 'error',
        }),
      );
    });

    it('should emit audit log on successful login', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login('test@example.com', 'validPassword');

      expect(auditLogClient.emit).toHaveBeenCalledWith(
        'create_audit_log',
        expect.objectContaining({
          action: 'ADMIN_LOGIN_SUCCESS',
          status: 'success',
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Subscription delegation
  // ──────────────────────────────────────────────────────────────────
  describe('createSubscription', () => {
    it('should delegate to subscriptionService.createSubscription', async () => {
      const result = await service.createSubscription({
        userId: mockUserId,
        planKey: 'pro',
        paymentMethod: 'payhere',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Subscription created');
      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(mockUserId, 'pro', 'payhere');
    });

    it('should use "free" as default paymentMethod', async () => {
      await service.createSubscription({ userId: mockUserId, planKey: 'pro' });

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(mockUserId, 'pro', 'free');
    });
  });

  describe('getSubscription', () => {
    it('should return subscription when found', async () => {
      const result = await service.getSubscription(mockUserId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Subscription fetched');
      expect(result.subscription).toBeDefined();
    });

    it('should return null subscription when not found', async () => {
      subscriptionService.getActiveSubscription.mockResolvedValue(null);

      const result = await service.getSubscription(mockUserId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('No active subscription');
      expect(result.subscription).toBeNull();
    });
  });

  describe('getPlans', () => {
    it('should return mapped plans', async () => {
      const result = await service.getPlans();

      expect(result.success).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0]).toHaveProperty('key', 'pro');
      expect(result.plans[0]).toHaveProperty('priceMonthlyLkr', 1500);
      expect(subscriptionService.getPlans).toHaveBeenCalled();
    });
  });

  describe('getPlan', () => {
    it('should return mapped plan when found', async () => {
      const result = await service.getPlan('pro');

      expect(result.success).toBe(true);
      expect(result.plan.key).toBe('pro');
      expect(result.plan.level).toBe(1);
    });

    it('should throw BadRequestException when plan not found', async () => {
      subscriptionService.getPlan.mockResolvedValue(null);

      await expect(service.getPlan('nonexistent')).rejects.toThrow(BadRequestException);
      await expect(service.getPlan('nonexistent')).rejects.toThrow('Plan not found: nonexistent');
    });
  });

  describe('createPlan', () => {
    it('should delegate plan creation to subscriptionService', async () => {
      const planData = {
        key: 'enterprise',
        name: 'Enterprise Plan',
        level: 3,
        price_monthly_lkr: 5000,
        price_annual_lkr: 50000,
        feature_keys: ['all_features'],
        duration: 'monthly',
      };

      const result = await service.createPlan(planData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Plan created');
      expect(subscriptionService.createPlan).toHaveBeenCalledWith(expect.objectContaining({
        key: 'enterprise',
        name: 'Enterprise Plan',
        level: 3,
        priceMonthlyLKR: 5000,
        priceAnnualLKR: 50000,
        featureKeys: ['all_features'],
        duration: 'monthly',
      }));
    });
  });

  describe('updatePlan', () => {
    it('should delegate plan update to subscriptionService', async () => {
      const result = await service.updatePlan('pro', { name: 'Pro Plus', level: 1 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Plan updated');
      expect(subscriptionService.updatePlan).toHaveBeenCalledWith('pro', expect.objectContaining({
        name: 'Pro Plus',
        level: 1,
      }));
    });
  });

  describe('deletePlan', () => {
    it('should delegate plan deletion to subscriptionService', async () => {
      const result = await service.deletePlan('pro');

      expect(result.success).toBe(true);
      expect(result.message).toBe("Plan 'pro' deactivated");
      expect(subscriptionService.deletePlan).toHaveBeenCalledWith('pro');
    });
  });

  describe('checkPlanAccess', () => {
    it('should delegate to subscriptionService.checkPlanAccess', async () => {
      const result = await service.checkPlanAccess(mockUserId, [0, 1]);

      expect(result).toEqual({ allowed: true, reason: 'allowed', requiredPlanLevels: [] });
      expect(subscriptionService.checkPlanAccess).toHaveBeenCalledWith(mockUserId, [0, 1]);
    });
  });

  describe('getAllSubscriptions', () => {
    it('should return paginated subscriptions with mapped dates', async () => {
      const result = await service.getAllSubscriptions(1, 10);

      expect(result.success).toBe(true);
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0]).toHaveProperty('id');
      expect(result.subscriptions[0]).toHaveProperty('planKey', 'pro');
      expect(result.subscriptions[0]).toHaveProperty('startDate');
      expect(result.subscriptions[0].startDate).toHaveProperty('seconds');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // getPersonalDetail
  // ──────────────────────────────────────────────────────────────────
  describe('getPersonalDetail', () => {
    it('should return LANDOWNER details', async () => {
      const landownerUser = { ...mockUser, role: 'LANDOWNER' };
      userModel.findById.mockReturnValue(createMockQuery(landownerUser));

      const result = await service.getPersonalDetail(mockUserId);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.landOwnerDetails).toBeDefined();
      expect(result.distributorDetails).toBeNull();
      expect(result.laboratoryDetails).toBeNull();
      expect(landOwnerModel.findOne).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should return LABORATORY details', async () => {
      const labUser = { ...mockUser, role: 'LABORATORY' };
      userModel.findById.mockReturnValue(createMockQuery(labUser));

      const result = await service.getPersonalDetail(mockUserId);

      expect(result.success).toBe(true);
      expect(result.laboratoryDetails).toBeDefined();
      expect(result.landOwnerDetails).toBeNull();
      expect(laboratoryModel.findOne).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should return DISTRIBUTOR details (via serviceProviderModel)', async () => {
      const distributorUser = { ...mockUser, role: 'DISTRIBUTOR' };
      userModel.findById.mockReturnValue(createMockQuery(distributorUser));

      const result = await service.getPersonalDetail(mockUserId);

      expect(result.success).toBe(true);
      expect(result.distributorDetails).toBeDefined();
      expect(result.landOwnerDetails).toBeNull();
      expect(serviceProviderModel.findOne).toHaveBeenCalledWith({ userId: mockUserId });
    });

    it('should throw BadRequestException when user not found', async () => {
      userModel.findById.mockReturnValue(createMockQuery(null));

      await expect(service.getPersonalDetail('invalidId')).rejects.toThrow(BadRequestException);
      await expect(service.getPersonalDetail('invalidId')).rejects.toThrow('User not found');
    });
  });
});
