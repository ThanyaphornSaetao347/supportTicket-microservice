export interface KafkaMessage {
  eventType: string;
  timestamp: string;
  data?: any;
}

export interface UserEvent extends KafkaMessage {
  eventType: 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'USER_ROLE_CHANGED';
  userId: number;
  username?: string;
  email?: string;
}

export interface NotificationEvent extends KafkaMessage {
  eventType: 'SEND_EMAIL' | 'SEND_SMS' | 'SEND_PUSH';
  recipientId: number;
  message: string;
  channel: 'email' | 'sms' | 'push';
}