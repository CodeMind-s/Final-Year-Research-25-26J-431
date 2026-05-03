import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, Logger, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { ApiBadRequestResponse, ApiBearerAuth, ApiInternalServerErrorResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { catchError, firstValueFrom } from 'rxjs';
import { Public } from './decorators/public.decorator';
import { SignInDto, VerifyOtpDto, OAuthProfileDto, AuthResponseDto, LoginDto, LandOwnerOnboardingDto, LaboratoryOnboardingDto, ServiceProviderOnboardingDto, CreatePlanDto, UpdatePlanDto, SignUpDto } from './dtos/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { Role } from './decorators/role.enum';
import { Roles } from './decorators/roles.decorator';
import { getJwks } from './jwt-config';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private authService: any;
  private userService: any;
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject('AUTH_PACKAGE') private authClient: ClientGrpcProxy,
    @Inject('USER_PACKAGE') private userClient: ClientGrpcProxy,
    private jwtService: JwtService,
  ) {
    this.authService = this.authClient.getService('AuthService');
    this.userService = this.userClient.getService('UserService');
  }

  @Public()
  @Get('jwks')
  @ApiOperation({
    summary: 'JSON Web Key Set',
    description:
      'Public RSA key(s) used to verify access tokens. Empty when running in legacy HS256 mode. ' +
      'The Lab Agent fetches this on startup to verify lab user JWTs locally.',
  })
  @ApiResponse({
    status: 200,
    description: 'JWKS document',
    schema: { example: { keys: [{ kty: 'RSA', kid: 'abc123', use: 'sig', alg: 'RS256', n: '...', e: 'AQAB' }] } },
  })
  getJwks() {
    return getJwks();
  }

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Send OTP for sign up (creates user if new)' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiBadRequestResponse({ description: 'Invalid email or phone provided' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error while sending OTP' })
  async signUp(@Body() dto: SignUpDto) {
    try {
      const result = await firstValueFrom(
        this.authService.SignUp(dto).pipe(
          catchError((error) => {
            this.logger.error(`SignUp error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error while sending OTP', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid email or phone provided', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('Failed to send OTP', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`SignUp failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Post('sign-in')
  @ApiOperation({ summary: 'Send OTP for sign in (existing user login)' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiBadRequestResponse({ description: 'Invalid email or phone provided' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error while sending OTP' })
  async signIn(@Body() dto: SignInDto) {
    try {
      const result = await firstValueFrom(
        this.authService.SignIn(dto).pipe(
          catchError((error) => {
            this.logger.error(`SignIn error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error while sending OTP', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid email or phone provided', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('Failed to send OTP', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`SignIn failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and get JWT' })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid OTP code' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during verification' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    try {
      const result = await firstValueFrom(
        this.authService.VerifyOtp(dto).pipe(
          catchError((error) => {
            //this.logger.error(`VerifyOtp error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during verification', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid OTP code', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('Invalid OTP')) {
              throw new HttpException('Invalid OTP code', HttpStatus.UNAUTHORIZED);
            } else {
              throw new HttpException('OTP verification failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      ) as any;

      return result;
    } catch (error: any) {
      //this.logger.error(`VerifyOtp failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password (supports admin / superadmin / salt society)' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid credentials' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during login' })
  async login(@Body() dto: LoginDto) {
    try {
      const result = await firstValueFrom(
        this.authService.Login(dto).pipe(
          catchError((error) => {
            this.logger.error(`Login error: ${error.message}`, error.stack);
            if (error.code === 16 || error.code === 'UNAUTHENTICATED') {
              throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
            } else if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during login', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid login data', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('Login failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      ) as any;
      return {
        accessToken: result.token,
        user: result.user, // Includes role for admin/superadmin
      };
    } catch (error: any) {
      this.logger.error(`Login failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('onboarding/landowner')
  @ApiBearerAuth()
  @Roles(Role.LANDOWNER)
  @ApiOperation({ summary: 'Onboard Landowner (landowner)' })
  @ApiResponse({ status: 200, description: 'Landowner onboarding successful' })
  async onboardLandOwner(@Body() dto: LandOwnerOnboardingDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      return await firstValueFrom(this.userService.OnboardLandOwner({ userId, ...dto }));
    } catch (error: any) {
      this.logger.error(`OnboardLandOwner error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('onboarding/laboratory')
  @ApiBearerAuth()
  @Roles(Role.LABORATORY)
  @ApiOperation({ summary: 'Onboard Laboratory (laboratory)' })
  @ApiResponse({ status: 200, description: 'Laboratory onboarding successful' })
  async onboardLaboratory(@Body() dto: LaboratoryOnboardingDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      return await firstValueFrom(this.userService.OnboardLaboratory({ userId, ...dto }));
    } catch (error: any) {
      this.logger.error(`OnboardLaboratory error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('onboarding/distributor')
  @ApiBearerAuth()
  @Roles(Role.DISTRIBUTOR)
  @ApiOperation({ summary: 'Onboard Distributor (Service Provider)' })
  @ApiResponse({ status: 200, description: 'Distributor onboarding successful' })
  async onboardServiceProvider(@Body() dto: ServiceProviderOnboardingDto, @Req() req: any) {
    try {
      const userId = req.user.userId;
      return await firstValueFrom(this.userService.OnboardServiceProvider({ userId, ...dto }));
    } catch (error: any) {
      this.logger.error(`OnboardServiceProvider error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }


  @Public()
  @Post('google')
  @ApiOperation({ summary: 'Sign in with Google' })
  @ApiResponse({ status: 200, description: 'Google sign-in successful', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid Google profile data' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during Google sign-in' })
  async googleSignIn(@Body() dto: OAuthProfileDto) {
    try {
      dto.provider = 'google';
      const result = await firstValueFrom(
        this.authService.OAuthSignIn(dto).pipe(
          catchError((error) => {
            this.logger.error(`GoogleSignIn error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during Google sign-in', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid Google profile data', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('Google sign-in failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`GoogleSignIn failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Post('facebook')
  @ApiOperation({ summary: 'Sign in with Facebook' })
  @ApiResponse({ status: 200, description: 'Facebook sign-in successful', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid Facebook profile data' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during Facebook sign-in' })
  async facebookSignIn(@Body() dto: OAuthProfileDto) {
    try {
      dto.provider = 'facebook';
      const result = await firstValueFrom(
        this.authService.OAuthSignIn(dto).pipe(
          catchError((error) => {
            this.logger.error(`FacebookSignIn error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during Facebook sign-in', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid Facebook profile data', HttpStatus.BAD_REQUEST);
            } else {
              throw new HttpException('Facebook sign-in failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error: any) {
      this.logger.error(`FacebookSignIn failed: ${error.message}`, error.stack);
      throw error;
    }
  }


  // New: Endpoint for getting personal details (proxy to user service if needed)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Get('personal-details')
  @ApiOperation({ summary: 'Get combined user and role-specific details (own details)' })
  @ApiResponse({ status: 200, description: 'Details fetched successfully' })
  async getPersonalDetails(@Req() req: any) {
    try {
      const userId = req.user.userId;
      return await firstValueFrom(this.userService.GetPersonalDetails({ id: userId }));
    } catch (error: any) {
      this.logger.error(`GetPersonalDetails error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Admin Plan CRUD endpoints
  @Get('plans')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'List all plans (admin only)' })
  @ApiResponse({ status: 200, description: 'Plans fetched successfully' })
  async getPlans() {
    try {
      return await firstValueFrom(this.authService.GetPlans({}));
    } catch (error: any) {
      this.logger.error(`GetPlans error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('plans/:key')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Get a single plan by key (admin only)' })
  @ApiResponse({ status: 200, description: 'Plan fetched successfully' })
  async getPlan(@Param('key') key: string) {
    try {
      return await firstValueFrom(
        this.authService.GetPlan({ planKey: key }).pipe(
          catchError((error) => {
            if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException(error.message, HttpStatus.NOT_FOUND);
            }
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error(`GetPlan error: ${error.message}`);
      throw error;
    }
  }

  @Post('plans')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new plan (admin only)' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  async createPlan(@Body() dto: CreatePlanDto) {
    try {
      return await firstValueFrom(
        this.authService.CreatePlan({
          key: dto.key,
          name: dto.name,
          level: dto.level,
          price_monthly_lkr: dto.priceMonthlyLKR,
          price_annual_lkr: dto.priceAnnualLKR,
          feature_keys: dto.featureKeys,
          duration: dto.duration,
        }).pipe(
          catchError((error) => {
            if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error(`CreatePlan error: ${error.message}`);
      throw error;
    }
  }

  @Patch('plans/:key')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Partially update a plan (admin only)' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  async updatePlan(@Param('key') key: string, @Body() dto: UpdatePlanDto) {
    try {
      return await firstValueFrom(
        this.authService.UpdatePlan({
          key,
          name: dto.name ?? '',
          level: dto.level ?? 0,
          price_monthly_lkr: dto.priceMonthlyLKR ?? 0,
          price_annual_lkr: dto.priceAnnualLKR ?? 0,
          feature_keys: dto.featureKeys ?? [],
          duration: dto.duration ?? '',
          is_active: dto.isActive ?? false,
        }).pipe(
          catchError((error) => {
            if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException(error.message, HttpStatus.NOT_FOUND);
            }
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error(`UpdatePlan error: ${error.message}`);
      throw error;
    }
  }

  @Delete('plans/:key')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Soft-delete (deactivate) a plan (admin only)' })
  @ApiResponse({ status: 200, description: 'Plan deactivated successfully' })
  async deletePlan(@Param('key') key: string) {
    try {
      return await firstValueFrom(
        this.authService.DeletePlan({ key }).pipe(
          catchError((error) => {
            if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
            }
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error(`DeletePlan error: ${error.message}`);
      throw error;
    }
  }

  @Get('subscriptions')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'List all subscriptions (admin only)' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Subscriptions fetched successfully' })
  async getAllSubscriptions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      return await firstValueFrom(
        this.authService.GetAllSubscriptions({
          page: page ? parseInt(page.toString(), 10) : 1,
          limit: limit ? parseInt(limit.toString(), 10) : 10,
        }).pipe(
          catchError((error) => {
            this.logger.error(`GetAllSubscriptions error: ${error.message}`);
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error(`GetAllSubscriptions failed: ${error.message}`);
      throw error;
    }
  }

}
