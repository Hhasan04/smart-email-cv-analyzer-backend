export interface PubSubPushDto {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export interface GmailNotificationData {
  emailAddress: string;
  historyId: string | number;
}
