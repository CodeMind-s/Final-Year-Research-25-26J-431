import { BadRequestException, Controller, Logger, UnauthorizedException } from '@nestjs/common';
import { GrpcMethod, Payload, RpcException } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { SignInDto, VerifyOtpDto, OnboardingDto, OAuthProfileDto, LoginDto } from './dtos/auth.dto';

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
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'VerifyOtp')
  async verifyOtp(data: VerifyOtpDto) {
    try {
      return await this.authService.verifyOtp(data);
    } catch (error:any) {
      throw new RpcException({
        code: error instanceof UnauthorizedException ? 16 : (error instanceof BadRequestException ? 3 : 2),
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
        code: error instanceof BadRequestException ? 3 : 2,
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
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'Login')
  async login(@Payload() data: LoginDto) {
    try {
      const result = await this.authService.login(data.email, data.password);
      return result;
    } catch (error: any) {
      this.logger.error(`gRPC Login error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof UnauthorizedException ? 16 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'CreateSubscription')
  async createSubscription(@Payload() data: { userId: string; planKey: string; paymentMethod?: string }) {
    try {
      return await this.authService.createSubscription(data);
    } catch (error: any) {
      this.logger.error(`gRPC CreateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'GetSubscription')
  async getSubscription(@Payload() data: { userId: string }) {
    try {
      return await this.authService.getSubscription(data.userId);
    } catch (error: any) {
      this.logger.error(`gRPC GetSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'GetPlans')
  async getPlans() {
    try {
      return await this.authService.getPlans();
    } catch (error: any) {
      this.logger.error(`gRPC GetPlans error: ${error.message}`, error.stack);
      throw new RpcException({
        code: 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'GetPlan')
  async getPlan(@Payload() data: { planKey: string }) {
    try {
      return await this.authService.getPlan(data.planKey);
    } catch (error: any) {
      this.logger.error(`gRPC GetPlan error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'UpdateSubscription')
  async updateSubscription(@Payload() data: { userId: string; planKey: string }) {
    try {
      return await this.authService.updateSubscription(data.userId, data.planKey);
    } catch (error: any) {
      this.logger.error(`gRPC UpdateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'CheckFeatureAccess')
  async checkFeatureAccess(@Payload() data: { userId: string; featureKey: string; userRole: string }) {
    try {
      return await this.authService.checkFeatureAccess(data.userId, data.featureKey, data.userRole);
    } catch (error: any) {
      this.logger.error(`gRPC CheckFeatureAccess error: ${error.message}`, error.stack);
      throw new RpcException({
        code: 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'CreatePlan')
  async createPlan(@Payload() data: any) {
    try {
      return await this.authService.createPlan(data);
    } catch (error: any) {
      this.logger.error(`gRPC CreatePlan error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'UpdatePlan')
  async updatePlan(@Payload() data: any) {
    try {
      return await this.authService.updatePlan(data.key, data);
    } catch (error: any) {
      this.logger.error(`gRPC UpdatePlan error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'DeletePlan')
  async deletePlan(@Payload() data: { key: string }) {
    try {
      return await this.authService.deletePlan(data.key);
    } catch (error: any) {
      this.logger.error(`gRPC DeletePlan error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('AuthService', 'GetPersonalDetails')
  async getPersonalDetail(@Payload() data: { userId: string }) {
    try {
      return await this.authService.getPersonalDetail(data.userId);
    } catch (error: any) {
      this.logger.error(`gRPC GetPersonalDetails error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }
}
