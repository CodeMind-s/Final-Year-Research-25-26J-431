import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Query } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger, HttpStatus, HttpException } from '@nestjs/common';
import {
  GetNotificationsResponseDto,
  MarkAsReadResponseDto,
  MarkAllAsReadResponseDto,
  CreateNotificationDto,
  CreateNotificationResponseDto,
} from './dtos/notifications.dto';

@ApiTags('Compass - Notifications')
@Controller('compass/notifications')
export class NotificationsController {
  private notificationService: any;
  private readonly logger = new Logger(NotificationsController.name);

  constructor(@Inject('COMPASS_NOTIFICATION_PACKAGE') private client: ClientGrpcProxy) {
    this.notificationService = this.client.getService('NotificationService');
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiParam({ name: 'userId', type: String })
  @ApiQuery({ name: 'unreadOnly', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Notifications fetched successfully', type: GetNotificationsResponseDto })
  async getNotifications(
    @Param('userId') userId: string,
    @Query('unreadOnly') unreadOnly?: boolean
  ): Promise<GetNotificationsResponseDto> {
    try {
      const result = await firstValueFrom(
        this.notificationService.GetNotifications({ userId, unreadOnly: unreadOnly || false }).pipe(
          catchError((error) => {
            this.logger.error(`Get Notifications error: ${error.message}`);
            throw new HttpException('Failed to fetch notifications', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('read/:notificationId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'notificationId', type: String })
  @ApiResponse({ status: 200, description: 'Notification marked as read', type: MarkAsReadResponseDto })
  async markAsRead(@Param('notificationId') notificationId: string): Promise<MarkAsReadResponseDto> {
    try {
      const result = await firstValueFrom(
        this.notificationService.MarkAsRead({ notificationId }).pipe(
          catchError((error) => {
            this.logger.error(`Mark As Read error: ${error.message}`);
            throw new HttpException('Failed to mark notification as read', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('read-all/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, description: 'All notifications marked as read', type: MarkAllAsReadResponseDto })
  async markAllAsRead(@Param('userId') userId: string): Promise<MarkAllAsReadResponseDto> {
    try {
      const result = await firstValueFrom(
        this.notificationService.MarkAllAsRead({ userId }).pipe(
          catchError((error) => {
            this.logger.error(`Mark All As Read error: ${error.message}`);
            throw new HttpException('Failed to mark all notifications as read', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(Role.LANDOWNER, Role.SELLER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send notification' })
  @ApiBody({ type: CreateNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification sent successfully', type: CreateNotificationResponseDto })
  async createNotification(@Body() body: CreateNotificationDto): Promise<CreateNotificationResponseDto> {
    try {
      const result = await firstValueFrom(
        this.notificationService.CreateNotification(body).pipe(
          catchError((error) => {
            this.logger.error(`Create Notification error: ${error.message}`);
            throw new HttpException('Failed to send notification', HttpStatus.BAD_REQUEST);
          })
        )
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}
