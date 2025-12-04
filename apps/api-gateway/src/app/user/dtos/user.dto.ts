// Updated user.dto.ts (extended with PersonalDetailsDto and AccountSettingsDto)
import { IsEmail, IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
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

  @ApiProperty({ example: 'SUPERADMIN', enum: ['SUPERADMIN', 'ADMIN', 'TRAVELER'], description: 'User role' })
  @IsEnum(['SUPERADMIN', 'ADMIN', 'TRAVELER'], { message: 'Invalid role' })
  role: string;

  @ApiProperty({ example: 'English', description: 'Preferred language', required: false })
  @IsOptional()
  @IsString({ message: 'Preferred language must be a string' })
  preferredLanguage?: string;

  @ApiProperty({ example: 'USD', description: 'Preferred currency', required: false })
  @IsOptional()
  @IsString({ message: 'Preferred currency must be a string' })
  preferredCurrency?: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'newpassword123', description: 'New password', required: false })
  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  password?: string;

  @ApiProperty({ example: 'John Doe Updated', description: 'Updated user name', required: false })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @ApiProperty({ example: 'English', description: 'Preferred language', required: false })
  @IsOptional()
  @IsString({ message: 'Preferred language must be a string' })
  preferredLanguage?: string;

  @ApiProperty({ example: 'USD', description: 'Preferred currency', required: false })
  @IsOptional()
  @IsString({ message: 'Preferred currency must be a string' })
  preferredCurrency?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe Updated', description: 'Updated user name', required: false })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;


  @ApiProperty({ example: 'English', description: 'Preferred language', required: false })
  @IsOptional()
  @IsString({ message: 'Preferred language must be a string' })
  preferredLanguage?: string;

  @ApiProperty({ example: 'USD', description: 'Preferred currency', required: false })
  @IsOptional()
  @IsString({ message: 'Preferred currency must be a string' })
  preferredCurrency?: string;
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