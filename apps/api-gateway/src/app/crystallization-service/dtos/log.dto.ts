// import { IsString, IsArray, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// export class CreateItineraryDto {
//   @ApiProperty({ example: 'user123', description: 'User ID' })
//   @IsString({ message: 'User ID must be a string' })
//   @IsNotEmpty({ message: 'User ID cannot be empty' })
//   userId: string;

//   @ApiProperty({ example: 'My Sri Lanka Trip', description: 'Itinerary title' })
//   @IsString({ message: 'Title must be a string' })
//   @IsNotEmpty({ message: 'Title cannot be empty' })
//   title: string;

//   @ApiProperty({ example: 'Colombo', description: 'Destination' })
//   @IsString({ message: 'Destination must be a string' })
//   @IsNotEmpty({ message: 'Destination cannot be empty' })
//   destination: string;

//   @ApiProperty({ example: ['2025-10-10', '2025-10-15'], description: 'Trip dates' })
//   @IsArray({ message: 'Dates must be an array' })
//   @IsOptional()
//   dates?: string[];

//   @ApiProperty({ example: ['beaches', 'food-culinary'], description: 'Preferences' })
//   @IsArray({ message: 'Preferences must be an array' })
//   @IsOptional()
//   preferences?: string[];
// }

export class ItineraryResponseDto {
  @ApiProperty({ example: true, description: 'Success flag' })
  success: boolean;

  @ApiProperty({ example: 'Itinerary created successfully', description: 'Message' })
  message: string;

  @ApiProperty({ type: Object, description: 'Itinerary data' })
  data?: any;
}