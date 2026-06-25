import { Service } from 'typedi';
import axios from 'axios';
import { env } from '../configs/env.config';
import { logger } from '../logger';

export interface ISendMessageResponse {
  whatsappMessageId: string;
  status: 'success' | 'failed';
  error?: string;
}

@Service()
export class WhatsAppProvider {
  private readonly apiUrl: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor() {
    this.apiUrl = env.WHATSAPP_API_URL;
    this.accessToken = env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  }

  /**
   * Send a free-form/text WhatsApp message to a customer.
   */
  async sendTextMessage(to: string, body: string): Promise<ISendMessageResponse> {
    try {
      const cleanedPhone = this.cleanPhoneNumber(to);
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanedPhone,
        type: 'text',
        text: {
          body: body,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const messageId = response.data?.messages?.[0]?.id;
      if (!messageId) {
        throw new Error('No message ID returned from WhatsApp Cloud API');
      }

      logger.debug(`WhatsApp message sent to ${to}, ID: ${messageId}`);
      return {
        whatsappMessageId: messageId,
        status: 'success',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to send WhatsApp message to ${to}: ${errorMessage}`, error.response?.data);
      return {
        whatsappMessageId: '',
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  private cleanPhoneNumber(phone: string): string {
    // Strip non-digits except maybe the leading plus (Meta API prefers digits only)
    return phone.replace(/\D/g, '');
  }
}
