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

  async getAllUsers(page: number, limit: number): Promise<{ users: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const users = await this.userModel.find().skip(skip).limit(limit).exec();
    const total = await this.userModel.countDocuments().exec();

    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const roleDetails = await this.getRoleDetails(user);
        return { user, ...roleDetails };
      }),
    );

    return { users: usersWithDetails, total };
  }

  async getUser(email: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new NotFoundException('User not found');

    const roleDetails = await this.getRoleDetails(user);
    return { user, ...roleDetails };
  }

  async getUserById(id: string): Promise<any> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');

    const roleDetails = await this.getRoleDetails(user);
    return { user, ...roleDetails };
  }

  private async getRoleDetails(user: User): Promise<any> {
    let details = null;
    const userId = (user as any)._id.toString();

    if (user.role === 'LANDOWNER') {
      details = await this.landOwnerModel.findOne({ userId }).exec();
    } else if (user.role === 'SERVICE_PROVIDER' || user.role === 'DISTRIBUTOR') {
      details = await this.serviceProviderModel.findOne({ userId }).exec();
    } else if (user.role === 'LABORATORY') {
      details = await this.laboratoryModel.findOne({ userId }).exec();
    }

    return {
      landOwnerDetails: user.role === 'LANDOWNER' ? details : null,
      serviceProviderDetails: user.role === 'SERVICE_PROVIDER' ? details : null,
      distributorDetails: user.role === 'DISTRIBUTOR' ? details : null,
      laboratoryDetails: user.role === 'LABORATORY' ? details : null,
    };
  }

  async updateUser(updateUserDto: UpdateUserDto): Promise<User> {
    if (!updateUserDto.userId) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.userModel.findById(updateUserDto.userId).exec();
    if (!user) throw new NotFoundException('User not found');

    // Update only provided fields
    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }
    if (updateUserDto.isOnboard !== undefined) {
      user.isOnboarded = updateUserDto.isOnboard;
    }
    if (updateUserDto.plan !== undefined) {
      user.plan = updateUserDto.plan;
    }
    if (updateUserDto.isSubscribe !== undefined) {
      user.isSubscribed = updateUserDto.isSubscribe;
    }
    if (updateUserDto.isVerified !== undefined) {
      user.isVerified = updateUserDto.isVerified;
    }

    return await user.save();
  }

  async deleteUser(email: string): Promise<void> {
    await this.userModel.deleteOne({ email }).exec();
  }

  async updateProfile(updateProfileDto: UpdateProfileDto): Promise<any> {
    if (!updateProfileDto.userId) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.userModel.findById(updateProfileDto.userId).exec();
    if (!user) throw new NotFoundException('User not found');

    let roleDetails = null;
    const userId = updateProfileDto.userId;

    // Update role-specific details based on user role
    if (user.role === 'LANDOWNER') {
      const updateData: any = {};
      if (updateProfileDto.docUrls !== undefined) updateData.docUrls = updateProfileDto.docUrls;
      if (updateProfileDto.totalBeds !== undefined) updateData.totalBeds = updateProfileDto.totalBeds;
      if (updateProfileDto.nic !== undefined) updateData.nic = updateProfileDto.nic;
      if (updateProfileDto.address !== undefined) updateData.address = updateProfileDto.address;

      roleDetails = await this.landOwnerModel.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: false }
      ).exec();

      return {
        status: 200,
        message: 'User profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
          plan: user.plan,
          isSubscribed: user.isSubscribed,
          isVerified: user.isVerified
        },
        landOwnerDetails: roleDetails ? {
          id: roleDetails._id,
          userId: roleDetails.userId,
          docUrls: roleDetails.docUrls,
          totalBeds: roleDetails.totalBeds,
          nic: roleDetails.nic,
          address: roleDetails.address
        } : null
      };
    } else if (user.role === 'DISTRIBUTOR') {
      const updateData: any = {};
      if (updateProfileDto.docUrls !== undefined) updateData.docUrls = updateProfileDto.docUrls;
      if (updateProfileDto.companyName !== undefined) updateData.companyName = updateProfileDto.companyName;
      if (updateProfileDto.registrationNumber !== undefined) updateData.registrationNumber = updateProfileDto.registrationNumber;
      if (updateProfileDto.address !== undefined) updateData.address = updateProfileDto.address;

      roleDetails = await this.serviceProviderModel.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: false }
      ).exec();

      return {
        status: 200,
        message: 'User profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
          plan: user.plan,
          isSubscribed: user.isSubscribed,
          isVerified: user.isVerified
        },
        distributorDetails: roleDetails ? {
          id: roleDetails._id,
          userId: roleDetails.userId,
          docUrls: roleDetails.docUrls,
          companyName: roleDetails.companyName,
          registrationNumber: roleDetails.registrationNumber,
          address: roleDetails.address
        } : null
      };
    } else if (user.role === 'LABORATORY') {
      const updateData: any = {};
      if (updateProfileDto.docUrls !== undefined) updateData.docUrls = updateProfileDto.docUrls;
      if (updateProfileDto.laboratoryName !== undefined) updateData.laboratoryName = updateProfileDto.laboratoryName;
      if (updateProfileDto.registrationNumber !== undefined) updateData.registrationNumber = updateProfileDto.registrationNumber;
      if (updateProfileDto.address !== undefined) updateData.address = updateProfileDto.address;

      roleDetails = await this.laboratoryModel.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: false }
      ).exec();

      return {
        status: 200,
        message: 'User profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
          plan: user.plan,
          isSubscribed: user.isSubscribed,
          isVerified: user.isVerified
        },
        laboratoryDetails: roleDetails ? {
          id: roleDetails._id,
          userId: roleDetails.userId,
          docUrls: roleDetails.docUrls,
          laboratoryName: roleDetails.laboratoryName,
          registrationNumber: roleDetails.registrationNumber,
          address: roleDetails.address
        } : null
      };
    }

    throw new BadRequestException('Invalid role for profile update');
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

    const roleDetails = await this.getRoleDetails(user);
    return { user, ...roleDetails };
  }

  async updatePersonalDetails(data: any): Promise<any> {
    if (!data.userId) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.userModel.findById(data.userId).exec();
    if (!user) throw new NotFoundException('User not found');

    let roleDetails = null;
    const userId = data.userId;

    // Update role-specific details based on user role
    if (user.role === 'LANDOWNER') {
      const updateData: any = {};
      if (data.docUrls !== undefined) updateData.docUrls = data.docUrls;
      if (data.totalBeds !== undefined) updateData.totalBeds = data.totalBeds;
      if (data.nic !== undefined) updateData.nic = data.nic;
      if (data.address !== undefined) updateData.address = data.address;

      roleDetails = await this.landOwnerModel.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: false }
      ).exec();

      return {
        status: 200,
        message: 'User profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
          plan: user.plan,
          isSubscribed: user.isSubscribed,
          isVerified: user.isVerified
        },
        landOwnerDetails: roleDetails ? {
          id: roleDetails._id,
          userId: roleDetails.userId,
          docUrls: roleDetails.docUrls,
          totalBeds: roleDetails.totalBeds,
          nic: roleDetails.nic,
          address: roleDetails.address
        } : null
      };
    } else if (user.role === 'DISTRIBUTOR') {
      const updateData: any = {};
      if (data.docUrls !== undefined) updateData.docUrls = data.docUrls;
      if (data.companyName !== undefined) updateData.companyName = data.companyName;
      if (data.registrationNumber !== undefined) updateData.registrationNumber = data.registrationNumber;
      if (data.address !== undefined) updateData.address = data.address;

      roleDetails = await this.serviceProviderModel.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: false }
      ).exec();

      return {
        status: 200,
        message: 'User profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
          plan: user.plan,
          isSubscribed: user.isSubscribed,
          isVerified: user.isVerified
        },
        distributorDetails: roleDetails ? {
          id: roleDetails._id,
          userId: roleDetails.userId,
          docUrls: roleDetails.docUrls,
          companyName: roleDetails.companyName,
          registrationNumber: roleDetails.registrationNumber,
          address: roleDetails.address
        } : null
      };
    } else if (user.role === 'LABORATORY') {
      const updateData: any = {};
      if (data.docUrls !== undefined) updateData.docUrls = data.docUrls;
      if (data.laboratoryName !== undefined) updateData.laboratoryName = data.laboratoryName;
      if (data.registrationNumber !== undefined) updateData.registrationNumber = data.registrationNumber;
      if (data.address !== undefined) updateData.address = data.address;

      roleDetails = await this.laboratoryModel.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: false }
      ).exec();

      return {
        status: 200,
        message: 'User profile updated successfully',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          isOnboarded: user.isOnboarded,
          plan: user.plan,
          isSubscribed: user.isSubscribed,
          isVerified: user.isVerified
        },
        laboratoryDetails: roleDetails ? {
          id: roleDetails._id,
          userId: roleDetails.userId,
          docUrls: roleDetails.docUrls,
          laboratoryName: roleDetails.laboratoryName,
          registrationNumber: roleDetails.registrationNumber,
          address: roleDetails.address
        } : null
      };
    }

    throw new BadRequestException('Invalid role for profile update');
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

  async verifyUser(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    user.isVerified = true;
    await user.save();

    return {
      id: user._id,
      email: user.email,
      role: user.role,
      isOnboarded: user.isOnboarded,
      plan: user.plan,
      isSubscribed: user.isSubscribed,
      isVerified: user.isVerified
    };
  }

  async checkSubscriptionAccess(userId: string, requiredLevel: number = 0): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return false;
    const planLevels = { free: 0, basic: 1, premium: 2 };
    const userLevel = planLevels[user.plan] || 0;
    return userLevel >= requiredLevel;
  }
}