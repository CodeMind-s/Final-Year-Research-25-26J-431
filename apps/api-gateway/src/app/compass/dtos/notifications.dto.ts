import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean } from 'class-validator';

// Get Notifications
export class GetNotificationsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  notifications?: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    dealId: string;
    timestamp: number;
    read: boolean;
    recipientId: string;
  }>;

  @ApiPropertyOptional()
  unreadCount?: number;
}

// Mark As Read
export class MarkAsReadResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

// Mark All As Read
export class MarkAllAsReadResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

// Create Notification
export class CreateNotificationDto {
  @ApiProperty({ example: 'new_offer' })
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty()
  @IsString()
  dealId: string;

  @ApiProperty()
  @IsString()
  recipientId: string;
}

export class CreateNotificationResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  notificationId?: string;
}
