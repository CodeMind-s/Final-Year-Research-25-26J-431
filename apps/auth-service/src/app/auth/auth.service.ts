import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { SignInDto, VerifyOtpDto, OnboardingDto, OAuthProfileDto, AuthResponseDto, CreateSubscriptionDto, PlanDto } from './dtos/auth.dto';
import twilio from 'twilio';
import { ClientKafka } from '@nestjs/microservices';
// import sgMail from '@twilio/email';
import Stripe from 'stripe';
import * as bcrypt from 'bcrypt';
const otpStore = new Map<string, string>(); // In-memory OTP store (use Redis in production)

@Injectable()
export class AuthService {
  private twilioClient: twilio.Twilio;
  // private sgMailClient: sgMail.MailService;
  private readonly logger = new Logger(AuthService.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject('EMAIL_SERVICE') private readonly emailClient: ClientKafka,

    private jwtService: JwtService,
  ) {
    try {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-09-30.clover' });
      //this.sgMailClient = sgMail(process.env.TWILIO_SENDGRID_API_KEY);
    } catch (error:any) {
      this.logger.error(`Failed to initialize Twilio clients: ${error.message}`);
      throw new InternalServerErrorException('Service initialization failed');
    }
  }

  async signIn(dto: SignInDto): Promise<any> {
    try {
      const { email, phone } = dto;
      const identifier = email || phone;
      if (!identifier) throw new BadRequestException('Email or phone required');

      // Check if user exists (for logging, not blocking)
      const existingUser = await this.userModel.findOne({ email, phone });
      this.logger.log(`SignIn attempt for ${identifier}, existing user: ${!!existingUser}`);

      const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      otpStore.set(identifier, code);
      this.logger.debug(`Generated OTP ${code} for ${identifier}`);

      if (email) {
        const emailRes = await this.emailClient.emit('send_verification_code_email', {
          user: { email },
          code,
        }).toPromise();
        this.logger.log(`Email OTP request sent to email-service for ${emailRes}`);
        // Send OTP via email using Twilio SendGrid
        // await this.sgMailClient.send({
        //   to: email,
        //   from: 'no-reply@yourdomain.com', // Replace with verified SendGrid sender
        //   subject: 'Your OTP Code',
        //   text: `Your OTP code is ${code}. It is valid for 10 minutes.`,
        // });
        this.logger.log(`Email OTP sent to ${email}`);
        return { success: emailRes ? true : false , user: email};
      } else if (phone) {
        // Send OTP via SMS using Twilio
        const message = await this.twilioClient.messages.create({
          body: `Your OTP code is ${code}. It is valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER, // Verified Twilio number
          to: phone,
        });
        this.logger.log(`SMS OTP sent to ${phone}, SID: ${message.sid}`);
        return { success: message ? true : false , user: phone};
      } else {
        throw new BadRequestException('Must provide email or phone');
      }

      // return { success: true , user: email? email : phone};
    } catch (error : any) {
      this.logger.error(`SignIn failed for ${dto.email || dto.phone}: ${error.message}`, error.stack);
      if (error.code === 21608) { // Twilio invalid phone number
        throw new BadRequestException('Invalid phone number');
      } else if (error.code === 30007) { // SendGrid invalid email
        throw new BadRequestException('Invalid email address');
      } else if (error.code >= 50000) { // Twilio/SendGrid server error
        throw new InternalServerErrorException('Failed to send OTP due to service error');
      } else {
        throw new InternalServerErrorException('Failed to send OTP');
      }
    }
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
    try {
      const { email, phone, code } = dto;
      const identifier = email || phone;
      if (!identifier) throw new BadRequestException('Email or phone required');

      const storedCode = otpStore.get(identifier);
      if (!storedCode) throw new UnauthorizedException('OTP expired or not found');
      if (code !== storedCode) throw new UnauthorizedException('Invalid OTP');
      console.log("OTP verified for identifier: ", dto);
      const query = email ? { email } : { phone };
      let user = await this.userModel.findOne(query) as any | null;
      //let user : any;
      // if(email) {
      //   user = await this.userModel.findOne({ email }).exec() ;
      // }else{
      //   user = await this.userModel.findOne({ phone }).exec() ;
      // }
      //let user = await this.userModel.findOne({ email }).exec() as any;

      //let user = await this.userModel.findOne({ $or: [{ email: email }, { phone:phone }] }).exec() as any | null;
      console.log("User after OTP verification: ", user);
      const isNewUser = !user;
      if (isNewUser) {
        user = new this.userModel({ 
          email, 
          phone, 
          role: 'TRAVELER', 
          isOnboarded: false ,
          plan: 'free', // New: Assign free plan
          isSubscribed: false,
        }); 
        await user.save();
        this.logger.log(`New user created: ${user._id}`);
      }

      const payload = { sub: user._id.toString(), email: user.email, role: user.role };
      const accessToken = this.jwtService.sign(payload);

      otpStore.delete(identifier); // Clear OTP
      this.logger.log(`OTP verified for ${identifier}, user: ${user._id}`);
      return { accessToken, isNewUser, isOnboarded: user.isOnboarded };
    } catch (error : any) {
      //this.logger.error(`VerifyOtp failed for ${dto.email || dto.phone}: ${error.message}`, error.stack);
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
      // const result = { success: user ? true : false , ...user};
      return user;
    } catch (error:any) {
      this.logger.error(`CompleteOnboarding failed for ${userId}: ${error.message}`, error.stack);
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
      
      if (!user) {
        user = await this.userModel.findOne({ email });
      }

      if (!user) {
        user = new this.userModel({
          email,
          name,
          [provider === 'google' ? 'googleId' : 'facebookId']: providerId,
          role: 'TRAVELER',
          isOnboarded: false,
          plan: 'free',
          linkedAccounts: { [provider]: true },
        });
        await user.save();
      } else {
        // Update linked account
        user.linkedAccounts = { ...user.linkedAccounts, [provider]: true };
        if (!user.name) user.name = name;
        await user.save();
      }

      const payload = { sub: user._id.toString(), email: user.email, role: user.role };
      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        isNewUser: false, // Or check if newly created
        isOnboarded: user.isOnboarded,
      };
    } catch (error: any) {
      this.logger.error(`OAuthSignIn error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('OAuth sign-in failed');
    }
  }

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    try {
      console.log('Login attempt for:', email);
      console.log('Password provided:', password );
      const user = await this.userModel.findOne({ email });
      console.log('User found:', user);
      if (!user || !await bcrypt.compare(password, user.password || '')) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Role-based: admin/superadmin get full access; no extra gating here (handled in guards)
      const payload = { sub: user._id.toString(), email: user.email, role: user.role };
      const token = this.jwtService.sign(payload);

      // Return user with role for frontend (e.g., show admin dashboard)
      const userResponse = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role, // 'admin' or 'superadmin'
        isOnboarded: user.isOnboarded,
        plan: user.plan,
        isSubscribed: user.isSubscribed,
      };

      this.logger.log(`Login successful for ${email} with role: ${user.role}`);
      return { token, user: userResponse };
    } catch (error) {
      this.logger.error(`Login failed for ${email}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // New: Create subscription with Stripe
  async createSubscription(data: CreateSubscriptionDto): Promise<any> {
    try {
      const { userId, plan } = data;
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      const prices = {
        basic: process.env.STRIPE_BASIC_PRICE_ID,
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

      return { success: true, message: 'Checkout initiated', checkoutUrl: session.url };
    } catch (error: any) {
      this.logger.error(`CreateSubscription error: ${error.message}`, error.stack);
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
          id: user.subscriptionId,
          userId,
          planId: user.plan,
          plan: { name: user.plan.charAt(0).toUpperCase() + user.plan.slice(1), level: { free: 0, basic: 1, premium: 2 }[user.plan] },
          status: user.isSubscribed ? 'active' : 'inactive',
          // startDate: (user as any).createdAt?.toISOString?.() || null,
          // endDate: user.subscriptionEndDate?.toISOString() || null,
          start_date: timestamp((user as any).createdAt), // Use createdAt as start; adjust if separate field
          end_date: timestamp(user.subscriptionEndDate),
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
