// Updated user.dto.ts (extended with PersonalDetailsDto and AccountSettingsDto)
import { IsEmail, IsString, IsEnum, IsOptional, IsNotEmpty, IsBoolean, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PersonalDetailsDto, AccountSettingsDto } from '../../auth/dtos/auth.dto'; // Adjust the import path as necessary
export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;

  @ApiProperty({ example: 'SUPERADMIN', enum: ['SUPERADMIN', 'ADMIN', 'LANDOWNER', 'DISTRIBUTOR', 'SALTSOCIETY', 'LABORATORY'], description: 'User role' })
  @IsEnum(['SUPERADMIN', 'ADMIN', 'LANDOWNER', 'DISTRIBUTOR', 'SALTSOCIETY', 'LABORATORY'], { message: 'Invalid role' })
  role: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: '69943131b6ee2c225a9bd874', description: 'User ID', required: false })
  @IsOptional()
  @IsString({ message: 'User ID must be a string' })
  userId?: string;

  @ApiProperty({ example: 'John Doe Updated', description: 'Updated user name', required: false })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @ApiProperty({ example: true, description: 'Is user onboarded', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isOnboard must be a boolean' })
  isOnboard?: boolean;

  @ApiProperty({ example: 'free', enum: ['free', 'basic', 'premium'], description: 'User plan', required: false })
  @IsOptional()
  @IsEnum(['free', 'basic', 'premium'], { message: 'Invalid plan' })
  plan?: string;

  @ApiProperty({ example: false, description: 'Is user subscribed', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isSubscribe must be a boolean' })
  isSubscribe?: boolean;

  @ApiProperty({ example: false, description: 'Is user verified', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isVerified must be a boolean' })
  isVerified?: boolean;
}

export class UpdateUserRequestDto {
  @ApiProperty({ example: 'John Doe Updated', description: 'Updated user name', required: false })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @ApiProperty({ example: true, description: 'Is user onboarded', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isOnboard must be a boolean' })
  isOnboard?: boolean;

  @ApiProperty({ example: 'free', enum: ['free', 'basic', 'premium'], description: 'User plan', required: false })
  @IsOptional()
  @IsEnum(['free', 'basic', 'premium'], { message: 'Invalid plan' })
  plan?: string;

  @ApiProperty({ example: false, description: 'Is user subscribed', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isSubscribe must be a boolean' })
  isSubscribe?: boolean;

  @ApiProperty({ example: false, description: 'Is user verified', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isVerified must be a boolean' })
  isVerified?: boolean;
}

export class UpdateProfileDto {
  @ApiProperty({ example: '69943131b6ee2c225a9bd874', description: 'User ID', required: false })
  @IsOptional()
  @IsString({ message: 'User ID must be a string' })
  userId?: string;

  @ApiProperty({ example: ['www.example.com'], description: 'Document URLs', required: false })
  @IsOptional()
  @IsArray({ message: 'docUrls must be an array' })
  docUrls?: string[];

  @ApiProperty({ example: 100, description: 'Total beds (for LANDOWNER)', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'totalBeds must be a number' })
  totalBeds?: number;

  @ApiProperty({ example: '123456789V', description: 'NIC (for LANDOWNER)', required: false })
  @IsOptional()
  @IsString({ message: 'nic must be a string' })
  nic?: string;

  @ApiProperty({ example: 'Lab Name', description: 'Laboratory name (for LABORATORY)', required: false })
  @IsOptional()
  @IsString({ message: 'laboratoryName must be a string' })
  laboratoryName?: string;

  @ApiProperty({ example: 'REG123', description: 'Registration number (for LABORATORY/DISTRIBUTOR)', required: false })
  @IsOptional()
  @IsString({ message: 'registrationNumber must be a string' })
  registrationNumber?: string;

  @ApiProperty({ example: '123 Main St', description: 'Address', required: false })
  @IsOptional()
  @IsString({ message: 'address must be a string' })
  address?: string;

  @ApiProperty({ example: 'Company Name', description: 'Company name (for DISTRIBUTOR)', required: false })
  @IsOptional()
  @IsString({ message: 'companyName must be a string' })
  companyName?: string;
}

export class UpdateProfileRequestDto {
  @ApiProperty({ example: ['www.example.com'], description: 'Document URLs', required: false })
  @IsOptional()
  @IsArray({ message: 'docUrls must be an array' })
  docUrls?: string[];

  @ApiProperty({ example: 100, description: 'Total beds (for LANDOWNER)', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'totalBeds must be a number' })
  totalBeds?: number;

  @ApiProperty({ example: '123456789V', description: 'NIC (for LANDOWNER)', required: false })
  @IsOptional()
  @IsString({ message: 'nic must be a string' })
  nic?: string;

  @ApiProperty({ example: 'Lab Name', description: 'Laboratory name (for LABORATORY)', required: false })
  @IsOptional()
  @IsString({ message: 'laboratoryName must be a string' })
  laboratoryName?: string;

  @ApiProperty({ example: 'REG123', description: 'Registration number (for LABORATORY/DISTRIBUTOR)', required: false })
  @IsOptional()
  @IsString({ message: 'registrationNumber must be a string' })
  registrationNumber?: string;

  @ApiProperty({ example: '123 Main St', description: 'Address', required: false })
  @IsOptional()
  @IsString({ message: 'address must be a string' })
  address?: string;

  @ApiProperty({ example: 'Company Name', description: 'Company name (for DISTRIBUTOR)', required: false })
  @IsOptional()
  @IsString({ message: 'companyName must be a string' })
  companyName?: string;
}

export class UpdatePersonalDetailsDto {
  @ApiProperty({ example: ['www.example.com'], description: 'Document URLs', required: false })
  @IsOptional()
  @IsArray({ message: 'docUrls must be an array' })
  docUrls?: string[];

  @ApiProperty({ example: 100, description: 'Total beds (for LANDOWNER)', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'totalBeds must be a number' })
  totalBeds?: number;

  @ApiProperty({ example: '123456789V', description: 'NIC (for LANDOWNER)', required: false })
  @IsOptional()
  @IsString({ message: 'nic must be a string' })
  nic?: string;

  @ApiProperty({ example: 'Lab Name', description: 'Laboratory name (for LABORATORY)', required: false })
  @IsOptional()
  @IsString({ message: 'laboratoryName must be a string' })
  laboratoryName?: string;

  @ApiProperty({ example: 'REG123', description: 'Registration number (for LABORATORY/DISTRIBUTOR)', required: false })
  @IsOptional()
  @IsString({ message: 'registrationNumber must be a string' })
  registrationNumber?: string;

  @ApiProperty({ example: '123 Main St', description: 'Address', required: false })
  @IsOptional()
  @IsString({ message: 'address must be a string' })
  address?: string;

  @ApiProperty({ example: 'Company Name', description: 'Company name (for DISTRIBUTOR)', required: false })
  @IsOptional()
  @IsString({ message: 'companyName must be a string' })
  companyName?: string;
}

// New: Personal Details Update DTO (import from auth.dto.ts or duplicate)
export type PersonalDetailsUpdateDto = PersonalDetailsDto; // Reference to new DTO

// New: Account Settings Update DTO (import from auth.dto.ts or duplicate)
export type AccountSettingsUpdateDto = AccountSettingsDto; // Reference to new DTO

export class UserResponseDto {
  @ApiProperty({ example: 200, description: 'Status code' })
  status: number;

  @ApiProperty({ example: 'Success message', description: 'Response message' })
  message: string;

  @ApiProperty({ example: { id: 'user123', email: 'user@example.com' }, description: 'User data' })
  data?: any;
}