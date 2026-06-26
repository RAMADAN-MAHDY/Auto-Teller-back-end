import { Service } from 'typedi';
import { WebSocketServer, CampaignUpdateEvent, CampaignStats } from './websocket.server';
import { logger } from '../logger';

@Service()
export class CampaignWebSocketService {
  constructor(private readonly webSocketServer: WebSocketServer) {}

  /**
   * إرسال تحديث لحملة معينة
   */
  sendCampaignUpdate(campaignId: string, status: string, message?: string, progress?: CampaignUpdateEvent['progress']): void {
    const event: CampaignUpdateEvent = {
      campaignId,
      status,
      progress,
      message,
      timestamp: new Date(),
    };

    this.webSocketServer.broadcastCampaignUpdate(event);
    logger.info(`Campaign update sent: ${campaignId} - ${status}`);
  }

  /**
   * إرسال إحصائيات الحملة
   */
  sendCampaignStats(stats: CampaignStats): void {
    this.webSocketServer.sendCampaignStats(stats);
    logger.info(`Campaign stats sent: ${stats.campaignId}`);
  }

  /**
   * إشعار ببدء الحملة
   */
  notifyCampaignStarted(campaignId: string, title: string, userId: string): void {
    this.webSocketServer.notifyCampaignStarted(campaignId, title, userId);
    logger.info(`Campaign started notification: ${campaignId}`);
  }

  /**
   * إشعار بانتهاء الحملة
   */
  notifyCampaignCompleted(campaignId: string, title: string, userId: string, stats: CampaignStats): void {
    this.webSocketServer.notifyCampaignCompleted(campaignId, title, userId, stats);
    logger.info(`Campaign completed notification: ${campaignId}`);
  }

  /**
   * تحديث تقدم الحملة
   */
  updateCampaignProgress(campaignId: string, total: number, processed: number, sent: number, failed: number): void {
    const progress = {
      total,
      processed,
      sent,
      failed,
    };

    this.webSocketServer.notifyCampaignProgress(campaignId, progress);
    logger.debug(`Campaign progress update: ${campaignId} - ${processed}/${total}`);
  }

  /**
   * إشعار بخطأ في الحملة
   */
  notifyCampaignError(campaignId: string, title: string, error: string, userId: string): void {
    this.webSocketServer.notifyCampaignError(campaignId, title, error, userId);
    logger.error(`Campaign error notification: ${campaignId} - ${error}`);
  }

  /**
   * إنشاء إحصائيات الحملة
   */
  createCampaignStats(
    campaignId: string,
    title: string,
    status: string,
    totalCustomers: number,
    processedCustomers: number,
    sentMessages: number,
    failedMessages: number,
    startTime?: Date,
    endTime?: Date
  ): CampaignStats {
    return {
      campaignId,
      title,
      status,
      totalCustomers,
      processedCustomers,
      sentMessages,
      failedMessages,
      startTime,
      endTime,
    };
  }

  /**
   * الحصول على عدد العملاء المتصلين
   */
  getConnectedClientsCount(): number {
    return this.webSocketServer.getConnectedClientsCount();
  }

  /**
   * التحقق من تهيئة WebSocket server
   */
  isWebSocketInitialized(): boolean {
    return this.webSocketServer.isInitialized();
  }
}