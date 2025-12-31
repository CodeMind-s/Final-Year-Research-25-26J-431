import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './schemas/notification.schema';
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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>
  ) {}

  async getNotifications(
    data: GetNotificationsRequestDto
  ): Promise<GetNotificationsResponseDto> {
    try {
      const query: any = { recipientId: data.userId };
      if (data.unreadOnly) {
        query.read = false;
      }

      const notifications = await this.notificationModel
        .find(query)
        .sort({ timestamp: -1 });

      const unreadCount = await this.notificationModel.countDocuments({
        recipientId: data.userId,
        read: false,
      });

      return {
        success: true,
        message: `Found ${notifications.length} notifications`,
        notifications: notifications.map((n) => ({
          id: n._id.toString(),
          type: n.type,
          title: n.title,
          message: n.message,
          dealId: n.dealId,
          timestamp: n.timestamp,
          read: n.read,
          recipientId: n.recipientId,
        })),
        unreadCount,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get notifications: ${error.message}`
      );
    }
  }

  async markAsRead(data: MarkAsReadRequestDto): Promise<MarkAsReadResponseDto> {
    try {
      await this.notificationModel.findByIdAndUpdate(data.notificationId, {
        read: true,
      });

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to mark notification as read: ${error.message}`
      );
    }
  }

  async markAllAsRead(
    data: MarkAllAsReadRequestDto
  ): Promise<MarkAllAsReadResponseDto> {
    try {
      await this.notificationModel.updateMany(
        { recipientId: data.userId, read: false },
        { read: true }
      );

      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to mark all notifications as read: ${error.message}`
      );
    }
  }

  async createNotification(
    data: CreateNotificationRequestDto
  ): Promise<CreateNotificationResponseDto> {
    try {
      const notification = await this.notificationModel.create({
        type: data.type,
        title: data.title,
        message: data.message,
        dealId: data.dealId,
        recipientId: data.recipientId,
        timestamp: Date.now(),
        read: false,
      });

      return {
        success: true,
        message: 'Notification created successfully',
        notificationId: notification._id.toString(),
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create notification: ${error.message}`
      );
    }
  }
}
