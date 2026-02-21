import { IsEmail, IsString, IsOptional, Length, IsIn, ValidateIf, IsEnum, IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  @IsString()
  @IsOptional()
  @ValidateIf(o => o.email)
  @IsEmail({}, { message: 'Invalid email' })
  email?: string;

  @ApiProperty({ example: '+1234567890', description: 'User phone number' })
  @IsString()
  @IsOptional()
  @ValidateIf(o => o.phone)
  phone?: string;

  @ApiProperty({ example: 'LANDOWNER', enum: ['LANDOWNER', 'LABORATORY', 'DISTRIBUTOR', 'SALTSOCIETY'] })
  @IsString()
  @IsEnum(['LANDOWNER', 'LABORATORY', 'DISTRIBUTOR', 'SALTSOCIETY'])
  role!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email' })
  email?: string;

  @ApiProperty({ example: '+1234567890', description: 'User phone number' })
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  code!: string;
}

export class OnboardingDto {
  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString()
  @IsOptional()
  name!: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'other', 'prefer_not_to_say'] })
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  @IsOptional()
  gender!: string;

  @ApiProperty({ example: 'English', description: 'Preferred language' })
  @IsOptional()
  @IsString()
  preferredLanguage!: string;

  @ApiProperty({ example: 'LKR', description: 'Preferred currency' })
  @IsString()
  @IsOptional()
  preferredCurrency!: string;
}

export class OAuthProfileDto {
  @ApiProperty({ example: 'john.doe@gmail.com', description: 'User email from provider' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe', description: 'User name from provider' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'google-12345', description: 'Provider-specific ID' })
  @IsString()
  providerId!: string;

  @ApiProperty({ example: 'google', description: 'Provider name (google/facebook)' })
  @IsIn(['google', 'facebook'])
  provider!: string;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ example: true, description: 'Is this a new user?' })
  isNewUser!: boolean;

  @ApiProperty({ example: false, description: 'Is onboarding completed?' })
  isOnboarded!: boolean;
}

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'pro', enum: ['pro', 'lab'], description: 'Plan key' })
  @IsEnum(['pro', 'lab'], { message: 'Plan must be pro or lab' })
  plan: string;

  @ApiProperty({ example: 'user123', description: 'User ID' })
  @IsString()
  userId: string;
}

export class PlanDto {
  @ApiProperty({ example: 'free', description: 'Plan key' })
  key!: string;

  @ApiProperty({ example: 'Free Plan', description: 'Plan name' })
  name!: string;

  @ApiProperty({ example: 0, description: 'Feature level (0=Free, 1=Pro, 2=Lab)' })
  level!: number;

  @ApiProperty({ example: 0, description: 'Monthly price in LKR' })
  priceMonthlyLKR!: number;

  @ApiProperty({ example: 0, description: 'Annual price in LKR' })
  priceAnnualLKR!: number;

  @ApiProperty({ example: ['weather_data', 'salinity'], description: 'Feature keys included in plan' })
  featureKeys!: string[];

  @ApiProperty({ example: 'lifetime', description: 'Duration' })
  duration!: string;
}

export class SubscriptionDto {
  @ApiProperty({ example: 'sub_123', description: 'Subscription ID' })
  id!: string;

  @ApiProperty({ example: 'user_123', description: 'User ID' })
  userId!: string;

  @ApiProperty({ example: 'pro', description: 'Plan key' })
  planKey!: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'expired', 'cancelled', 'trial'] })
  status!: string;

  @ApiProperty({ example: '2025-10-08T00:00:00Z', description: 'Start date' })
  startDate!: string;

  @ApiProperty({ example: null, description: 'End date (null for lifetime)' })
  endDate?: string | null;

  @ApiProperty({ example: false, description: 'Is this a trial subscription?' })
  isTrial!: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @Length(6, 128, { message: 'Password must be between 6 and 128 characters' })
  password: string;
}

// Role-specific Onboarding DTOs
export class LandOwnerOnboardingDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  docUrls!: string[];

  @ApiProperty()
  @IsNotEmpty()
  totalBeds!: number;

  @ApiProperty()
  @IsString()
  nic!: string;

  @ApiProperty()
  @IsString()
  address!: string;
}

export class LaboratoryOnboardingDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  docUrls!: string[];

  @ApiProperty()
  @IsString()
  laboratoryName!: string;

  @ApiProperty()
  @IsString()
  registrationNumber!: string;

  @ApiProperty()
  @IsString()
  address!: string;
}

export class ServiceProviderOnboardingDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  docUrls!: string[];

  @ApiProperty()
  @IsString()
  companyName!: string;

  @ApiProperty()
  @IsString()
  registrationNumber!: string;

  @ApiProperty()
  @IsString()
  address!: string;
}
