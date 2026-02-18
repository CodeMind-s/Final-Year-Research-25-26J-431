import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { LandOwnerDetails } from './schemas/land-owner-details.schema';
import { ServiceProviderDetails } from './schemas/service-provider-details.schema';
import { LaboratoryDetails } from './schemas/laboratory-details.schema';
import { SignInDto, VerifyOtpDto, OnboardingDto, OAuthProfileDto, AuthResponseDto } from './dtos/auth.dto';
import axios from 'axios';
import { ClientKafka } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { SubscriptionService } from './subscription/subscription.service';

const otpStore = new Map<string, { code: string; role: string }>(); // In-memory OTP store

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
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly notifyLkConfig: {
    userId: string;
    apiKey: string;
    senderId: string;
    baseUrl: string;
  };

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(LandOwnerDetails.name) private landOwnerModel: Model<LandOwnerDetails>,
    @InjectModel(ServiceProviderDetails.name) private serviceProviderModel: Model<ServiceProviderDetails>,
    @InjectModel(LaboratoryDetails.name) private laboratoryModel: Model<LaboratoryDetails>,
    @Inject('EMAIL_SERVICE') private readonly emailClient: ClientKafka,
    @Inject('AUDIT_LOG_SERVICE') private readonly auditLogClient: ClientKafka,
    private jwtService: JwtService,
    private subscriptionService: SubscriptionService,
  ) {
    this.notifyLkConfig = {
      userId: process.env.NOTIFY_LK_USER_ID || '',
      apiKey: process.env.NOTIFY_LK_API_KEY || '',
      senderId: process.env.NOTIFY_LK_SENDER_ID || 'NotifyDEMO',
      baseUrl: 'https://app.notify.lk/api/v1',
    };
    if (!this.notifyLkConfig.userId || !this.notifyLkConfig.apiKey) {
      this.logger.warn('Notify.lk credentials not configured. SMS sending will fail.');
    }
  }

  /**
   * Sends an SMS via Notify.lk API
   */
  private async sendSmsViaNofityLk(to: string, message: string): Promise<any> {
    // Notify.lk expects phone numbers in format 94XXXXXXXXX (no + prefix)
    const formattedPhone = to.replace(/^\+/, '');
    const response = await axios.post(`${this.notifyLkConfig.baseUrl}/send`, null, {
      params: {
        user_id: this.notifyLkConfig.userId,
        api_key: this.notifyLkConfig.apiKey,
        sender_id: this.notifyLkConfig.senderId,
        to: formattedPhone,
        message,
      },
    });
    if (response.data?.status !== 'success') {
      throw new Error(`Notify.lk SMS failed: ${JSON.stringify(response.data)}`);
    }
    return response.data;
  }

  /**
   * Emits an audit log event to the audit-log-service via Kafka
   */
  private async emitAuditLog(data: AuditLogData): Promise<void> {
    try {
      await this.auditLogClient.emit('create_audit_log', {
        ...data,
        serviceName: 'auth-service',
      }).toPromise();
      this.logger.debug(`Audit log emitted: ${data.action}`);
    } catch (error: any) {
      this.logger.error(`Failed to emit audit log: ${error.message}`);
    }
  }

  async signIn(dto: SignInDto): Promise<any> {
    const identifier = dto.email || dto.phone;
    try {
      const { email, phone } = dto;
      if (!identifier) throw new BadRequestException('Email or phone required');

      // Check if user exists (for logging, not blocking)
      const existingUser = await this.userModel.findOne({ email, phone });
      this.logger.log(`SignIn attempt for ${identifier}, existing user: ${!!existingUser}`);

      const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      otpStore.set(identifier, { code, role: dto.role });
      this.logger.debug(`Generated OTP ${code} for ${identifier} with role ${dto.role}`);

      if (email) {
        const emailRes = await this.emailClient.emit('send_verification_code_email', {
          user: { email },
          code,
        }).toPromise();
        this.logger.log(`Email OTP request sent to email-service for ${emailRes}`);
        this.logger.log(`Email OTP sent to ${email}`);

        // Audit log for successful OTP send
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'SIGN_IN_OTP_SENT',
          userId: existingUser?._id?.toString(),
          resourceType: 'user',
          details: JSON.stringify({ email, method: 'email', isExistingUser: !!existingUser }),
          status: 'success',
          method: 'POST',
          path: '/auth/sign-in',
        });

        return { success: emailRes ? true : false, user: email };
      } else if (phone) {
        // Send OTP via SMS using Notify.lk
        const smsResult = await this.sendSmsViaNofityLk(
          phone,
          `Your Brinex verification code is ${code}. It is valid for 10 minutes.`,
        );
        this.logger.log(`SMS OTP sent to ${phone} via Notify.lk: ${JSON.stringify(smsResult)}`);

        // Audit log for successful OTP send via SMS
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'SIGN_IN_OTP_SENT',
          userId: existingUser?._id?.toString(),
          resourceType: 'user',
          details: JSON.stringify({ phone, method: 'sms', isExistingUser: !!existingUser }),
          status: 'success',
          method: 'POST',
          path: '/auth/sign-in',
        });

        return { success: smsResult ? true : false, user: phone };
      } else {
        throw new BadRequestException('Must provide email or phone');
      }
    } catch (error: any) {
      this.logger.error(`SignIn failed for ${dto.email || dto.phone}: ${error.message}`, error.stack);

      // Audit log for failed sign-in
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'SIGN_IN_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ identifier, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/auth/sign-in',
      });

      if (error.message?.includes('Invalid phone') || error.message?.includes('invalid number')) {
        throw new BadRequestException('Invalid phone number');
      } else if (error.message?.includes('Invalid email')) {
        throw new BadRequestException('Invalid email address');
      } else {
        throw new InternalServerErrorException('Failed to send OTP');
      }
    }
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    const identifier = dto.email || dto.phone;
    try {
      const { email, phone, code } = dto;
      if (!identifier) throw new BadRequestException('Email or phone required');

      const storedData = otpStore.get(identifier);
      if (!storedData) throw new UnauthorizedException('OTP expired or not found');
      if (code !== storedData.code) throw new UnauthorizedException('Invalid OTP');

      const query = email ? { email } : { phone };
      let user = await this.userModel.findOne(query) as any | null;

      const isNewUser = !user;
      if (isNewUser) {
        user = new this.userModel({
          email,
          phone,
          role: storedData.role,
          isOnboarded: false,
          plan: 'free',
          isSubscribed: false,
          isVerified: false,
        });
        await user.save();
        this.logger.log(`New user created: ${user._id}`);

        // Start trial or assign lab plan based on role
        if (storedData.role === 'LABORATORY') {
          await this.subscriptionService.createSubscription(user._id.toString(), 'lab', 'free');
          this.logger.log(`Lab plan assigned to LABORATORY user ${user._id}`);
        } else {
          await this.subscriptionService.startProTrial(user._id.toString());
          this.logger.log(`Pro trial started for user ${user._id}`);
        }

        // Re-fetch user to get updated plan fields
        user = await this.userModel.findById(user._id);

        // Audit log for new user signup
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'USER_SIGNUP',
          userId: user._id.toString(),
          resourceId: user._id.toString(),
          resourceType: 'user',
          details: JSON.stringify({ email, phone, role: storedData.role }),
          status: 'success',
          method: 'POST',
          path: '/auth/verify-otp',
        });
      }

      const payload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        plan: user.plan,
        isTrialActive: user.isTrialActive,
      };
      const accessToken = this.jwtService.sign(payload);

      otpStore.delete(identifier); // Clear OTP
      this.logger.log(`OTP verified for ${identifier}, user: ${user._id}`);

      // Audit log for successful OTP verification (login)
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: isNewUser ? 'USER_SIGNUP_VERIFIED' : 'USER_LOGIN',
        userId: user._id.toString(),
        resourceId: user._id.toString(),
        resourceType: 'user',
        details: JSON.stringify({ email, phone, isNewUser }),
        status: 'success',
        method: 'POST',
        path: '/auth/verify-otp',
      });

      return { accessToken, isNewUser, isOnboarded: user.isOnboarded };
    } catch (error: any) {
      // Audit log for failed OTP verification
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'OTP_VERIFICATION_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ identifier, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/auth/verify-otp',
      });

      if (error instanceof UnauthorizedException || error.message.includes('Invalid OTP')) {
        throw new UnauthorizedException('Invalid OTP');
      } else if (error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException('OTP verification failed');
      }
    }
  }

  async completeOnboarding(userId: string, dto: OnboardingDto): Promise<any> {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { ...dto, isOnboarded: true },
        { new: true }
      );
      if (!user) throw new BadRequestException('User not found');
      this.logger.log(`Onboarding completed for user: ${userId}`);

      // Audit log for successful onboarding (DB update)
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'USER_ONBOARDING_COMPLETED',
        userId: userId,
        resourceId: userId,
        resourceType: 'user',
        details: JSON.stringify({ updatedFields: Object.keys(dto) }),
        status: 'success',
        method: 'PUT',
        path: '/auth/onboarding',
      });

      return user;
    } catch (error: any) {
      this.logger.error(`CompleteOnboarding failed for ${userId}: ${error.message}`, error.stack);

      // Audit log for failed onboarding
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'USER_ONBOARDING_FAILED',
        userId: userId,
        resourceType: 'user',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'PUT',
        path: '/auth/onboarding',
      });

      if (error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException('Onboarding failed');
      }
    }
  }

  async oAuthSignIn(data: OAuthProfileDto): Promise<AuthResponseDto> {
    try {
      const { email, name, providerId, provider } = data;
      let user = await this.userModel.findOne({ [provider === 'google' ? 'googleId' : 'facebookId']: providerId }) as any | null;
      let isNewUser = false;

      if (!user) {
        user = await this.userModel.findOne({ email });
      }

      if (!user) {
        isNewUser = true;
        user = new this.userModel({
          email,
          name,
          [provider === 'google' ? 'googleId' : 'facebookId']: providerId,
          role: 'LANDOWNER',
          isOnboarded: false,
          plan: 'free',
          linkedAccounts: { [provider]: true },
        });
        await user.save();

        // Start Pro trial for new OAuth users (non-LABORATORY default)
        await this.subscriptionService.startProTrial(user._id.toString());
        this.logger.log(`Pro trial started for new OAuth user ${user._id}`);

        // Re-fetch user to get updated plan fields
        user = await this.userModel.findById(user._id);

        // Audit log for new OAuth user signup
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'OAUTH_USER_SIGNUP',
          userId: user._id.toString(),
          resourceId: user._id.toString(),
          resourceType: 'user',
          details: JSON.stringify({ email, provider, isNewUser: true }),
          status: 'success',
          method: 'POST',
          path: '/auth/oauth',
        });
      } else {
        // Update linked account
        user.linkedAccounts = { ...user.linkedAccounts, [provider]: true };
        if (!user.name) user.name = name;
        await user.save();

        // Audit log for OAuth login with linked account update
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'OAUTH_USER_LOGIN',
          userId: user._id.toString(),
          resourceId: user._id.toString(),
          resourceType: 'user',
          details: JSON.stringify({ email, provider, linkedAccountUpdated: true }),
          status: 'success',
          method: 'POST',
          path: '/auth/oauth',
        });
      }

      const payload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        plan: user.plan,
        isTrialActive: user.isTrialActive,
      };
      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        isNewUser,
        isOnboarded: user.isOnboarded,
      };
    } catch (error: any) {
      this.logger.error(`OAuthSignIn error: ${error.message}`, error.stack);

      // Audit log for failed OAuth sign-in
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'OAUTH_LOGIN_FAILED',
        resourceType: 'user',
        details: JSON.stringify({ email: data.email, provider: data.provider, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/auth/oauth',
      });
      throw new InternalServerErrorException('OAuth sign-in failed');
    }
  }

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    try {
      const user = await this.userModel.findOne({ email });
      if (!user || !await bcrypt.compare(password, user.password || '')) {
        // Audit log for failed login
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'ADMIN_LOGIN_FAILED',
          resourceType: 'user',
          details: JSON.stringify({ email, reason: 'Invalid credentials' }),
          status: 'error',
          method: 'POST',
          path: '/auth/login',
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        plan: user.plan,
        isTrialActive: user.isTrialActive,
      };
      const token = this.jwtService.sign(payload);

      const userResponse = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isOnboarded: user.isOnboarded,
        plan: user.plan,
        isSubscribed: user.isSubscribed,
      };

      this.logger.log(`Login successful for ${email} with role: ${user.role}`);

      // Audit log for successful login
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'ADMIN_LOGIN_SUCCESS',
        userId: user._id.toString(),
        resourceId: user._id.toString(),
        resourceType: 'user',
        details: JSON.stringify({ email, role: user.role }),
        status: 'success',
        method: 'POST',
        path: '/auth/login',
      });

      return { token, user: userResponse };
    } catch (error) {
      this.logger.error(`Login failed for ${email}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Delegated to SubscriptionService
  async createSubscription(data: { userId: string; planKey: string; paymentMethod?: string }): Promise<any> {
    const subscription = await this.subscriptionService.createSubscription(
      data.userId,
      data.planKey,
      data.paymentMethod || 'free',
    );
    return { success: true, message: 'Subscription created', subscription };
  }

  async getSubscription(userId: string): Promise<any> {
    const subscription = await this.subscriptionService.getActiveSubscription(userId);
    return {
      success: true,
      message: subscription ? 'Subscription fetched' : 'No active subscription',
      subscription: subscription || null,
    };
  }

  async getPlans(): Promise<any> {
    const plans = await this.subscriptionService.getPlans();
    return { success: true, plans };
  }

  async getPlan(planKey: string): Promise<any> {
    const plan = await this.subscriptionService.getPlan(planKey);
    if (!plan) {
      throw new BadRequestException(`Plan not found: ${planKey}`);
    }
    return { success: true, plan };
  }

  async updateSubscription(userId: string, planKey: string): Promise<any> {
    const subscription = await this.subscriptionService.createSubscription(userId, planKey, 'manual');
    return { success: true, message: 'Subscription updated', subscription };
  }

  async checkFeatureAccess(userId: string, featureKey: string, userRole: string): Promise<any> {
    return this.subscriptionService.checkFeatureAccess(userId, featureKey, userRole);
  }

  // Admin Plan CRUD — delegated to SubscriptionService
  async createPlan(data: any): Promise<any> {
    const planData = {
      key: data.key,
      name: data.name,
      level: data.level,
      priceMonthlyLKR: data.price_monthly_lkr ?? data.priceMonthlyLKR ?? 0,
      priceAnnualLKR: data.price_annual_lkr ?? data.priceAnnualLKR ?? 0,
      featureKeys: data.feature_keys ?? data.featureKeys ?? [],
      duration: data.duration,
    };
    const plan = await this.subscriptionService.createPlan(planData);
    return { success: true, message: 'Plan created', plan };
  }

  async updatePlan(key: string, data: any): Promise<any> {
    const updates: any = {};
    if (data.name) updates.name = data.name;
    if (data.level) updates.level = data.level;
    if (data.price_monthly_lkr !== undefined && data.price_monthly_lkr !== 0) {
      updates.priceMonthlyLKR = data.price_monthly_lkr;
    } else if (data.priceMonthlyLKR !== undefined) {
      updates.priceMonthlyLKR = data.priceMonthlyLKR;
    }
    if (data.price_annual_lkr !== undefined && data.price_annual_lkr !== 0) {
      updates.priceAnnualLKR = data.price_annual_lkr;
    } else if (data.priceAnnualLKR !== undefined) {
      updates.priceAnnualLKR = data.priceAnnualLKR;
    }
    if (data.feature_keys?.length) {
      updates.featureKeys = data.feature_keys;
    } else if (data.featureKeys?.length) {
      updates.featureKeys = data.featureKeys;
    }
    if (data.duration) updates.duration = data.duration;
    if (data.is_active !== undefined) {
      updates.isActive = data.is_active;
    } else if (data.isActive !== undefined) {
      updates.isActive = data.isActive;
    }

    const plan = await this.subscriptionService.updatePlan(key, updates);
    return { success: true, message: 'Plan updated', plan };
  }

  async deletePlan(key: string): Promise<any> {
    await this.subscriptionService.deletePlan(key);
    return { success: true, message: `Plan '${key}' deactivated` };
  }

  async getPersonalDetail(userId: string): Promise<any> {
    try {
      const user = await this.userModel.findById(userId).select('-password -__v -googleId -facebookId -linkedAccounts');
      if (!user) {
        throw new BadRequestException('User not found');
      }

      let roleDetails = null;
      if (user.role === 'LANDOWNER') {
        roleDetails = await this.landOwnerModel.findOne({ userId }).exec();
      } else if (user.role === 'SERVICE_PROVIDER' || user.role === 'DISTRIBUTOR') {
        roleDetails = await this.serviceProviderModel.findOne({ userId }).exec();
      } else if (user.role === 'LABORATORY') {
        roleDetails = await this.laboratoryModel.findOne({ userId }).exec();
      }

      return {
        success: true,
        user,
        landOwnerDetails: user.role === 'LANDOWNER' ? roleDetails : null,
        distributorDetails: user.role === 'DISTRIBUTOR' ? roleDetails : null,
        serviceProviderDetails: user.role === 'SERVICE_PROVIDER' ? roleDetails : null,
        laboratoryDetails: user.role === 'LABORATORY' ? roleDetails : null,
      };
    } catch (error: any) {
      this.logger.error(`GetPersonalDetails error for ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
