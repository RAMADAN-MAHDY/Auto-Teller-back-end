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
  private readonly businessAccountId: string;

  constructor() {
    this.apiUrl = env.WHATSAPP_API_URL;
    this.accessToken = env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    this.businessAccountId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
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

  /**
   * Send a template WhatsApp message to a customer with dynamic parameters.
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    variables: string[],
    languageCode = 'ar'
  ): Promise<ISendMessageResponse> {
    try {
      const cleanedPhone = this.cleanPhoneNumber(to);
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components: [
            {
              type: 'body',
              parameters: variables.map(value => ({
                type: 'text',
                text: value,
              })),
            },
          ],
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

      logger.debug(`WhatsApp template message (${templateName}) sent to ${to}, ID: ${messageId}`);
      return {
        whatsappMessageId: messageId,
        status: 'success',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to send WhatsApp template message to ${to}: ${errorMessage}`, error.response?.data);
      return {
        whatsappMessageId: '',
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Specific helper to send installment reminder using template 'bankreach'
   */
  async sendInstallmentReminder(
    to: string,
    data: {
      customer: string;
      month: string;
      day: number;
    }
  ) {
    return this.sendTemplateMessage(
      to,
      'bankreach',
      [
        data.customer,
        data.month,
        data.day.toString(),
      ]
    );
  }

  private cleanPhoneNumber(phone: string): string {
    // Strip non-digits except maybe the leading plus (Meta API prefers digits only)
    return phone.replace(/\D/g, '');
  }

  /**
   * Fetch approved message templates from Meta Graph API.
   */
  async getMetaTemplates(): Promise<any[]> {
    try {
      const url = `${this.apiUrl}/${this.businessAccountId}/message_templates`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          limit: 100, // retrieve up to 100 templates
        },
      });
      return response.data?.data || [];
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to fetch Meta templates: ${errorMessage}`, error.response?.data);
      throw new Error(`Failed to fetch Meta templates: ${errorMessage}`);
    }
  }

  /**
   * Fetch a single template's details from Meta Graph API.
   */
  async getMetaTemplateById(templateId: string): Promise<any> {
    try {
      const url = `${this.apiUrl}/${templateId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to fetch Meta template ${templateId}: ${errorMessage}`, error.response?.data);
      throw new Error(`Failed to fetch Meta template: ${errorMessage}`);
    }
  }
}
