import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dtos/user.dto';
import { BadRequestException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dtos/subscription.dto';


@Controller('user')
export class UserController {
   private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(@Payload() data: CreateUserDto) {
    try {
      const result = await this.userService.createUser(data);
      return { status: 200, message: 'User created successfully', id: result._id };
    } catch (error: any) {
      this.logger.error(`gRPC CreateUser error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'GetAllUsers')
  async getAllUsers(@Payload() data: { page: number; limit: number }) {
    try {
      this.logger.log(`Fetching users - Page: ${data.page}, Limit: ${data.limit}`);
      const result = await this.userService.getAllUsers(data.page , data.limit);
      return { users: result.users, total: result.total };
    } catch (error: any) {
      this.logger.error(`gRPC GetUser error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'GetUser')
  async getUser(@Payload() data: { email: string }) {
    try {
      const result = await this.userService.getUser(data.email);
      return { status: 200, message: 'User fetched successfully', data: result };
    } catch (error: any) {
      this.logger.error(`gRPC GetUser error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(@Payload() data: { id: string }) {
    try {
      const result = await this.userService.getUserById(data.id);
      return { status: 200, message: 'User fetched successfully', data: result };
    } catch (error: any) {
      this.logger.error(`gRPC GetUserById error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'UpdateUser')
  async updateUser(@Payload() data: UpdateUserDto) {
    try {
      const result = await this.userService.updateUser(data);
      return { status: 200, message: 'User updated successfully', id: result._id };
    } catch (error: any) {
      this.logger.error(`gRPC UpdateUser error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'DeleteUser')
  async deleteUser(@Payload() data: { email: string }) {
    try {
      const result = await this.userService.deleteUser(data.email);
      return { status: 200, message: 'User deleted successfully' , result: result};
    } catch (error: any) {
      this.logger.error(`gRPC DeleteUser error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'UpdateProfile')
  async updateProfile(@Payload() data: UpdateProfileDto) {
    try {
      console.log('called with data:', data);
      const result = await this.userService.updateProfile(data);
      return { status: 200, message: 'Profile updated successfully', id: result._id };
    } catch (error: any) {
      this.logger.error(`gRPC UpdateProfile error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'UpdatePersonalDetails')
  async UpdatePersonalDetails(@Payload() data: any) {
    try {
      const result = await this.userService.updatePersonalDetails(data);
      return { status: 200, message: 'Profile updated successfully', id: result._id };
    } catch (error: any) {
      this.logger.error(`gRPC UpdateProfile error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

// New: Create subscription (integrate Stripe checkout)
  @GrpcMethod('UserService', 'CreateSubscription')
  async createSubscription(@Payload() data: CreateSubscriptionDto & { userId: string }) {
    try {
      const result = await this.userService.createSubscription({ ...data, userId: data.userId });
      return { success: true, message: 'Subscription checkout initiated', checkoutUrl: result.url };
    } catch (error: any) {
      this.logger.error(`gRPC CreateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  // New: Get subscription details
  @GrpcMethod('UserService', 'GetSubscription')
  async getSubscription(@Payload() data: { userId: string }) {
    try {
      const result = await this.userService.getSubscription(data.userId);
      return { success: true, message: 'Subscription fetched', data: result };
    } catch (error: any) {
      this.logger.error(`gRPC GetSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  // New: Update subscription (e.g., upgrade)
  @GrpcMethod('UserService', 'UpdateSubscription')
  async updateSubscription(@Payload() data: CreateSubscriptionDto & { userId: string }) {
    try {
      const result = await this.userService.updateSubscription({ ...data, userId: data.userId });
      return { success: true, message: 'Subscription updated', checkoutUrl: result.url };
    } catch (error: any) {
      this.logger.error(`gRPC UpdateSubscription error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  // New: Handle Stripe webhook
  @GrpcMethod('UserService', 'HandleStripeWebhook')
  async handleStripeWebhook(@Payload() data: any) { // Struct for event
    try {
      const result = await this.userService.handleStripeWebhook(data);
      return { status: 200, message: 'Webhook handled successfully', result: result };
    } catch (error: any) {
      this.logger.error(`gRPC HandleStripeWebhook error: ${error.message}`, error.stack);
      throw new RpcException({
        code: error instanceof BadRequestException ? 3 : 2,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'CheckSubscriptionAccess')
  async checkSubscriptionAccess(@Payload() data: { userId: string; requiredLevel: number }) {
    try {
      const hasAccess = await this.userService.checkSubscriptionAccess(data.userId, data.requiredLevel);
      return { hasAccess };
    } catch (error: any) {
      throw new RpcException({ code: 2, message: error.message });
    }
  }

}
