import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { env } from '../../configs/env.config';
import { MessageRepository } from '../messages/message.repository';
import { CampaignRepository } from '../campaigns/campaign.repository';
import { MessageStatus } from '../../common/constants';
import { logger } from '../../logger';

@Service()
export class WebhookController {
  private readonly messageRepository = Container.get(MessageRepository);
  private readonly campaignRepository = Container.get(CampaignRepository);

  /**
   * GET verification endpoint for Meta Cloud API webhook setup.
   */
  verify = async (req: Request, res: Response): Promise<void> => {
    const mode = req.query.hub_mode;
    const token = req.query.hub_verify_token;
    const challenge = req.query.hub_challenge;

    if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      logger.info('✅ Webhook verified successfully by Meta');
      res.status(200).send(challenge);
    } else {
      logger.warn('❌ Webhook verification failed. Token mismatch.');
      res.status(403).send('Forbidden');
    }
  };

  /**
   * POST callback endpoint where Meta sends real-time message status updates.
   */
  handleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body;
      logger.debug('Webhook callback received payload:', JSON.stringify(body, null, 2));

      // Validate WhatsApp event structure
      if (body.object === 'whatsapp_business_account') {
        const entries = body.entry || [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            if (change.field === 'messages') {
              const value = change.value;
              const statuses = value?.statuses || [];

              for (const statusObj of statuses) {
                const whatsappMessageId = statusObj.id;
                const statusStr = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
                
                // Map WhatsApp status to MessageStatus enum
                let targetStatus: MessageStatus | undefined;
                if (statusStr === 'sent') targetStatus = MessageStatus.SENT;
                else if (statusStr === 'delivered') targetStatus = MessageStatus.DELIVERED;
                else if (statusStr === 'read') targetStatus = MessageStatus.READ;
                else if (statusStr === 'failed') targetStatus = MessageStatus.FAILED;

                if (targetStatus && whatsappMessageId) {
                  await this.updateMessageAndCampaignStats(whatsappMessageId, targetStatus, statusObj.errors?.[0]?.message);
                }
              }
            }
          }
        }
      }

      // Always return 200 OK to Meta to acknowledge receipt
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      logger.error('Error handling webhook callback:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  private async updateMessageAndCampaignStats(
    whatsappMessageId: string,
    status: MessageStatus,
    errorMessage?: string,
  ): Promise<void> {
    const message = await this.messageRepository.findByWhatsAppId(whatsappMessageId);
    if (!message) {
      logger.debug(`Webhook status update ignored: WhatsApp message ID ${whatsappMessageId} not in local database.`);
      return;
    }

    // Only update if the status is a progression or different
    if (message.status === status) {
      return;
    }

    const additionalData: any = {};
    if (status === MessageStatus.DELIVERED) {
      additionalData.deliveredAt = new Date();
    } else if (status === MessageStatus.READ) {
      additionalData.readAt = new Date();
      // Ensure deliveredAt is also populated if read arrived first/fast
      if (!message.deliveredAt) {
        additionalData.deliveredAt = new Date();
      }
    } else if (status === MessageStatus.FAILED && errorMessage) {
      additionalData.error = errorMessage;
    }

    // Update Message log
    await this.messageRepository.updateById(message.id, {
      status,
      ...additionalData,
    });
    
    logger.info(`Message ${message.id} status updated to ${status} via webhook.`);

    // Recalculate and update Campaign statistics
    const campaignId = message.campaignId.toString();
    const campaign = await this.campaignRepository.findById(campaignId);
    if (campaign) {
      const stats = await this.messageRepository.getCampaignStats(campaignId);
      await this.campaignRepository.updateById(campaignId, {
        stats: {
          total: campaign.stats?.total || 0,
          ...stats,
        },
      });
      logger.debug(`Recalculated campaign ${campaignId} stats:`, stats);
    }
  }
}
