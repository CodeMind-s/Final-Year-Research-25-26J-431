import { Body, Controller, Get, HttpException, HttpStatus, Inject, Logger, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { ApiBadRequestResponse, ApiBearerAuth, ApiInternalServerErrorResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { catchError, firstValueFrom, of } from 'rxjs';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { SignInDto, VerifyOtpDto, OAuthProfileDto, AuthResponseDto, OnboardingDto, LoginDto } from './dtos/auth.dto';
import { JwtService } from '@nestjs/jwt'; 

@Controller('auth')
export class AuthController {
  private authService: any;
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject('AUTH_PACKAGE') private authClient: ClientGrpcProxy,
    private jwtService: JwtService,
  ) {
        this.authService = this.authClient.getService('AuthService');

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
    } catch (error : any) {
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
    } catch (error:any) {
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

  @Put('onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete onboarding survey' })
  @ApiResponse({ status: 200, description: 'Onboarding completed' })
  @ApiBadRequestResponse({ description: 'Invalid onboarding data' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during onboarding' })
  async completeOnboarding(@Body() dto: OnboardingDto, @Req() req: any) {
    try {
      const userId = req?.user?.userId; // Extract from req.user.sub in production
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.authService.CompleteOnboarding({ userId, ...dto }).pipe(
          catchError((error) => {
            this.logger.error(`CompleteOnboarding error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during onboarding', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid onboarding data', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('Onboarding failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error:any) {
      this.logger.error(`CompleteOnboarding failed: ${error.message}`, error.stack);
      throw error;
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
    } catch (error:any) {
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
    } catch (error:any) {
      this.logger.error(`FacebookSignIn failed: ${error.message}`, error.stack);
      throw error;
    }
  }


  // New: Endpoint for getting personal details (proxy to user service if needed)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('personal-details')
  @ApiOperation({ summary: 'Get personal details' })
  @ApiResponse({ status: 200, description: 'Get personal details completed' })
  @ApiBadRequestResponse({ description: 'Invalid Get personal details data' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error during get personal details' })
  async getPersonalDetails(@Req() req: any) {
    // Implementation depends on user service; assume proxy
    // const userId = req?.user?.userId;
    // // Call user service GetUserById and return relevant fields
    // return userId;
    try {
      const userId = req?.user?.userId; // Extract from req.user.sub in production
      if (!userId) return { success: false, message: 'User not authenticated' };

      const result = await firstValueFrom(
        this.authService.CompleteOnboarding({ userId}).pipe(
          catchError((error) => {
            this.logger.error(`CompleteOnboarding error: ${error.message}`, error.stack);
            if (error.code === 2 || error.code === 'INTERNAL') {
              throw new HttpException('Internal server error during onboarding', HttpStatus.INTERNAL_SERVER_ERROR);
            } else if (error.code === 3 || error.code === 'INVALID_ARGUMENT') {
              throw new HttpException('Invalid onboarding data', HttpStatus.BAD_REQUEST);
            } else if (error.details && error.details.includes('User not found')) {
              throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            } else {
              throw new HttpException('Onboarding failed', HttpStatus.BAD_REQUEST);
            }
          })
        )
      );
      return result;
    } catch (error:any) {
      this.logger.error(`CompleteOnboarding failed: ${error.message}`, error.stack);
      throw error;
    }
  }

}
