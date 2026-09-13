import Container, { Service } from 'typedi';
import { Queue, Worker, Job } from 'bullmq';
import { createProducerConnection, createWorkerConnection } from '../configs/redis.config';
import { QUEUE_NAMES, JOB_TYPES, CampaignStatus, MessageStatus, CustomerGroup } from '../common/constants';
import { CampaignRepository } from '../modules/campaigns/campaign.repository';
import { MessageRepository } from '../modules/messages/message.repository';
import { CustomerRepository } from '../modules/customers/customer.repository';
import { TemplateRepository } from '../modules/templates/template.repository';
import { WhatsAppProvider } from '../providers/whatsapp.provider';
import { renderTemplate } from '../common/utils/template-engine';
import { logger } from '../logger';
import { CustomerService } from '../modules/customers/customer.service'; // Import CustomerService
import { decrypt } from '../common/utils/encryption';

@Service()
export class QueueService {
  private campaignQueue!: Queue;
  private schedulerQueue!: Queue;
  private campaignWorker!: Worker;
  private schedulerWorker!: Worker;

  private readonly campaignRepository = Container.get(CampaignRepository);
  private readonly messageRepository = Container.get(MessageRepository);
  private readonly customerRepository = Container.get(CustomerRepository);
  private readonly templateRepository = Container.get(TemplateRepository);
  private readonly whatsAppProvider = Container.get(WhatsAppProvider);
  private readonly customerService = Container.get(CustomerService); // Inject CustomerService

  /**
   * Initialize BullMQ Queues and Workers.
   */
  init() {
    const connection = createProducerConnection();
    const workerConnection = createWorkerConnection();

    // 1. Initialize Queues
    this.campaignQueue = new Queue(QUEUE_NAMES.CAMPAIGN, { connection: connection as any });
    this.schedulerQueue = new Queue(QUEUE_NAMES.SCHEDULER, { connection: connection as any });

    // 2. Initialize Campaign Worker
    this.campaignWorker = new Worker(
      QUEUE_NAMES.CAMPAIGN,
      async (job: Job) => {
        try {
          if (job.name === JOB_TYPES.PROCESS_CAMPAIGN) {
            await this.handleProcessCampaign(job);
          } else if (job.name === JOB_TYPES.SEND_MESSAGE) {
            await this.handleSendMessage(job);
          }
        } catch (error) {
          logger.error(`Error processing job ${job.id} of type ${job.name}:`, error);
          throw error;
        }
      },
      {
        connection: workerConnection as any,
        concurrency: 5, // Process 5 messages/campaigns in parallel
      },
    );

    // 3. Initialize Scheduler Worker (handles check-scheduled-campaigns and recalculate-customer-groups)
    this.schedulerWorker = new Worker(
      QUEUE_NAMES.SCHEDULER,
      async (job: Job) => {
        if (job.name === JOB_TYPES.CHECK_SCHEDULED) {
          await this.handleCheckScheduledCampaigns();
        } else if (job.name === JOB_TYPES.RECALCULATE_CUSTOMER_GROUPS) {
          await this.handleRecalculateCustomerGroups();
        }
      },
      { connection: workerConnection as any },
    );

    // 4. Set up event listeners
    this.campaignWorker.on('completed', (job) => {
      logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
    });

    this.campaignWorker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    });

    this.schedulerWorker.on('completed', (job) => {
      logger.debug(`Scheduler Job ${job.id} (${job.name}) completed successfully`);
    });

    this.schedulerWorker.on('failed', (job, err) => {
      logger.error(`Scheduler Job ${job?.id} (${job?.name}) failed: ${err.message}`);
    });

    logger.info('🚀 BullMQ Queues and Workers initialized');
  }

  /**
   * Queue a process-campaign job immediately.
   */
  async queueCampaign(campaignId: string) {
    await this.campaignQueue.add(JOB_TYPES.PROCESS_CAMPAIGN, { campaignId });
    logger.info(`Queued campaign ${campaignId} for processing`);
  }

  /**
   * Schedule the recurring cron job for checking scheduled campaigns.
   */
  async startSchedulerCron() {
    // Run every minute
    await this.schedulerQueue.add(
      JOB_TYPES.CHECK_SCHEDULED,
      {},
      {
        repeat: {
          pattern: '* * * * *',
        },
        jobId: 'check-scheduled-repeat',
      },
    );
    logger.info('⏰ Recurring cron job for checking scheduled campaigns registered');
  }

  /**
   * Schedule the daily cron job for recalculating customer groups.
   */
  async startDailyRecalculationCron() {
    // Run daily at 00:01 AM
    await this.schedulerQueue.add(
      JOB_TYPES.RECALCULATE_CUSTOMER_GROUPS,
      {},
      {
        repeat: {
          pattern: '1 0 * * *', // 00:01 AM every day
        },
        jobId: 'recalculate-customer-groups-daily',
      },
    );
    logger.info('⏰ Daily cron job for recalculating customer groups registered');
  }

  /**
   * Helper to process one customer batch for a campaign.
   */
  private async processCustomerBatch(
    customers: any[],
    campaign: any,
    template: any,
    campaignId: string,
    totalMessagesSoFar: number,
  ): Promise<number> {
    const messagesToCreate: Array<{
      campaignId: any;
      customerId: any;
      phoneNumber: string;
      recipientType: 'customer' | 'guarantor';
      status: MessageStatus;
    }> = [];

    for (const customer of customers) {
      const customerPhone = decrypt(customer.phoneNumberEncrypted);
      if (customerPhone) {
        messagesToCreate.push({
          campaignId: campaign._id,
          customerId: customer._id,
          phoneNumber: customerPhone,
          recipientType: 'customer',
          status: MessageStatus.PENDING,
        });
      }

      const guarantorPhone = customer.guarantorPhoneEncrypted
        ? decrypt(customer.guarantorPhoneEncrypted)?.trim()
        : '';
      if (guarantorPhone && guarantorPhone !== customerPhone) {
        messagesToCreate.push({
          campaignId: campaign._id,
          customerId: customer._id,
          phoneNumber: guarantorPhone,
          recipientType: 'guarantor',
          status: MessageStatus.PENDING,
        });
      }
    }

    if (messagesToCreate.length === 0) {
      return totalMessagesSoFar;
    }

    const createdMessages = await this.messageRepository.bulkCreate(messagesToCreate);
    const nextTotal = totalMessagesSoFar + createdMessages.length;
    await this.campaignRepository.updateById(campaignId, {
      'stats.total': nextTotal,
    });

    const customersMap = new Map(customers.map((c) => [c._id.toString(), c]));

    for (const msg of createdMessages) {
      const customer = customersMap.get(msg.customerId.toString());
      if (!customer) continue;

      const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      const monthIndex = new Date(customer.dueDate).getMonth();
      const monthName = arabicMonths[monthIndex];

      const decryptedFullName = decrypt(customer.fullNameEncrypted);
      const decryptedPhoneNumber = decrypt(customer.phoneNumberEncrypted);
      const decryptedGuarantorName = customer.guarantorNameEncrypted
        ? decrypt(customer.guarantorNameEncrypted)
        : '';
      const decryptedGuarantorPhone = customer.guarantorPhoneEncrypted
        ? decrypt(customer.guarantorPhoneEncrypted)
        : '';

      const variables: Record<string, string | number | Date> = {
        fullName: decryptedFullName,
        phoneNumber: decryptedPhoneNumber,
        guarantorName: decryptedGuarantorName,
        guarantorPhone: decryptedGuarantorPhone,
        dueDate: customer.dueDate,
        overdueDays: customer.overdueDays,
        customerGroup: customer.customerGroup,
        customer: decryptedFullName,
        month: monthName,
        day: customer.overdueDays,
      };

      await this.campaignQueue.add(JOB_TYPES.SEND_MESSAGE, {
        messageId: msg._id.toString(),
        templateName: template.name,
        templateBody: template.body,
        templateVariables: template.variables || [],
        variables,
      });
    }

    return nextTotal;
  }

  /**
   * Handler to parse campaign, build message queue jobs, and insert messages.
   */
  private async handleProcessCampaign(job: Job<{ campaignId: string }>) {
    const { campaignId } = job.data;
    logger.info(`Starting execution of campaign: ${campaignId}`);

    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      logger.error(`Campaign not found: ${campaignId}`);
      return;
    }

    await this.campaignRepository.updateStatus(campaignId, CampaignStatus.RUNNING);

    const template = await this.templateRepository.findById(campaign.templateId.toString());
    if (!template) {
      logger.warn(`Campaign ${campaignId} aborted: no template found`);
      await this.campaignRepository.updateStatus(campaignId, CampaignStatus.COMPLETED, {
        completedAt: new Date(),
        stats: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      });
      return;
    }

    const customerCursor = this.customerRepository.findByCustomerGroupCursor(campaign.targetCustomerGroup as CustomerGroup);
    const batchSize = 500;
    const safeMaxCustomers = 10000;
    const batch: any[] = [];
    let totalMessages = campaign.stats.total || 0;
    let customerCount = 0;

    for await (const customer of customerCursor) {
      customerCount += 1;
      if (customerCount > safeMaxCustomers) {
        logger.warn(`Campaign ${campaignId} exceeded the current safe maximum customer limit (${safeMaxCustomers}). Stopping ingestion.`);
        break;
      }

      batch.push(customer);
      if (batch.length >= batchSize) {
        totalMessages = await this.processCustomerBatch(batch, campaign, template, campaignId, totalMessages);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      totalMessages = await this.processCustomerBatch(batch, campaign, template, campaignId, totalMessages);
    }

    if (customerCount === 0) {
      logger.warn(`Campaign ${campaignId} aborted: no target customers`);
      await this.campaignRepository.updateStatus(campaignId, CampaignStatus.COMPLETED, {
        completedAt: new Date(),
        stats: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      });
      return;
    }

    logger.info(`Campaign ${campaignId} fully processed. ${Math.max(totalMessages, 0)} message jobs queued.`);
  }

  /**
   * Handler to send individual WhatsApp messages and record stats.
   */
  private async handleSendMessage(
    job: Job<{
      messageId: string;
      templateName: string;
      templateBody: string;
      templateVariables: string[];
      variables: Record<string, string | number | Date>;
    }>,
  ) {
    const { messageId, templateName, templateVariables, variables } = job.data;
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      logger.error(`Message not found: ${messageId}`);
      return;
    }

    const campaignId = message.campaignId.toString();

    // Map template variables to an array of values in order of appearance
    const mappedVariables: string[] = (templateVariables || []).map((varName) => {
      const val = variables[varName];
      if (val instanceof Date) {
        return val.toISOString().split('T')[0]; // Format Date as YYYY-MM-DD
      }
      return val !== undefined ? String(val) : '';
    });

    // Send using WhatsApp provider template message method
    const result = await this.whatsAppProvider.sendTemplateMessage(
      message.phoneNumber,
      templateName,
      mappedVariables,
    );

    if (result.status === 'success') {
      await this.messageRepository.updateById(messageId, {
        status: MessageStatus.SENT,
        whatsappMessageId: result.whatsappMessageId,
        sentAt: new Date(),
      });
      const updatedCampaign = await this.campaignRepository.incrementStat(campaignId, 'sent');
      if (updatedCampaign) {
        const totalProcessed =
          updatedCampaign.stats.sent +
          updatedCampaign.stats.delivered +
          updatedCampaign.stats.read +
          updatedCampaign.stats.failed;
        logger.debug(`Campaign ${campaignId} processed counters updated via incrementStat: ${totalProcessed}/${updatedCampaign.stats.total}`);
      }
    } else {
      await this.messageRepository.updateById(messageId, {
        status: MessageStatus.FAILED,
        error: result.error || 'Unknown error',
      });
      const updatedCampaign = await this.campaignRepository.incrementStat(campaignId, 'failed');
      if (updatedCampaign) {
        const totalProcessed =
          updatedCampaign.stats.sent +
          updatedCampaign.stats.delivered +
          updatedCampaign.stats.read +
          updatedCampaign.stats.failed;
        logger.debug(`Campaign ${campaignId} processed counters updated via incrementStat: ${totalProcessed}/${updatedCampaign.stats.total}`);
      }
    }

    // Check if the overall campaign has finished sending all messages
    await this.checkAndUpdateCampaignCompletion(campaignId);
  }

  /**
   * Handler for daily recalculation of customer groups.
   */
  private async handleRecalculateCustomerGroups() {
    logger.info('Starting daily recalculation of customer groups...');
    await this.customerService.recalculateAllCustomerGroups();
    logger.info('Daily recalculation of customer groups completed.');
  }

  /**
   * Helper to mark campaign complete when all messages are processed.
   */
  private async checkAndUpdateCampaignCompletion(campaignId: string) {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) return;

    const totalProcessed =
      campaign.stats.sent +
      campaign.stats.delivered +
      campaign.stats.read +
      campaign.stats.failed;

    if (totalProcessed >= campaign.stats.total) {
      await this.campaignRepository.updateStatus(campaignId, CampaignStatus.COMPLETED, {
        completedAt: new Date(),
      });
      logger.info(`Campaign completed: ${campaignId}`);
    }
  }

  /**
   * Periodically check for scheduled campaigns that are ready to run.
   */
  private async handleCheckScheduledCampaigns() {
    logger.debug('Checking for scheduled campaigns...');
    const scheduled = await this.campaignRepository.findScheduledCampaigns();

    for (const campaign of scheduled) {
      logger.info(`Triggering scheduled campaign: ${campaign._id}`);
      // Mark campaign as scheduled to running/queued to avoid double-processing
      await this.campaignRepository.updateStatus(campaign.id, CampaignStatus.RUNNING);
      await this.queueCampaign(campaign.id);
    }
  }

  /**
   * Graceful shutdown of queues and workers.
   */
  async close() {
    await this.campaignQueue?.close();
    await this.schedulerQueue?.close();
    await this.campaignWorker?.close();
    await this.schedulerWorker?.close();
    logger.info('🔴 BullMQ connections closed gracefully');
  }
}