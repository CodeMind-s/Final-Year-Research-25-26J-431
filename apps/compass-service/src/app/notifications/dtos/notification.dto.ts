export class GetNotificationsRequestDto {
  userId: string;
  unreadOnly: boolean;
}

export class NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  dealId?: string;
  timestamp: number;
  read: boolean;
  recipientId: string;
}

export class GetNotificationsResponseDto {
  success: boolean;
  message: string;
  notifications: NotificationDto[];
  unreadCount: number;
}

export class MarkAsReadRequestDto {
  notificationId: string;
}

export class MarkAsReadResponseDto {
  success: boolean;
  message: string;
}

export class MarkAllAsReadRequestDto {
  userId: string;
}

export class MarkAllAsReadResponseDto {
  success: boolean;
  message: string;
}

export class CreateNotificationRequestDto {
  type: string;
  title: string;
  message: string;
  dealId?: string;
  recipientId: string;
}

export class CreateNotificationResponseDto {
  success: boolean;
  message: string;
  notificationId?: string;
}
