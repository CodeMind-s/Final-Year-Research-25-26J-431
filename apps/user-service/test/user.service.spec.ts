import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserService } from '../src/app/user/user.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('UserService', () => {
  let service: UserService;
  let userModel: any;
  let landOwnerModel: any;
  let serviceProviderModel: any;
  let laboratoryModel: any;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    password: 'hashedPassword123',
    name: 'Test User',
    role: 'LANDOWNER',
    isOnboarded: false,
    plan: 'free',
    isSubscribed: false,
    isVerified: false,
    save: jest.fn().mockResolvedValue(this),
  };

  const mockLandOwnerDetails = {
    _id: '507f1f77bcf86cd799439012',
    userId: '507f1f77bcf86cd799439011',
    docUrls: ['http://example.com/doc1.pdf'],
    totalBeds: 100,
    nic: '123456789V',
    address: '123 Main St',
  };

  const mockServiceProviderDetails = {
    _id: '507f1f77bcf86cd799439013',
    userId: '507f1f77bcf86cd799439011',
    docUrls: ['http://example.com/doc1.pdf'],
    companyName: 'Test Company',
    registrationNumber: 'REG123',
    address: '456 Business St',
  };

  const mockLaboratoryDetails = {
    _id: '507f1f77bcf86cd799439014',
    userId: '507f1f77bcf86cd799439011',
    docUrls: ['http://example.com/doc1.pdf'],
    laboratoryName: 'Test Lab',
    registrationNumber: 'LAB123',
    address: '789 Lab Ave',
  };

  const createMockModel = (mockData: any = null) => {
    const mockModelInstance = {
      save: jest.fn().mockResolvedValue(mockData || mockUser),
    };

    const model = jest.fn().mockImplementation(() => mockModelInstance);

    Object.assign(model, {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      }),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockData),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      }),
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

  beforeEach(async () => {
    userModel = createMockModel(mockUser);
    landOwnerModel = createMockModel(mockLandOwnerDetails);
    serviceProviderModel = createMockModel(mockServiceProviderDetails);
    laboratoryModel = createMockModel(mockLaboratoryDetails);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken('User'), useValue: userModel },
        { provide: getModelToken('LandOwnerDetails'), useValue: landOwnerModel },
        { provide: getModelToken('ServiceProviderDetails'), useValue: serviceProviderModel },
        { provide: getModelToken('LaboratoryDetails'), useValue: laboratoryModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const createUserDto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        role: 'LANDOWNER',
      };

      const result = await service.createUser(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if email already exists', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'LANDOWNER',
      };

      await expect(service.createUser(createUserDto)).rejects.toThrow(BadRequestException);
      await expect(service.createUser(createUserDto)).rejects.toThrow('Email already exists');
    });
  });

  describe('getAllUsers', () => {
    it('should return paginated users with details', async () => {
      const result = await service.getAllUsers(1, 10);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('total');
      expect(userModel.find).toHaveBeenCalled();
      expect(userModel.countDocuments).toHaveBeenCalled();
    });

    it('should apply pagination correctly', async () => {
      await service.getAllUsers(2, 5);

      expect(userModel.find).toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    it('should return user by email', async () => {
      const result = await service.getUser('test@example.com');

      expect(result).toHaveProperty('user');
      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getUser('notfound@example.com')).rejects.toThrow(NotFoundException);
      await expect(service.getUser('notfound@example.com')).rejects.toThrow('User not found');
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const result = await service.getUserById('507f1f77bcf86cd799439011');

      expect(result).toHaveProperty('user');
      expect(userModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getUserById('invalidId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUserWithSave = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(mockUser),
      };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserWithSave),
      });

      const updateUserDto = {
        userId: '507f1f77bcf86cd799439011',
        name: 'Updated Name',
        isOnboard: true,
      };

      const result = await service.updateUser(updateUserDto);

      expect(mockUserWithSave.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if userId is missing', async () => {
      const updateUserDto = {
        name: 'Updated Name',
      };

      await expect(service.updateUser(updateUserDto as any)).rejects.toThrow(BadRequestException);
      await expect(service.updateUser(updateUserDto as any)).rejects.toThrow('User ID is required');
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const updateUserDto = {
        userId: 'invalidId',
        name: 'Updated Name',
      };

      await expect(service.updateUser(updateUserDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete user by email', async () => {
      await service.deleteUser('test@example.com');

      expect(userModel.deleteOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  describe('updateProfile', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(service.updateProfile({} as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateProfile({ userId: 'invalidId' } as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should update LANDOWNER profile successfully', async () => {
      const mockLandOwner = {
        ...mockUser,
        role: 'LANDOWNER',
        _id: '507f1f77bcf86cd799439011',
      };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockLandOwner),
      });
      landOwnerModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockLandOwnerDetails),
      });

      const result = await service.updateProfile({
        userId: '507f1f77bcf86cd799439011',
        totalBeds: 150,
        address: 'Updated Address',
      });

      expect(result.status).toBe(200);
      expect(landOwnerModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('onboardLandOwner', () => {
    it('should onboard landowner successfully', async () => {
      const landOwnerData = {
        userId: '507f1f77bcf86cd799439011',
        docUrls: ['http://example.com/doc.pdf'],
        totalBeds: 100,
        nic: '123456789V',
        address: '123 Main St',
      };

      const result = await service.onboardLandOwner(landOwnerData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Landowner onboarding successful');
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        landOwnerData.userId,
        { isOnboarded: true }
      );
    });
  });

  describe('onboardServiceProvider', () => {
    it('should onboard service provider successfully', async () => {
      const serviceProviderData = {
        userId: '507f1f77bcf86cd799439011',
        docUrls: ['http://example.com/doc.pdf'],
        companyName: 'Test Company',
        registrationNumber: 'REG123',
        address: '456 Business St',
      };

      const result = await service.onboardServiceProvider(serviceProviderData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Service provider onboarding successful');
    });
  });

  describe('onboardLaboratory', () => {
    it('should onboard laboratory successfully', async () => {
      const laboratoryData = {
        userId: '507f1f77bcf86cd799439011',
        docUrls: ['http://example.com/doc.pdf'],
        laboratoryName: 'Test Lab',
        registrationNumber: 'LAB123',
        address: '789 Lab Ave',
      };

      const result = await service.onboardLaboratory(laboratoryData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Laboratory onboarding successful');
    });
  });

  describe('getPersonalDetails', () => {
    it('should return personal details for user', async () => {
      const result = await service.getPersonalDetails('507f1f77bcf86cd799439011');

      expect(result).toHaveProperty('user');
      expect(userModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getPersonalDetails('invalidId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      const result = await service.getSubscription('507f1f77bcf86cd799439011');

      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('isActive');
      expect(result.plan).toBe('free');
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getSubscription('invalidId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyUser', () => {
    it('should verify user successfully', async () => {
      const mockUserWithSave = {
        ...mockUser,
        save: jest.fn().mockResolvedValue({ ...mockUser, isVerified: true }),
      };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserWithSave),
      });

      await service.verifyUser('507f1f77bcf86cd799439011');

      expect(mockUserWithSave.isVerified).toBe(true);
      expect(mockUserWithSave.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.verifyUser('invalidId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkSubscriptionAccess', () => {
    it('should return true for sufficient subscription level', async () => {
      const mockPremiumUser = { ...mockUser, plan: 'premium' };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPremiumUser),
      });

      const result = await service.checkSubscriptionAccess('507f1f77bcf86cd799439011', 1);

      expect(result).toBe(true);
    });

    it('should return false for insufficient subscription level', async () => {
      const mockFreeUser = { ...mockUser, plan: 'free' };
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockFreeUser),
      });

      const result = await service.checkSubscriptionAccess('507f1f77bcf86cd799439011', 2);

      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      userModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.checkSubscriptionAccess('invalidId', 0);

      expect(result).toBe(false);
    });
  });

  describe('createSubscription', () => {
    it('should throw BadRequestException as subscriptions are disabled', async () => {
      await expect(
        service.createSubscription({ userId: '507f1f77bcf86cd799439011', plan: 'basic' } as any)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createSubscription({ userId: '507f1f77bcf86cd799439011', plan: 'basic' } as any)
      ).rejects.toThrow('Subscriptions currently disabled');
    });
  });
});
