import { Request, Response } from 'express';
import Container, { Service } from 'typedi';
import { CampaignWebSocketService } from '../../websocket/campaign-websocket.service';
import { MessageRepository } from '../messages/message.repository';
import { CampaignRepository } from '../campaigns/campaign.repository';
import { MessageStatus } from '../../common/constants';
import { logger } from '../../logger';
import { TemplateService } from '../templates/template.service';
import { TemplateRepository } from '../templates/template.repository';

@Service()
export class WebhookController {
  private readonly messageRepository = Container.get(MessageRepository);
  private readonly campaignRepository = Container.get(CampaignRepository);
  private readonly campaignWebSocketService = Container.get(CampaignWebSocketService);

  /**
   * GET verification endpoint for Meta Cloud API webhook setup.
   */
  verify = async (req: Request, res: Response): Promise<void> => {
    const mode = req.query['hub.mode'] || req.query.hub_mode;
    const token = req.query['hub.verify_token'] || req.query.hub_verify_token;
    const challenge = req.query['hub.challenge'] || req.query.hub_challenge;

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
      logger.info(`Incoming Webhook callback payload: ${JSON.stringify(body)}`);

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
                logger.info(`Processing status update event for WhatsApp Message ID: ${whatsappMessageId}, Status: ${statusStr}`);
                
                // Map WhatsApp status to MessageStatus enum
                let targetStatus: MessageStatus | undefined;
                if (statusStr === 'sent') targetStatus = MessageStatus.SENT;
                else if (statusStr === 'delivered') targetStatus = MessageStatus.DELIVERED;
                else if (statusStr === 'read') targetStatus = MessageStatus.READ;
                else if (statusStr === 'failed') targetStatus = MessageStatus.FAILED;

                if (targetStatus && whatsappMessageId) {
                  await this.updateMessageAndCampaignStats(whatsappMessageId, targetStatus, statusObj.errors?.[0]?.message);
                } else {
                  logger.info(`Ignored status update: targetStatus or whatsappMessageId is empty/invalid. targetStatus: ${targetStatus}, ID: ${whatsappMessageId}`);
                }
              }
            } else if (change.field === 'message_templates') {
              const value = change.value;
              const eventType = value?.event;
              const templateId = value?.message_template_id;
              const templateName = value?.message_template_name;

              logger.info(`Received template webhook event: ${eventType} for template ${templateName} (${templateId})`);

              if (templateId) {
                const templateService = Container.get(TemplateService);
                if (eventType === 'APPROVED') {
                  await templateService.syncSingleMetaTemplate(String(templateId));
                } else if (eventType === 'REJECTED' || eventType === 'DELETED') {
                  const templateRepository = Container.get(TemplateRepository);
                  await templateRepository.findOneAndDelete({ name: templateName, isMeta: true });
                  logger.info(`Deleted rejected/deleted template ${templateName} from local DB.`);
                }
              }
            }
          }
        }
      } else {
        logger.info(`Webhook callback payload object is not 'whatsapp_business_account': ${body.object}`);
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
      logger.info(`Webhook status update ignored: WhatsApp message ID ${whatsappMessageId} not in local database.`);
      return;
    }

    // Only update if the status is a progression or different
    if (message.status === status) {
      logger.info(`Message status is already ${status} for ID ${message.id}. No update needed.`);
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
      logger.info(`Recalculated campaign ${campaignId} stats: ${JSON.stringify(stats)}`);
      // Emit WebSocket updates for the specific message and campaign stats
      this.campaignWebSocketService.sendMessageUpdate(campaignId, {
        id: message.id,
        status,
        deliveredAt: additionalData.deliveredAt,
        readAt: additionalData.readAt,
        error: additionalData.error,
      });
      this.campaignWebSocketService.sendCampaignStats({
        campaignId,
        title: campaign.title,
        status: campaign.status,
        totalCustomers: campaign.stats?.total || 0,
        processedCustomers: (stats[MessageStatus.SENT] || 0) + (stats[MessageStatus.DELIVERED] || 0) + (stats[MessageStatus.READ] || 0) + (stats[MessageStatus.FAILED] || 0),
        sentMessages: stats[MessageStatus.SENT] || 0,
        failedMessages: stats[MessageStatus.FAILED] || 0,
      });
    }
  }
}
