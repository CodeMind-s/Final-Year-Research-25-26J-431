import { Body, Controller, Post, UseGuards, Inject, Get, Param, Req, Put, Delete, Query } from '@nestjs/common';
import {  ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBadRequestResponse, ApiBearerAuth, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dtos/user.dto';
import { AccountSettingsDto, PersonalDetailsDto } from '../auth/dtos/auth.dto';

@ApiTags('User')
@Controller('user')
export class UserController {
  private userService: any;
  private readonly logger = new Logger(UserController.name);

  
  constructor(@Inject('USER_PACKAGE') private client: ClientGrpcProxy) {
    this.userService = this.client.getService('UserService');
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 200, description: 'User created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid user data' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during user creation' })
  async createUser(@Body() dto: CreateUserDto) {
    try {
      const result = await firstValueFrom(
        this.userService.CreateUser(dto).pipe(
          catchError((error) => {
            this.logger.error(`CreateUser error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during user creation', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid user data', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('User creation failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`CreateUser failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by email' })
  @ApiResponse({ status: 200, description: 'User fetched successfully' })
  @ApiBadRequestResponse({ description: 'Invalid email' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during user fetch' })
  async getUser(@Param('email') email: string, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.GetUser({ email }).pipe(
          catchError((error) => {
            this.logger.error(`GetUser error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during user fetch', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid email', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('User fetch failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`GetUser failed: ${error.message}`, error.stack);
      throw error;
    }
  }


  @Get('all/users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of users per page (default: 10, max: 100)', example: 10 })
  @ApiResponse({ status: 200, description: 'Users fetched successfully' })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during user fetch' })
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req: any,
  ) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      if (page < 1) {
        throw new HttpException('Page must be greater than 0', HttpStatus.BAD_REQUEST);
      }
      if (limit < 1 || limit > 100) {
        throw new HttpException('Page size must be between 1 and 100', HttpStatus.BAD_REQUEST);
      }

      const request = {
        page,
        limit,
      };

      const result: any = await firstValueFrom(
        this.userService.GetAllUsers( request ).pipe(
          catchError((error) => {
            this.logger.error(`GetAllUsers error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during user fetch', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid pagination parameters', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('User fetch failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return {
        success: true,
        data: result.users || [],
        pagination: {
          page,
          limit,
          total: result.total || 0, // Assuming the response includes total count; adjust based on proto
          totalPages: Math.ceil((result.total || 0) / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`GetUser failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('id/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User fetched successfully' })
  @ApiBadRequestResponse({ description: 'Invalid user ID' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during user fetch' })
  async getUserById(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.GetUserById({ id }).pipe(
          catchError((error) => {
            this.logger.error(`GetUserById error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during user fetch', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('User fetch failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`GetUserById failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user data' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid user data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during user update' })
  async updateUser(@Body() dto: UpdateUserDto, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.UpdateUser(dto).pipe(
          catchError((error) => {
            this.logger.error(`UpdateUser error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during user update', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid user data', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('User update failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`UpdateUser failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user by email' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid email' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during user deletion' })
  async deleteUser(@Param('email') email: string, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.DeleteUser({ email }).pipe(
          catchError((error) => {
            this.logger.error(`DeleteUser error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during user deletion', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid email', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('User deletion failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`DeleteUser failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid profile data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during profile update' })
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.UpdateProfile(dto).pipe(
          catchError((error) => {
            this.logger.error(`UpdateProfile error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during profile update', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid profile data', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('Profile update failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`UpdateProfile failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // New: Update Personal Details
  @Put('personal-details')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update personal details' })
  @ApiResponse({ status: 200, description: 'Personal details updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid personal details data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during personal details update' })
  async updatePersonalDetails(@Body() dto: PersonalDetailsDto, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.UpdatePersonalDetails({ userId, ...dto }).pipe(
          catchError((error) => {
            this.logger.error(`UpdatePersonalDetails error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during personal details update', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid personal details data', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('Personal details update failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`UpdatePersonalDetails failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // New: Update Account Settings
  @Put('account-settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update account settings' })
  @ApiResponse({ status: 200, description: 'Account settings updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid account settings data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during account settings update' })
  async updateAccountSettings(@Body() dto: AccountSettingsDto, @Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.UpdateAccountSettings({ userId, ...dto }).pipe(
          catchError((error) => {
            this.logger.error(`UpdateAccountSettings error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during account settings update', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid account settings data', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('Account settings update failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`UpdateAccountSettings failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // New: Deactivate Account
  @Put('deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'Account deactivated successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async deactivateAccount(@Req() req: any) {
    try {
      const userId = req?.user?.userId;
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.userService.DeactivateAccount({ userId }).pipe(
          catchError((error) => {
            this.logger.error(`DeactivateAccount error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during deactivation', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('Account deactivation failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`DeactivateAccount failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
