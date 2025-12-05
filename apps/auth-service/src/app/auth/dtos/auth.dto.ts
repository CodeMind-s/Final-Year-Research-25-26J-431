import { IsEmail, IsString, IsOptional, Length, IsIn, ValidateIf,  IsEnum, IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email or phone number' })
  @IsString()
  @ValidateIf(o => o.email)
  @IsEmail({}, { message: 'Invalid email' })
  email?: string;

  @ApiProperty({ example: '+1234567890', description: 'User phone number' })
  @IsString()
  @ValidateIf(o => o.phone)
  phone?: string;
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

  @ApiProperty({ example: 'USD', description: 'Preferred currency' })
  @IsString()
  @IsOptional()
  preferredCurrency!: string;

  @ApiProperty({ example: 'solo', description: 'Traveler types' })
  @IsString()
  @IsOptional()
  travelerTypes!: string;

  @ApiProperty({ example: ['tuk-tuk', 'car-van-rental'], description: 'Transportation preferences' })
  @IsArray({ message: 'Transportation preferences must be an array' })
  @IsOptional()
  transportationPreferences!: string[];

  @ApiProperty({ example: ['lankan-cuisines', 'western-cuisines'], description: 'Food/drink preferences' })
  @IsArray({ message: 'Food/drink preferences must be an array' })
  @IsOptional()
  foodDrinkPreferences!: string[];

  @ApiProperty({ example: ['misty-highlands', 'beaches'], description: 'Sri Lanka vibes' })
  @IsArray({ message: 'Sri Lanka vibes must be an array' })
  @IsOptional()
  sriLankaVibes!: string[];
}

export class OnboardingBasicDto {
  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString({ message: 'Name must be a string' })
  name!: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'other', 'prefer_not_to_say'] })
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'], { message: 'Gender must be one of: male, female, other, prefer_not_to_say' })
  gender!: string;

  @ApiProperty({ example: 'English', description: 'Preferred language' })
  @IsString({ message: 'Preferred language must be a string' })
  preferredLanguage!: string;

  @ApiProperty({ example: 'USD', description: 'Preferred currency' })
  @IsString({ message: 'Preferred currency must be a string' })
  preferredCurrency!: string;
}


export class OnboardingSurveyDto {
  @ApiProperty({ example: 'solo', description: 'Traveler types', enum:['solo', 'couples', 'friends', 'family', 'business'] })
  @IsString()
  @IsOptional()
  travelerTypes!: string;

  @ApiProperty({ example: ['tuk-tuk', 'car-van-rental'], description: 'Transportation preferences' })
  @IsArray()
  transportationPreferences!: string[];


  @ApiProperty({ example: ['surfing', 'wildlife-safari'], description: 'Activity preferences' })
  @IsArray({ message: 'Activity preferences must be an array' })
  @IsOptional()
  activityPreferences!: string[];

  @ApiProperty({ example: ['lankan-cuisines', 'western-cuisines'], description: 'Food/drink preferences' })
  @IsArray()
  foodDrinkPreferences!: string[];

  @ApiProperty({ example: ['misty-highlands', 'beaches'], description: 'Sri Lanka vibes' })
  @IsArray()
  sriLankaVibes!: string[];
}

export class FullOnboardingDto {
  // Basic info
  @ApiProperty({ type: OnboardingBasicDto })
  basic!: OnboardingBasicDto;

  // Survey
  @ApiProperty({ type: OnboardingSurveyDto })
  survey!: OnboardingSurveyDto;
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


// New DTOs for subscriptions
export class CreateSubscriptionDto {
  @ApiProperty({ example: 'basic', enum: ['basic', 'premium'], description: 'Plan tier' })
  @IsEnum(['basic', 'premium'], { message: 'Plan must be basic or premium' })
  plan: string;

  @ApiProperty({ example: 'user123', description: 'User ID' })
  @IsString()
  userId: string;
}

// New DTOs
export class PlanDto {
  @ApiProperty({ example: 'free', description: 'Plan ID' })
  id!: string;

  @ApiProperty({ example: 'Free', description: 'Plan name' })
  name!: string;

  @ApiProperty({ example: 0, description: 'Feature level (0=Free, 1=Basic, 2=Premium)' })
  level!: number;

  @ApiProperty({ example: 0, description: 'Monthly price' })
  price!: number;

  @ApiProperty({ example: ['Basic trip viewing'], description: 'Allowed features' })
  features!: string[];

  @ApiProperty({ example: 'lifetime', description: 'Duration' })
  duration!: string;
}

export class SubscriptionDto {
  @ApiProperty({ example: 'sub_123', description: 'Subscription ID' })
  id!: string;

  @ApiProperty({ example: 'user_123', description: 'User ID' })
  userId!: string;

  @ApiProperty({ type: PlanDto, description: 'Associated plan' })
  plan!: PlanDto; // Populated in response

  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'expired'] })
  status!: string;

  @ApiProperty({ example: '2025-10-08T00:00:00Z', description: 'Start date' })
  startDate!: string;

  @ApiProperty({ example: null, description: 'End date (null for lifetime)' })
  endDate?: string | null;
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


// New: Personal Details DTO
export class PersonalDetailsDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '123 Main St, City', description: 'Residential address' })
  @IsOptional()
  @IsString()
  residentialAddress?: string;

  @ApiProperty({ example: 'male', enum: ['male', 'female', 'other', 'prefer_not_to_say'] })
  @IsOptional()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Emergency contact name' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiProperty({ example: '+1234567890', description: 'Emergency contact number' })
  @IsOptional()
  @IsString()
  emergencyContactNumber?: string;

  @ApiProperty({ example: '123 Main St, City', description: 'Emergency contact address' })
  @IsOptional()
  @IsString()
  emergencyContactAddress?: string;

  @ApiProperty({ example: 'O+', enum: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] })
  @IsOptional()
  @IsIn(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
  bloodType?: string;

  @ApiProperty({ example: 'Peanuts, Latex', description: 'Allergies' })
  @IsOptional()
  @IsString()
  allergies?: string;
}

// New: Account Settings DTO
export class AccountSettingsDto {
  @ApiProperty({ example: 'newemail@example.com', description: 'New email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: true, description: 'Enable 2FA' })
  @IsOptional()
  twoFactorEnabled?: boolean;

  @ApiProperty({ example: { google: true, facebook: false }, description: 'Linked accounts' })
  @IsOptional()
  linkedAccounts?: { google: boolean; facebook: boolean };

  @ApiProperty({ example: true, description: 'Profile visibility' })
  @IsOptional()
  profileVisibility?: boolean;
}