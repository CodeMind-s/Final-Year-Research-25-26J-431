// Updated user.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { LandOwnerDetails } from './schemas/land-owner-details.schema';
import { ServiceProviderDetails } from './schemas/service-provider-details.schema';
import { LaboratoryDetails } from './schemas/laboratory-details.schema';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dtos/user.dto';
import * as bcrypt from 'bcrypt';
import { CreateSubscriptionDto } from './dtos/subscription.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User')
    private readonly userModel: Model<User>,
    @InjectModel('LandOwnerDetails')
    private readonly landOwnerModel: Model<LandOwnerDetails>,
    @InjectModel('ServiceProviderDetails')
    private readonly serviceProviderModel: Model<ServiceProviderDetails>,
    @InjectModel('LaboratoryDetails')
    private readonly laboratoryModel: Model<LaboratoryDetails>,
  ) {
    console.log('DEBUG: UserService constructor initialized with string tokens v2');
  }

  async createUser(createUserDto: CreateUserDto): Promise<any> {
    const existingUser = await this.userModel.findOne({ email: createUserDto.email }).exec();
    if (existingUser) throw new BadRequestException('Email already exists');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      role: createUserDto.role || 'LANDOWNER',
      plan: 'free',
      isSubscribed: false,
      isVerified: false,
    });
    return await user.save();
  }

  async getAllUsers(page: number, limit: number): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * limit;
    const users = await this.userModel.find().skip(skip).limit(limit).exec();
    const total = await this.userModel.countDocuments().exec();
    return { users, total };
  }

  async getUser(email: string): Promise<User> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel.findOne({ email: updateUserDto.email }).exec();
    if (!user) throw new NotFoundException('User not found');

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    return await user.save();
  }

  async deleteUser(email: string): Promise<void> {
    await this.userModel.deleteOne({ email }).exec();
  }

  async updateProfile(updateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.userModel.findById(updateProfileDto.userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return await user.save();
  }

  async onboardLandOwner(data: any): Promise<any> {
    const { userId, docUrls, totalBeds, nic, address } = data;
    const details = new this.landOwnerModel({ userId, docUrls, totalBeds, nic, address });
    await details.save();
    await this.userModel.findByIdAndUpdate(userId, { isOnboarded: true });
    return { success: true, message: 'Landowner onboarding successful' };
  }

  async onboardServiceProvider(data: any): Promise<any> {
    const { userId, docUrls, companyName, registrationNumber, address } = data;
    const details = new this.serviceProviderModel({ userId, docUrls, companyName, registrationNumber, address });
    await details.save();
    await this.userModel.findByIdAndUpdate(userId, { isOnboarded: true });
    return { success: true, message: 'Service provider onboarding successful' };
  }

  async onboardLaboratory(data: any): Promise<any> {
    const { userId, docUrls, laboratoryName, registrationNumber, address } = data;
    const details = new this.laboratoryModel({ userId, docUrls, laboratoryName, registrationNumber, address });
    await details.save();
    await this.userModel.findByIdAndUpdate(userId, { isOnboarded: true });
    return { success: true, message: 'Laboratory onboarding successful' };
  }

  async getPersonalDetails(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    let details = null;
    if (user.role === 'LANDOWNER') {
      details = await this.landOwnerModel.findOne({ userId }).exec();
    } else if (user.role === 'SERVICE_PROVIDER' || user.role === 'DISTRIBUTOR') {
      details = await this.serviceProviderModel.findOne({ userId }).exec();
    } else if (user.role === 'LABORATORY') {
      details = await this.laboratoryModel.findOne({ userId }).exec();
    }

    return {
      user,
      landOwnerDetails: user.role === 'LANDOWNER' ? details : null,
      serviceProviderDetails: (user.role === 'SERVICE_PROVIDER' || user.role === 'DISTRIBUTOR') ? details : null,
      laboratoryDetails: user.role === 'LABORATORY' ? details : null,
    };
  }

  async updatePersonalDetails(data: any): Promise<any> {
    // Placeholder to satisfy UserController lint, implement role-specific update if needed
    return await this.userModel.findById(data.userId).exec();
  }

  async createSubscription(data: CreateSubscriptionDto & { userId: string }): Promise<{ url: string }> {
    throw new BadRequestException('Subscriptions currently disabled');
  }

  async getSubscription(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return {
      plan: user.plan,
      isActive: user.isSubscribed,
      endDate: null,
      stripeSubscriptionId: (user as any).subscriptionId,
    };
  }

  async updateSubscription(data: CreateSubscriptionDto & { userId: string }): Promise<{ url: string }> {
    return this.createSubscription(data);
  }

  async handleStripeWebhook(event: any): Promise<void> {
    // Implement as needed
  }

  async checkSubscriptionAccess(userId: string, requiredLevel: number = 0): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return false;
    const planLevels = { free: 0, basic: 1, premium: 2 };
    const userLevel = planLevels[user.plan] || 0;
    return userLevel >= requiredLevel;
  }
}