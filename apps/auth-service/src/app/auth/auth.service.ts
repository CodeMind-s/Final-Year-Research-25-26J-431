import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { SignInDto, VerifyOtpDto, OnboardingDto, OAuthProfileDto, AuthResponseDto, CreateSubscriptionDto, PlanDto } from './dtos/auth.dto';
import axios from 'axios';
import { ClientKafka } from '@nestjs/microservices';
import Stripe from 'stripe';
import * as bcrypt from 'bcrypt';
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
  private stripe: Stripe;
  private readonly notifyLkConfig: {
    userId: string;
    apiKey: string;
    senderId: string;
    baseUrl: string;
  };

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject('EMAIL_SERVICE') private readonly emailClient: ClientKafka,
    @Inject('AUDIT_LOG_SERVICE') private readonly auditLogClient: ClientKafka,
    private jwtService: JwtService,
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

    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-29.clover' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured. Subscription features will be unavailable.');
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
      console.log("OTP verified for identifier: ", dto);
      const query = email ? { email } : { phone };
      let user = await this.userModel.findOne(query) as any | null;

      console.log("User after OTP verification: ", user);
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

        // Audit log for new user signup
        await this.emitAuditLog({
          serviceName: 'auth-service',
          action: 'USER_SIGNUP',
          userId: user._id.toString(),
          resourceId: user._id.toString(),
          resourceType: 'user',
          details: JSON.stringify({ email, phone, role: 'SELLER' }),
          status: 'success',
          method: 'POST',
          path: '/auth/verify-otp',
        });
      }

      const payload = { sub: user._id.toString(), email: user.email, role: user.role };
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


  // async oAuthSignIn(profile: OAuthProfileDto): Promise<AuthResponseDto> {
  //   try {
  //     let user = await this.userModel.findOne({ [profile.provider === 'google' ? 'googleId' : 'facebookId']: profile.providerId }) as any;
  //     const isNewUser = !user;
  //     if (isNewUser) {
  //       user = new this.userModel({ 
  //         email: profile.email, 
  //         name: profile.name,
  //         [profile.provider === 'google' ? 'googleId' : 'facebookId']: profile.providerId,
  //         role: 'user', 
  //         isOnboarded: false 
  //       });
  //       await user.save();
  //       this.logger.log(`New OAuth user created: ${user._id} via ${profile.provider}`);
  //     }else {
  //       // Update linked account
  //       user.linkedAccounts = { ...user.linkedAccounts, [provider]: true };
  //       if (!user.name) user.name = name;
  //       await user.save();
  //     }

  //     const payload = { sub: user._id.toString(), email: user.email, role: user.role };
  //     const accessToken = this.jwtService.sign(payload);
  //     return { accessToken, isNewUser, isOnboarded: user.isOnboarded };
  //   } catch (error:any) {
  //     this.logger.error(`OAuthSignIn failed for ${profile.provider}: ${error.message}`, error.stack);
  //     throw new InternalServerErrorException('OAuth sign-in failed');
  //   }
  // }

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
          role: 'SELLER',
          isOnboarded: false,
          plan: 'free',
          linkedAccounts: { [provider]: true },
        });
        await user.save();

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

      const payload = { sub: user._id.toString(), email: user.email, role: user.role };
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
      console.log('Login attempt for:', email);
      console.log('Password provided:', password);
      const user = await this.userModel.findOne({ email });
      console.log('User found:', user);
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

      // Role-based: admin/superadmin get full access; no extra gating here (handled in guards)
      const payload = { sub: user._id.toString(), email: user.email, role: user.role };
      const token = this.jwtService.sign(payload);

      // Return user with role for frontend (e.g., show admin dashboard)
      const userResponse = {
        id: user._id.toString(),
        email: user.email,
        role: user.role, // 'admin' or 'superadmin'
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

  // New: Create subscription with Stripe
  async createSubscription(data: CreateSubscriptionDto): Promise<any> {
    try {
      if (!this.stripe) {
        throw new InternalServerErrorException('Stripe is not configured. Set STRIPE_SECRET_KEY.');
      }
      const { userId, plan } = data;
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Stripe customer creation removed due to schema change
      // let customerId = user.stripeCustomerId;
      // if (!customerId) {
      //   const customer = await this.stripe.customers.create({
      //     email: user.email,
      //     metadata: { userId },
      //   });
      //   customerId = customer.id;
      //   user.stripeCustomerId = customerId;
      //   await user.save();
      // }
      throw new InternalServerErrorException('Subscription creation currently disabled due to schema update');

      const prices = {
        basic: process.env.STRIPE_BASIC_PRICE_ID,
        premium: process.env.STRIPE_PREMIUM_PRICE_ID,
      };
      const priceId = prices[plan];
      if (!priceId) {
        throw new BadRequestException('Invalid plan');
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: 'dummy_customer_id', // Placeholder due to schema change
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        metadata: { userId, plan },
      });

      // Audit log for subscription creation
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'SUBSCRIPTION_CHECKOUT_INITIATED',
        userId: userId,
        resourceId: session.id,
        resourceType: 'subscription',
        details: JSON.stringify({ plan, stripeSessionId: session.id }),
        status: 'success',
        method: 'POST',
        path: '/auth/subscription',
      });

      return { success: true, message: 'Checkout initiated', checkoutUrl: session.url };
    } catch (error: any) {
      this.logger.error(`CreateSubscription error: ${error.message}`, error.stack);

      // Audit log for failed subscription creation
      await this.emitAuditLog({
        serviceName: 'auth-service',
        action: 'SUBSCRIPTION_CHECKOUT_FAILED',
        userId: data.userId,
        resourceType: 'subscription',
        details: JSON.stringify({ plan: data.plan, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/auth/subscription',
      });

      throw error;
    }
  }

  // New: Get subscription
  async getSubscription(userId: string): Promise<any> {
    try {
      const user = await this.userModel.findById(userId).select('plan isSubscribed subscriptionId subscriptionEndDate createdAt');
      if (!user) {
        throw new BadRequestException('User not found');
      }
      console.log('User subscription details:', user);
      const timestamp = (date: Date | null): any => {
        if (!date) return null;
        const seconds = Math.floor(date.getTime() / 1000);
        const nanos = Math.floor((date.getTime() % 1000) * 1e6);
        return { seconds, nanos };
      };
      return {
        success: true,
        message: 'Subscription fetched',
        subscription: {
          id: (user as any).subscriptionId || 'no-id',
          userId,
          planId: user.plan,
          plan: { name: user.plan.charAt(0).toUpperCase() + user.plan.slice(1), level: { free: 0, basic: 1, premium: 2 }[user.plan] },
          status: user.isSubscribed ? 'active' : 'inactive',
          start_date: timestamp((user as any).createdAt),
          end_date: timestamp((user as any).subscriptionEndDate),
        },
      };
    } catch (error: any) {
      this.logger.error(`GetSubscription error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // New: Get plans (hardcoded for simplicity; use DB in production)
  async getPlans(): Promise<any> {
    const plans: PlanDto[] = [
      { id: 'free', name: 'Free', level: 0, price: 0, features: ['Basic trip viewing'], duration: 'lifetime' },
      { id: 'basic', name: 'Basic', level: 1, price: 9.99, features: ['Create trips', 'Personalized recs'], duration: 'monthly' },
      { id: 'premium', name: 'Premium', level: 2, price: 19.99, features: ['Advanced planning', 'Priority support'], duration: 'monthly' },
    ];
    return { success: true, plans };
  }

  // New: Get plan
  async getPlan(planId: string): Promise<any> {
    try {
      console.log('Fetching plan for ID:', planId); // Temp debug log

      const plans = await this.getPlans();
      let plan = plans.plans.find(p => p.id.toLowerCase() === planId.toLowerCase()); // Case-insensitive match
      if (!plan) {
        console.warn(`Plan not found for ID: ${planId}. Falling back to free plan.`); // Temp log
        plan = plans.plans.find(p => p.id === 'free') || { id: 'free', name: 'Free', level: 0, price: 0, features: ['Basic access'], duration: 'lifetime' }; // Fallback
      }

      return { success: true, plan };
    } catch (error: any) {
      this.logger.error(`GetPlan error for ${planId}: ${error.message}`, error.stack);
      throw new BadRequestException('Plan not found');
    }
  }

  // New: Update subscription
  async updateSubscription(subscriptionId: string, planId: string): Promise<any> {
    try {
      const user = await this.userModel.findOne({ subscriptionId });
      if (!user) {
        throw new BadRequestException('Subscription not found');
      }
      // For upgrade, create new checkout session similar to create
      const createData = { userId: user._id.toString(), plan: planId === 'basic' ? 'basic' : 'premium' };
      const result = await this.createSubscription(createData as CreateSubscriptionDto);
      return result;
    } catch (error: any) {
      this.logger.error(`UpdateSubscription error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPersonalDetail(userId: string): Promise<any> {
    try {
      const user = await this.userModel.findById(userId).select('-password -__v -googleId -facebookId -linkedAccounts');
      if (!user) {
        throw new BadRequestException('User not found');
      }
      return { success: true, user };
    } catch (error: any) {
      this.logger.error(`GetPersonalDetails error for ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
