import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
import {
  GetNotificationsRequestDto,
  GetNotificationsResponseDto,
  MarkAsReadRequestDto,
  MarkAsReadResponseDto,
  MarkAllAsReadRequestDto,
  MarkAllAsReadResponseDto,
  CreateNotificationRequestDto,
  CreateNotificationResponseDto,
} from './dtos/notification.dto';

@Controller('Notification')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @GrpcMethod('NotificationService', 'GetNotifications')
  async GetNotifications(
    data: GetNotificationsRequestDto
  ): Promise<GetNotificationsResponseDto> {
    return this.notificationsService.getNotifications(data);
  }

  @GrpcMethod('NotificationService', 'MarkAsRead')
  async MarkAsRead(data: MarkAsReadRequestDto): Promise<MarkAsReadResponseDto> {
    return this.notificationsService.markAsRead(data);
  }

  @GrpcMethod('NotificationService', 'MarkAllAsRead')
  async MarkAllAsRead(
    data: MarkAllAsReadRequestDto
  ): Promise<MarkAllAsReadResponseDto> {
    return this.notificationsService.markAllAsRead(data);
  }

  @GrpcMethod('NotificationService', 'CreateNotification')
  async CreateNotification(
    data: CreateNotificationRequestDto
  ): Promise<CreateNotificationResponseDto> {
    return this.notificationsService.createNotification(data);
  }
}
