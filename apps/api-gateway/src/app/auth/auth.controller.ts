import { Body, Controller, Get, HttpException, HttpStatus, Inject, Logger, Post, Req } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { ApiBadRequestResponse, ApiBearerAuth, ApiInternalServerErrorResponse, ApiOperation, ApiResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { catchError, firstValueFrom, of } from 'rxjs';
import { Public } from './decorators/public.decorator';
import { SignInDto, VerifyOtpDto, OAuthProfileDto, AuthResponseDto, LoginDto, LandOwnerOnboardingDto, LaboratoryOnboardingDto, ServiceProviderOnboardingDto } from './dtos/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { Role } from './decorators/role.enum';
import { Roles } from './decorators/roles.decorator';

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
  @Post('sign-in')
  @ApiOperation({ summary: 'Send OTP for sign in (creates user if new)' })
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
      // New: Assign free plan if new user
      if (result.isNewUser) {
        const payload = this.jwtService.verify(result.accessToken);
        const userId = payload.sub;
        const freePlanId = 'free'; // Hardcoded; fetch dynamically in production
        await firstValueFrom(
          this.authService.CreateSubscription({ userId, planId: freePlanId }).pipe(
            catchError((err) => {
              this.logger.error(`CreateSubscription error: ${err.message}`);
              // Don't fail auth if subscription creation fails
              console.warn('Free plan assignment failed, but auth succeeded');
              return of(null);
            })
          )
        );
      }

      return result;
    } catch (error: any) {
      //this.logger.error(`VerifyOtp failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password (supports admin/superadmin)' })
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

}
