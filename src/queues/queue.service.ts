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

    // Set campaign status to RUNNING
    await this.campaignRepository.updateStatus(campaignId, CampaignStatus.RUNNING);

    const template = await this.templateRepository.findById(campaign.templateId.toString());
    // Use targetCustomerGroup from campaign to fetch customers
    const customers = await this.customerRepository.findByCustomerGroup(campaign.targetCustomerGroup as CustomerGroup, { page: 1, limit: 100000 }); // Assuming large limit for campaign processing

    if (!template || customers.data.length === 0) {
      logger.warn(`Campaign ${campaignId} aborted: no template or no target customers`);
      await this.campaignRepository.updateStatus(campaignId, CampaignStatus.COMPLETED, {
        completedAt: new Date(),
        stats: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      });
      return;
    }

    // Create Message entries in bulk to ensure they exist before sending
    const messagesToCreate = customers.data.map((customer) => ({
      campaignId: campaign._id,
      customerId: customer._id,
      phoneNumber: customer.phoneNumber,
      status: MessageStatus.PENDING,
    }));

    // Perform bulk write in Mongo
    const createdMessages = await this.messageRepository.bulkCreate(messagesToCreate);

    // Update campaign total stats count
    await this.campaignRepository.updateById(campaignId, {
      'stats.total': createdMessages.length,
    });

    // Queue send-message job for each created message
    for (const msg of createdMessages) {
      const customer = customers.data.find((c) => c._id.toString() === msg.customerId.toString());
      if (customer) {
        // Construct variables mapping
        const variables: Record<string, string | number | Date> = {
          fullName: customer.fullName,
          phoneNumber: customer.phoneNumber,
          guarantorName: customer.guarantorName || '',
          guarantorPhone: customer.guarantorPhone || '',
          dueDate: customer.dueDate,
          overdueDays: customer.overdueDays,
          customerGroup: customer.customerGroup,
        };

        // Add a job to process sending this message
        await this.campaignQueue.add(JOB_TYPES.SEND_MESSAGE, {
          messageId: msg._id.toString(),
          templateBody: template.body,
          variables,
        });
      }
    }

    logger.info(`Campaign ${campaignId} fully processed. ${createdMessages.length} message jobs queued.`);
  }

  /**
   * Handler to send individual WhatsApp messages and record stats.
   */
  private async handleSendMessage(
    job: Job<{ messageId: string; templateBody: string; variables: Record<string, string | number | Date> }>,
  ) {
    const { messageId, templateBody, variables } = job.data;
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      logger.error(`Message not found: ${messageId}`);
      return;
    }

    const campaignId = message.campaignId.toString();

    // Render body using template variables
    const renderedBody = renderTemplate(templateBody, variables);

    // Send using WhatsApp provider
    const result = await this.whatsAppProvider.sendTextMessage(message.phoneNumber, renderedBody);

    if (result.status === 'success') {
      await this.messageRepository.updateById(messageId, {
        status: MessageStatus.SENT,
        whatsappMessageId: result.whatsappMessageId,
        sentAt: new Date(),
      });
      await this.campaignRepository.incrementStat(campaignId, 'sent');
    } else {
      await this.messageRepository.updateById(messageId, {
        status: MessageStatus.FAILED,
        error: result.error || 'Unknown error',
      });
      await this.campaignRepository.incrementStat(campaignId, 'failed');
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

    const stats = await this.messageRepository.getCampaignStats(campaignId);
    const totalProcessed =
      stats[MessageStatus.SENT] +
      stats[MessageStatus.DELIVERED] +
      stats[MessageStatus.READ] +
      stats[MessageStatus.FAILED];

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
