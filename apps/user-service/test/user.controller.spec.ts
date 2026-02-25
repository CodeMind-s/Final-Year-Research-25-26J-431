import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserController } from '../src/app/user/user.controller';
import { UserService } from '../src/app/user/user.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    name: 'Test User',
    role: 'LANDOWNER',
    isOnboarded: false,
    plan: 'free',
    isSubscribed: false,
    isVerified: false,
  };

  const mockLandOwnerDetails = {
    _id: '507f1f77bcf86cd799439012',
    userId: '507f1f77bcf86cd799439011',
    docUrls: ['http://example.com/doc1.pdf'],
    totalBeds: 100,
    nic: '123456789V',
    address: '123 Main St',
  };

  beforeEach(async () => {
    const mockUserService = {
      createUser: jest.fn(),
      getAllUsers: jest.fn(),
      getUser: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      updateProfile: jest.fn(),
      onboardLandOwner: jest.fn(),
      onboardServiceProvider: jest.fn(),
      onboardLaboratory: jest.fn(),
      getPersonalDetails: jest.fn(),
      updatePersonalDetails: jest.fn(),
      createSubscription: jest.fn(),
      getSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      handleStripeWebhook: jest.fn(),
      verifyUser: jest.fn(),
      checkSubscriptionAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      userService.createUser.mockResolvedValue(mockUser);

      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'LANDOWNER',
      };

      const result = await controller.createUser(createUserDto);

      expect(result.status).toBe(200);
      expect(result.message).toBe('User created successfully');
      expect(result.id).toBe(mockUser._id);
      expect(userService.createUser).toHaveBeenCalledWith(createUserDto);
    });

    it('should throw RpcException on error', async () => {
      userService.createUser.mockRejectedValue(new BadRequestException('Email already exists'));

      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'LANDOWNER',
      };

      await expect(controller.createUser(createUserDto)).rejects.toThrow(RpcException);
    });
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const mockResult = {
        users: [{ user: mockUser, landOwnerDetails: mockLandOwnerDetails }],
        total: 1,
      };
      userService.getAllUsers.mockResolvedValue(mockResult);

      const result = await controller.getAllUsers({ page: 1, limit: 10 });

      expect(result.users).toEqual(mockResult.users);
      expect(result.total).toBe(1);
      expect(userService.getAllUsers).toHaveBeenCalledWith(1, 10);
    });

    it('should throw RpcException on error', async () => {
      userService.getAllUsers.mockRejectedValue(new Error('Database error'));

      await expect(controller.getAllUsers({ page: 1, limit: 10 })).rejects.toThrow(RpcException);
    });
  });

  describe('getUser', () => {
    it('should return user by email', async () => {
      const mockResult = {
        user: mockUser,
        landOwnerDetails: mockLandOwnerDetails,
        serviceProviderDetails: null,
        distributorDetails: null,
        laboratoryDetails: null,
      };
      userService.getUser.mockResolvedValue(mockResult);

      const result = await controller.getUser({ email: 'test@example.com' });

      expect(result.status).toBe(200);
      expect(result.data).toEqual(mockUser);
      expect(userService.getUser).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw RpcException when user not found', async () => {
      userService.getUser.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getUser({ email: 'notfound@example.com' })).rejects.toThrow(RpcException);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const mockResult = {
        user: mockUser,
        landOwnerDetails: mockLandOwnerDetails,
        serviceProviderDetails: null,
        distributorDetails: null,
        laboratoryDetails: null,
      };
      userService.getUserById.mockResolvedValue(mockResult);

      const result = await controller.getUserById({ id: '507f1f77bcf86cd799439011' });

      expect(result.status).toBe(200);
      expect(result.data).toEqual(mockUser);
      expect(userService.getUserById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw RpcException when user not found', async () => {
      userService.getUserById.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getUserById({ id: 'invalidId' })).rejects.toThrow(RpcException);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name', isOnboarded: true };
      userService.updateUser.mockResolvedValue(updatedUser as any);

      const updateUserDto = {
        userId: '507f1f77bcf86cd799439011',
        name: 'Updated Name',
        isOnboard: true,
      };

      const result = await controller.updateUser(updateUserDto);

      expect(result.status).toBe(200);
      expect(result.message).toBe('User updated successfully');
      expect(userService.updateUser).toHaveBeenCalledWith(updateUserDto);
    });

    it('should throw RpcException on error', async () => {
      userService.updateUser.mockRejectedValue(new BadRequestException('User ID is required'));

      await expect(controller.updateUser({ name: 'Test' } as any)).rejects.toThrow(RpcException);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      userService.deleteUser.mockResolvedValue(undefined);

      const result = await controller.deleteUser({ email: 'test@example.com' });

      expect(result.status).toBe(200);
      expect(result.message).toBe('User deleted successfully');
      expect(userService.deleteUser).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw RpcException on error', async () => {
      userService.deleteUser.mockRejectedValue(new Error('Delete failed'));

      await expect(controller.deleteUser({ email: 'test@example.com' })).rejects.toThrow(RpcException);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const mockResult = { status: 200, message: 'Profile updated' };
      userService.updateProfile.mockResolvedValue(mockResult);

      const updateProfileDto = {
        userId: '507f1f77bcf86cd799439011',
        totalBeds: 150,
        address: 'Updated Address',
      };

      const result = await controller.updateProfile(updateProfileDto);

      expect(result).toEqual(mockResult);
      expect(userService.updateProfile).toHaveBeenCalledWith(updateProfileDto);
    });

    it('should throw RpcException on error', async () => {
      userService.updateProfile.mockRejectedValue(new BadRequestException('User ID is required'));

      await expect(controller.updateProfile({} as any)).rejects.toThrow(RpcException);
    });
  });

  describe('onboardLandOwner', () => {
    it('should onboard landowner successfully', async () => {
      const mockResult = { success: true, message: 'Landowner onboarding successful' };
      userService.onboardLandOwner.mockResolvedValue(mockResult);

      const data = {
        userId: '507f1f77bcf86cd799439011',
        docUrls: ['http://example.com/doc.pdf'],
        totalBeds: 100,
        nic: '123456789V',
        address: '123 Main St',
      };

      const result = await controller.onboardLandOwner(data);

      expect(result).toEqual(mockResult);
      expect(userService.onboardLandOwner).toHaveBeenCalledWith(data);
    });

    it('should throw RpcException on error', async () => {
      userService.onboardLandOwner.mockRejectedValue(new Error('Onboarding failed'));

      await expect(controller.onboardLandOwner({} as any)).rejects.toThrow(RpcException);
    });
  });

  describe('onboardServiceProvider', () => {
    it('should onboard service provider successfully', async () => {
      const mockResult = { success: true, message: 'Service provider onboarding successful' };
      userService.onboardServiceProvider.mockResolvedValue(mockResult);

      const data = {
        userId: '507f1f77bcf86cd799439011',
        docUrls: ['http://example.com/doc.pdf'],
        companyName: 'Test Company',
        registrationNumber: 'REG123',
        address: '456 Business St',
      };

      const result = await controller.onboardServiceProvider(data);

      expect(result).toEqual(mockResult);
      expect(userService.onboardServiceProvider).toHaveBeenCalledWith(data);
    });
  });

  describe('onboardLaboratory', () => {
    it('should onboard laboratory successfully', async () => {
      const mockResult = { success: true, message: 'Laboratory onboarding successful' };
      userService.onboardLaboratory.mockResolvedValue(mockResult);

      const data = {
        userId: '507f1f77bcf86cd799439011',
        docUrls: ['http://example.com/doc.pdf'],
        laboratoryName: 'Test Lab',
        registrationNumber: 'LAB123',
        address: '789 Lab Ave',
      };

      const result = await controller.onboardLaboratory(data);

      expect(result).toEqual(mockResult);
      expect(userService.onboardLaboratory).toHaveBeenCalledWith(data);
    });
  });

  describe('getPersonalDetails', () => {
    it('should return personal details', async () => {
      const mockResult = { user: mockUser, landOwnerDetails: mockLandOwnerDetails };
      userService.getPersonalDetails.mockResolvedValue(mockResult);

      const result = await controller.getPersonalDetails({ id: '507f1f77bcf86cd799439011' });

      expect(result).toEqual(mockResult);
      expect(userService.getPersonalDetails).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw RpcException on error', async () => {
      userService.getPersonalDetails.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getPersonalDetails({ id: 'invalidId' })).rejects.toThrow(RpcException);
    });
  });

  describe('UpdatePersonalDetails', () => {
    it('should update personal details successfully', async () => {
      const mockResult = { status: 200, message: 'Profile updated' };
      userService.updatePersonalDetails.mockResolvedValue(mockResult);

      const data = {
        userId: '507f1f77bcf86cd799439011',
        totalBeds: 200,
      };

      const result = await controller.UpdatePersonalDetails(data);

      expect(result).toEqual(mockResult);
      expect(userService.updatePersonalDetails).toHaveBeenCalledWith(data);
    });

    it('should throw RpcException on error', async () => {
      userService.updatePersonalDetails.mockRejectedValue(new BadRequestException('User ID is required'));

      await expect(controller.UpdatePersonalDetails({} as any)).rejects.toThrow(RpcException);
    });
  });

  describe('createSubscription', () => {
    it('should initiate subscription checkout', async () => {
      const mockResult = { url: 'https://checkout.stripe.com/session123' };
      userService.createSubscription.mockResolvedValue(mockResult);

      const data = { userId: '507f1f77bcf86cd799439011', plan: 'basic' };

      const result = await controller.createSubscription(data as any);

      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toBe(mockResult.url);
      expect(userService.createSubscription).toHaveBeenCalledWith(data);
    });

    it('should throw RpcException on error', async () => {
      userService.createSubscription.mockRejectedValue(new BadRequestException('Subscriptions disabled'));

      await expect(controller.createSubscription({ userId: 'test', plan: 'basic' } as any)).rejects.toThrow(RpcException);
    });
  });

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      const mockResult = { plan: 'free', isActive: false, endDate: null };
      userService.getSubscription.mockResolvedValue(mockResult);

      const result = await controller.getSubscription({ userId: '507f1f77bcf86cd799439011' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(userService.getSubscription).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw RpcException on error', async () => {
      userService.getSubscription.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getSubscription({ userId: 'invalidId' })).rejects.toThrow(RpcException);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const mockResult = { url: 'https://checkout.stripe.com/session456' };
      userService.updateSubscription.mockResolvedValue(mockResult);

      const data = { userId: '507f1f77bcf86cd799439011', plan: 'premium' };

      const result = await controller.updateSubscription(data as any);

      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toBe(mockResult.url);
    });
  });

  describe('handleStripeWebhook', () => {
    it('should handle stripe webhook successfully', async () => {
      userService.handleStripeWebhook.mockResolvedValue(undefined);

      const event = { type: 'checkout.session.completed', data: {} };

      const result = await controller.handleStripeWebhook(event);

      expect(result.status).toBe(200);
      expect(result.message).toBe('Webhook handled successfully');
      expect(userService.handleStripeWebhook).toHaveBeenCalledWith(event);
    });

    it('should throw RpcException on error', async () => {
      userService.handleStripeWebhook.mockRejectedValue(new Error('Webhook error'));

      await expect(controller.handleStripeWebhook({} as any)).rejects.toThrow(RpcException);
    });
  });

  describe('verifyUser', () => {
    it('should verify user successfully', async () => {
      const mockResult = { ...mockUser, isVerified: true };
      userService.verifyUser.mockResolvedValue(mockResult);

      const result = await controller.verifyUser({ userId: '507f1f77bcf86cd799439011' });

      expect(result.status).toBe(200);
      expect(result.message).toBe('User verified successfully');
      expect(userService.verifyUser).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw RpcException on error', async () => {
      userService.verifyUser.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.verifyUser({ userId: 'invalidId' })).rejects.toThrow(RpcException);
    });
  });

  describe('checkSubscriptionAccess', () => {
    it('should return access status', async () => {
      userService.checkSubscriptionAccess.mockResolvedValue(true);

      const result = await controller.checkSubscriptionAccess({
        userId: '507f1f77bcf86cd799439011',
        requiredLevel: 1,
      });

      expect(result.hasAccess).toBe(true);
      expect(userService.checkSubscriptionAccess).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1);
    });

    it('should throw RpcException on error', async () => {
      userService.checkSubscriptionAccess.mockRejectedValue(new Error('Access check failed'));

      await expect(
        controller.checkSubscriptionAccess({ userId: 'test', requiredLevel: 1 })
      ).rejects.toThrow(RpcException);
    });
  });
});
