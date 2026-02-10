// Updated user.service.ts (added methods for new features)
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dtos/user.dto';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateSubscriptionDto } from './dtos/subscription.dto';
import Stripe from 'stripe';
import { PersonalDetailsDto, AccountSettingsDto } from './dtos/auth.dto'; // Import new DTOs
import { ClientKafka } from '@nestjs/microservices';

interface AuditLogData {
  serviceName: string;
  action: string;
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  details?: string;
  status: 'success' | 'error' | 'warning';
  method?: string;
  path?: string;
}

@Injectable()
export class UserService {
      private readonly logger = new Logger(UserService.name);
    private stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-29.clover' });

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @Inject('AUDIT_LOG_SERVICE') private readonly auditLogClient: ClientKafka,
  ) {}

  /**
   * Emits an audit log event to the audit-log-service via Kafka
   */
  private async emitAuditLog(data: AuditLogData): Promise<void> {
    try {
      await this.auditLogClient.emit('create_audit_log', {
        ...data,
        serviceName: 'user-service',
      }).toPromise();
      this.logger.debug(`Audit log emitted: ${data.action}`);
    } catch (error: any) {
      this.logger.error(`Failed to emit audit log: ${error.message}`);
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<any> {
    try {
      const existingUser = await this.userModel.findOne({ email: createUserDto.email }).exec();
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const user = new this.userModel({ 
        ...createUserDto, 
        password: hashedPassword,
        role: createUserDto.role || 'SELLER', // Default to traveler
        plan: 'free', // Default to free plan
        isSubscribed: false,
      });
      const savedUser = await user.save();
      
      // Audit log for user creation
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'USER_CREATED',
        userId: savedUser._id.toString(),
        resourceId: savedUser._id.toString(),
        resourceType: 'user',
        details: JSON.stringify({ email: createUserDto.email, role: createUserDto.role || 'SELLER' }),
        status: 'success',
        method: 'POST',
        path: '/users',
      });
      
      return savedUser;
    } catch (error) {
      this.logger.error(`CreateUser error: ${error.message}`, error.stack);
      
      // Audit log for failed user creation
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'USER_CREATION_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ email: createUserDto.email, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/users',
      });
      
      throw error;
    }
  }

  async createAdminUser(createUserDto: CreateUserDto): Promise<any> {
    try {
      const existingUser = await this.userModel.findOne({ email: createUserDto.email }).exec();
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const user = new this.userModel({ 
        ...createUserDto, 
        password: hashedPassword,
        role: 'ADMIN' ,
        plan: 'free',
        isSubscribed: false,
      });
      const savedUser = await user.save();
      
      // Audit log for admin user creation
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ADMIN_USER_CREATED',
        userId: savedUser._id.toString(),
        resourceId: savedUser._id.toString(),
        resourceType: 'user',
        details: JSON.stringify({ email: createUserDto.email, role: 'ADMIN' }),
        status: 'success',
        method: 'POST',
        path: '/users/admin',
      });
      
      return savedUser;
    } catch (error) {
      this.logger.error(`CreateAdminUser error: ${error.message}`, error.stack);
      
      // Audit log for failed admin user creation
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ADMIN_USER_CREATION_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ email: createUserDto.email, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/users/admin',
      });
      
      throw error;
    }
  }

  async getAllUsers(page: number, limit:number): Promise<{ users: User[]; total: number }> {
try {
      // Validate pagination parameters
      if (page < 1) {
        throw new NotFoundException('Page must be greater than 0');
      }
      if (limit < 1 || limit > 100) {
        throw new NotFoundException('Limit must be between 1 and 100');
      }

      const skip = (page - 1) * limit;

      // Fetch users with pagination
      const users = await this.userModel.find().skip(skip).limit(limit).exec();
      // Fetch total count for pagination metadata
      const total = await this.userModel.countDocuments().exec();

      return { users, total };
    } catch (error) {
      this.logger.error(`GetAllUsers error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUser(email: string): Promise<User> {
    try {
      const user = await this.userModel.findOne({ email }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      this.logger.error(`GetUser error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      console.log("Fetching user by ID:", id);
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      this.logger.error(`GetUserById error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateUser(updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.userModel.findOne({ email: updateUserDto.email }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updatedFields: string[] = [];
      if (updateUserDto.password) {
        user.password = await bcrypt.hash(updateUserDto.password, 10);
        updatedFields.push('password');
      }
      if (updateUserDto.name) {
        user.name = updateUserDto.name;
        updatedFields.push('name');
      }
      if (updateUserDto.preferredLanguage) {
        user.preferredLanguage = updateUserDto.preferredLanguage;
        updatedFields.push('preferredLanguage');
      }
      if (updateUserDto.preferredCurrency) {
        user.preferredCurrency = updateUserDto.preferredCurrency;
        updatedFields.push('preferredCurrency');
      }

      const savedUser = await user.save();
      
      // Audit log for user update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'USER_UPDATED',
        userId: user._id.toString(),
        resourceId: user._id.toString(),
        resourceType: 'user',
        details: JSON.stringify({ email: updateUserDto.email, updatedFields }),
        status: 'success',
        method: 'PUT',
        path: '/users',
      });
      
      return savedUser;
    } catch (error) {
      this.logger.error(`UpdateUser error: ${error.message}`, error.stack);
      
      // Audit log for failed user update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'USER_UPDATE_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ email: updateUserDto.email, error: error.message }),
        status: 'error',
        method: 'PUT',
        path: '/users',
      });
      
      throw error;
    }
  }

  async deleteUser(email: string): Promise<void> {
    try {
      const user = await this.userModel.findOne({ email }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      const userId = user._id.toString();
      await this.userModel.deleteOne({ email }).exec();
      
      // Audit log for user deletion
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'USER_DELETED',
        userId: userId,
        resourceId: userId,
        resourceType: 'user',
        details: JSON.stringify({ email }),
        status: 'success',
        method: 'DELETE',
        path: '/users',
      });
    } catch (error) {
      this.logger.error(`DeleteUser error: ${error.message}`, error.stack);
      
      // Audit log for failed user deletion
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'USER_DELETION_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ email, error: error.message }),
        status: 'error',
        method: 'DELETE',
        path: '/users',
      });
      
      throw error;
    }
  }

  async updateProfile(updateProfileDto: UpdateProfileDto): Promise<User> {
    try {
      console.log('UpdateProfile called with:', updateProfileDto);
      const user = await this.userModel.findById({ id: updateProfileDto.userId }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updatedFields: string[] = [];
      if (updateProfileDto.name) {
        user.name = updateProfileDto.name;
        updatedFields.push('name');
      }
      if (updateProfileDto.bio) {
        user.bio = updateProfileDto.bio;
        updatedFields.push('bio');
      }
      if (updateProfileDto.profileImage) {
        user.profileImage = updateProfileDto.profileImage;
        updatedFields.push('profileImage');
      }
      if (updateProfileDto.preferredLanguage) {
        user.preferredLanguage = updateProfileDto.preferredLanguage;
        updatedFields.push('preferredLanguage');
      }
      if (updateProfileDto.preferredCurrency) {
        user.preferredCurrency = updateProfileDto.preferredCurrency;
        updatedFields.push('preferredCurrency');
      }

      const savedUser = await user.save();
      
      // Audit log for profile update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'PROFILE_UPDATED',
        userId: updateProfileDto.userId,
        resourceId: updateProfileDto.userId,
        resourceType: 'user',
        details: JSON.stringify({ updatedFields }),
        status: 'success',
        method: 'PUT',
        path: '/users/profile',
      });

      return savedUser;
    } catch (error) {
      this.logger.error(`UpdateProfile error: ${error.message}`, error.stack);
      
      // Audit log for failed profile update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'PROFILE_UPDATE_FAILED',
        userId: updateProfileDto.userId,
        resourceType: 'user',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'PUT',
        path: '/users/profile',
      });
      
      throw error;
    }
  }


// New: Update Personal Details
  async updatePersonalDetails(data: { userId: string } & Partial<PersonalDetailsDto>): Promise<User> {
    try {
      const user = await this.userModel.findById(data.userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updatedFields: string[] = [];
      if (data.name) {
        user.name = data.name;
        updatedFields.push('name');
      }
      if (data.residentialAddress !== undefined) {
        user.residentialAddress = data.residentialAddress;
        updatedFields.push('residentialAddress');
      }
      if (data.gender !== undefined) {
        user.gender = data.gender;
        updatedFields.push('gender');
      }
      if (data.emergencyContactName !== undefined) {
        user.emergencyContactName = data.emergencyContactName;
        updatedFields.push('emergencyContactName');
      }
      if (data.emergencyContactNumber !== undefined) {
        user.emergencyContactNumber = data.emergencyContactNumber;
        updatedFields.push('emergencyContactNumber');
      }
      if (data.emergencyContactAddress !== undefined) {
        user.emergencyContactAddress = data.emergencyContactAddress;
        updatedFields.push('emergencyContactAddress');
      }
      if (data.bloodType !== undefined) {
        user.bloodType = data.bloodType;
        updatedFields.push('bloodType');
      }
      if (data.allergies !== undefined) {
        user.allergies = data.allergies;
        updatedFields.push('allergies');
      }

      const savedUser = await user.save();
      
      // Audit log for personal details update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'PERSONAL_DETAILS_UPDATED',
        userId: data.userId,
        resourceId: data.userId,
        resourceType: 'user',
        details: JSON.stringify({ updatedFields }),
        status: 'success',
        method: 'PUT',
        path: '/users/personal-details',
      });

      return savedUser;
    } catch (error) {
      this.logger.error(`UpdatePersonalDetails error: ${error.message}`, error.stack);
      
      // Audit log for failed personal details update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'PERSONAL_DETAILS_UPDATE_FAILED',
        userId: data.userId,
        resourceType: 'user',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'PUT',
        path: '/users/personal-details',
      });
      
      throw error;
    }
  }

// New: Update Account Settings
  async updateAccountSettings(data: { userId: string } & Partial<AccountSettingsDto>): Promise<User> {
    try {
      const user = await this.userModel.findById(data.userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updatedFields: string[] = [];
      if (data.email) {
        user.email = data.email;
        updatedFields.push('email');
      }
      if (data.twoFactorEnabled !== undefined) {
        user.twoFactorEnabled = data.twoFactorEnabled;
        updatedFields.push('twoFactorEnabled');
      }
      if (data.linkedAccounts) {
        user.linkedAccounts = { ...user.linkedAccounts, ...data.linkedAccounts };
        updatedFields.push('linkedAccounts');
      }
      if (data.profileVisibility !== undefined) {
        user.profileVisibility = data.profileVisibility;
        updatedFields.push('profileVisibility');
      }

      const savedUser = await user.save();
      
      // Audit log for account settings update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ACCOUNT_SETTINGS_UPDATED',
        userId: data.userId,
        resourceId: data.userId,
        resourceType: 'user',
        details: JSON.stringify({ updatedFields }),
        status: 'success',
        method: 'PUT',
        path: '/users/account-settings',
      });

      return savedUser;
    } catch (error) {
      this.logger.error(`UpdateAccountSettings error: ${error.message}`, error.stack);
      
      // Audit log for failed account settings update
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ACCOUNT_SETTINGS_UPDATE_FAILED',
        userId: data.userId,
        resourceType: 'user',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'PUT',
        path: '/users/account-settings',
      });
      
      throw error;
    }
  }

// New: Deactivate Account
  async deactivateAccount(data: { userId: string }): Promise<User> {
    try {
      const user = await this.userModel.findById(data.userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      user.isDeactivated = true;
      const savedUser = await user.save();
      
      // Audit log for account deactivation
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ACCOUNT_DEACTIVATED',
        userId: data.userId,
        resourceId: data.userId,
        resourceType: 'user',
        details: JSON.stringify({ email: user.email }),
        status: 'success',
        method: 'POST',
        path: '/users/deactivate',
      });

      return savedUser;
    } catch (error) {
      this.logger.error(`DeactivateAccount error: ${error.message}`, error.stack);
      
      // Audit log for failed account deactivation
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ACCOUNT_DEACTIVATION_FAILED',
        userId: data.userId,
        resourceType: 'user',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/users/deactivate',
      });
      
      throw error;
    }
  }

  // New: Delete Account (soft delete or hard)
  async deleteAccount(userId: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId).exec();
      const email = user?.email;
      
      await this.userModel.findByIdAndDelete(userId).exec();
      
      // Audit log for account deletion
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ACCOUNT_DELETED',
        userId: userId,
        resourceId: userId,
        resourceType: 'user',
        details: JSON.stringify({ email }),
        status: 'success',
        method: 'DELETE',
        path: '/users/account',
      });
    } catch (error) {
      this.logger.error(`DeleteAccount error: ${error.message}`, error.stack);
      
      // Audit log for failed account deletion
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'ACCOUNT_DELETION_FAILED',
        userId: userId,
        resourceType: 'user',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'DELETE',
        path: '/users/account',
      });
      
      throw error;
    }
  }

// New: Create subscription with Stripe checkout
  async createSubscription(data: CreateSubscriptionDto & { userId: string }): Promise<{ url: string }> {
    try {
      const { userId, plan } = data;
      let user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          metadata: { userId: userId },
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Create checkout session
      const prices = {
        basic: process.env.STRIPE_BASIC_PRICE_ID, // Set in env
        premium: process.env.STRIPE_PREMIUM_PRICE_ID,
      };
      const priceId = prices[plan];
      if (!priceId) {
        throw new BadRequestException('Invalid plan');
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        metadata: { userId, plan },
      });

      // Audit log for subscription checkout initiated
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'SUBSCRIPTION_CHECKOUT_INITIATED',
        userId: userId,
        resourceId: userId,
        resourceType: 'subscription',
        details: JSON.stringify({ plan, sessionId: session.id }),
        status: 'success',
        method: 'POST',
        path: '/users/subscription',
      });

      return { url: session.url };
    } catch (error) {
      this.logger.error(`CreateSubscription error: ${error.message}`, error.stack);
      
      // Audit log for failed subscription checkout
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'SUBSCRIPTION_CHECKOUT_FAILED',
        userId: data.userId,
        resourceType: 'subscription',
        details: JSON.stringify({ plan: data.plan, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/users/subscription',
      });
      
      throw error;
    }
  }

  // New: Get subscription details
  async getSubscription(userId: string): Promise<any> {
    try {
      const user = await this.userModel.findById(userId).select('plan isSubscribed subscriptionId subscriptionEndDate').exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return {
        plan: user.plan,
        isActive: user.isSubscribed && (!user.subscriptionEndDate || new Date() < user.subscriptionEndDate),
        endDate: user.subscriptionEndDate,
        stripeSubscriptionId: user.subscriptionId,
      };
    } catch (error) {
      this.logger.error(`GetSubscription error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // New: Update subscription (similar to create, for upgrades)
  async updateSubscription(data: CreateSubscriptionDto & { userId: string }): Promise<{ url: string }> {
    // Similar to createSubscription, but cancel existing if needed
    return this.createSubscription(data); // For simplicity; enhance for upgrades
  }

  // Updated: Handle Stripe webhook
  async handleStripeWebhook(event: any): Promise<void> {
    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const plan = session.metadata.plan;
        const user = await this.userModel.findById(userId).exec();
        if (user) {
          user.plan = plan;
          user.isSubscribed = true;
          user.subscriptionId = session.subscription as string;
          // Set endDate based on plan duration; for monthly, add 1 month
          user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Example
          await user.save();
          this.logger.log(`Subscription activated for user: ${userId}, plan: ${plan}`);
          
          // Audit log for subscription activated
          await this.emitAuditLog({
            serviceName: 'user-service',
            action: 'SUBSCRIPTION_ACTIVATED',
            userId: userId,
            resourceId: userId,
            resourceType: 'subscription',
            details: JSON.stringify({ plan, subscriptionId: session.subscription }),
            status: 'success',
            method: 'WEBHOOK',
            path: '/webhook/stripe',
          });
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const user = await this.userModel.findOne({ subscriptionId: subscription.id }).exec();
        if (user) {
          const previousPlan = user.plan;
          user.plan = 'free';
          user.isSubscribed = false;
          user.subscriptionId = null;
          user.subscriptionEndDate = null;
          await user.save();
          this.logger.log(`Subscription cancelled for user: ${user._id}`);
          
          // Audit log for subscription cancelled
          await this.emitAuditLog({
            serviceName: 'user-service',
            action: 'SUBSCRIPTION_CANCELLED',
            userId: user._id.toString(),
            resourceId: user._id.toString(),
            resourceType: 'subscription',
            details: JSON.stringify({ previousPlan, subscriptionId: subscription.id }),
            status: 'success',
            method: 'WEBHOOK',
            path: '/webhook/stripe',
          });
        }
      } else if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const user = await this.userModel.findOne({ subscriptionId: subscription.id }).exec();
        if (user) {
          const previousPlan = user.plan;
          user.plan = subscription.items.data[0].price.metadata.plan || user.plan;
          user.isSubscribed = subscription.status === 'active';
          if (subscription.current_period_end) {
            user.subscriptionEndDate = new Date(subscription.current_period_end * 1000);
          }
          await user.save();
          this.logger.log(`Subscription updated for user: ${user._id}, status: ${subscription.status}`);
          
          // Audit log for subscription updated
          await this.emitAuditLog({
            serviceName: 'user-service',
            action: 'SUBSCRIPTION_UPDATED',
            userId: user._id.toString(),
            resourceId: user._id.toString(),
            resourceType: 'subscription',
            details: JSON.stringify({ previousPlan, newPlan: user.plan, status: subscription.status }),
            status: 'success',
            method: 'WEBHOOK',
            path: '/webhook/stripe',
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Webhook error: ${error.message}`, error.stack);
      
      // Audit log for webhook error
      await this.emitAuditLog({
        serviceName: 'user-service',
        action: 'WEBHOOK_PROCESSING_FAILED',
        resourceType: 'subscription',
        details: JSON.stringify({ eventType: event?.type, error: error.message }),
        status: 'error',
        method: 'WEBHOOK',
        path: '/webhook/stripe',
      });
      
      throw new BadRequestException('Webhook handling failed');
    }
  }

  // Updated: Helper method to check subscription access (use plan levels: free=0, basic=1, premium=2)
  async checkSubscriptionAccess(userId: string, requiredLevel: number = 0): Promise<boolean> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) return false;

      const planLevels = { free: 0, basic: 1, premium: 2 };
      const userLevel = planLevels[user.plan] || 0;

      if (userLevel < requiredLevel) return false;

      // Check if active
      if (user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
        user.plan = 'free';
        user.isSubscribed = false;
        await user.save();
        return false;
      }

      return user.isSubscribed || user.plan === 'free'; // Free always active
    } catch (error) {
      this.logger.error(`CheckSubscriptionAccess error: ${error.message}`, error.stack);
      return false;
    }
  }

}