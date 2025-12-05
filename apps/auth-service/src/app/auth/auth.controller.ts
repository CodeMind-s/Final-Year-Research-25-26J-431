import { BadRequestException, Controller, Logger, UnauthorizedException } from '@nestjs/common';
import { GrpcMethod, Payload, RpcException } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { SignInDto, VerifyOtpDto, OnboardingDto, OAuthProfileDto, CreateSubscriptionDto, LoginDto } from './dtos/auth.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'SignIn')
  async signIn(data: SignInDto) {
    try {
      return await this.authService.signIn(data);
    } catch (error:any) {
      this.logger.error(`gRPC SignIn error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2, // INVALID_ARGUMENT or INTERNAL
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'VerifyOtp')
  async verifyOtp(data: VerifyOtpDto) {
    try {
      return await this.authService.verifyOtp(data);
    } catch (error:any) {
      //this.logger.error(`gRPC VerifyOtp error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof UnauthorizedException ? 16 : (error instanceof BadRequestException ? 3 : 2), // UNAUTHENTICATED, INVALID_ARGUMENT, or INTERNAL
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'CompleteOnboarding')
  async completeOnboarding(data: { userId: string } & OnboardingDto) {
    try {
      return await this.authService.completeOnboarding(data.userId, data);
    } catch (error:any) {
      this.logger.error(`gRPC CompleteOnboarding error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2, // INVALID_ARGUMENT or INTERNAL
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'OAuthSignIn')
  async oAuthSignIn(data: OAuthProfileDto) {
    try {
      return await this.authService.oAuthSignIn(data);
    } catch (error:any) {
      this.logger.error(`gRPC OAuthSignIn error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2, // INVALID_ARGUMENT or INTERNAL
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'Login')
  async login(@Payload() data: LoginDto) {
    try {
      const result = await this.authService.login(data.email, data.password);
      return result; // { token, user: { ... with role } }
    } catch (error: any) {
      this.logger.error(`gRPC Login error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof UnauthorizedException ? 16 : 2, // UNAUTHENTICATED or INTERNAL
        message: error.message,
      });
    }
  }
  // New: Create subscription
  @GrpcMethod('AuthService', 'CreateSubscription')
  async createSubscription(@Payload() data: CreateSubscriptionDto) {
    try {
      const result = await this.authService.createSubscription(data);
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC CreateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  // New: Get subscription
  @GrpcMethod('AuthService', 'GetSubscription')
  async getSubscription(@Payload() data: { userId: string }) {
    try {
      const result = await this.authService.getSubscription(data.userId);
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC GetSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  // New: Get plans
  @GrpcMethod('AuthService', 'GetPlans')
  async getPlans() {
    try {
      const result = await this.authService.getPlans();
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC GetPlans error: ${error.message}`, error.stack);
      throw new RpcException({
        code: 2,
        message: error.message,
      });
    }
  }

  // New: Get plan
  @GrpcMethod('AuthService', 'GetPlan')
  async getPlan(@Payload() data: { planId: string }) {
    try {
      const result = await this.authService.getPlan(data.planId);
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC GetPlan error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  // New: Update subscription
  @GrpcMethod('AuthService', 'UpdateSubscription')
  async updateSubscription(@Payload() data: { subscriptionId: string; planId: string }) {
    try {
      const result = await this.authService.updateSubscription(data.subscriptionId, data.planId);
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC UpdateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'GetPersonalDetails')
  async getPersonalDetail(@Payload() data: { userId: string }) {
    try {
      const { userId } = data;
      const result = await this.authService.getPersonalDetail(userId);
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC UpdateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

}
