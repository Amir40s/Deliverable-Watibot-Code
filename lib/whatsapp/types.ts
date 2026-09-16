export type WhatsAppConnectionMethod = 'manual' | 'embedded_signup' | 'qr';

export type QRSessionStatus =
  | 'pending'
  | 'qr_ready'
  | 'scanning'
  | 'authenticated'
  | 'connected'
  | 'expired'
  | 'failed'
  | 'disconnected';

export interface WhatsAppQRSessionDTO {
  id: string;
  organizationId: string;
  sessionToken: string;
  status: QRSessionStatus;
  qrData?: string | null;
  errorReason?: string | null;
  expiresAt: Date | string;
  connectedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SendQRMessageOptions {
  organizationId: string;
  contactId: string;
  recipientPhone: string;
  messageText: string;
  senderId?: string;
  mediaUrl?: string;
  contentType?: string;
  fileName?: string;
  mimetype?: string;
  replyToMessageId?: string;
  replyToWaId?: string;
  interactiveData?: any;
  buttons?: any[];
  footerText?: string;
  channelId?: string;
}


