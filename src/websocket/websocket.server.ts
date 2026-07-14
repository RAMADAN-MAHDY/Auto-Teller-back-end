import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import Container, { Service } from 'typedi';
import { logger } from '../logger';
import { env } from '../configs/env.config';

export interface CampaignUpdateEvent {
  campaignId: string;
  status: string;
  progress?: {
    total: number;
    processed: number;
    failed: number;
    sent: number;
    delivered?: number;
    read?: number;
  };
  message?: string;
  timestamp: Date;
}

export interface CampaignStats {
  campaignId: string;
  title: string;
  status: string;
  totalCustomers: number;
  processedCustomers: number;
  sentMessages: number;
  deliveredMessages?: number;
  readMessages?: number;
  failedMessages: number;
  startTime?: Date;
  endTime?: Date;
}

@Service()
export class WebSocketServer {
  private io: SocketServer | null = null;
  private connectedClients: Map<string, Socket> = new Map();

  initialize(httpServer: HttpServer): void {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, socket);
      logger.info(`WebSocket client connected: ${clientId}`);

      // Join campaign room if provided
      socket.on('join-campaign', (campaignId: string) => {
        socket.join(`campaign:${campaignId}`);
        logger.info(`Client ${clientId} joined campaign room: ${campaignId}`);
      });

      // Leave campaign room
      socket.on('leave-campaign', (campaignId: string) => {
        socket.leave(`campaign:${campaignId}`);
        logger.info(`Client ${clientId} left campaign room: ${campaignId}`);
      });

      // Subscribe to user's campaigns
      socket.on('subscribe-user-campaigns', (userId: string) => {
        socket.join(`user:${userId}`);
        logger.info(`Client ${clientId} subscribed to user campaigns: ${userId}`);
      });

      socket.on('disconnect', () => {
        this.connectedClients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
      });
    });

    logger.info('WebSocket server initialized');
  }

  broadcastCampaignUpdate(event: CampaignUpdateEvent): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    // Broadcast to specific campaign room
    this.io.to(`campaign:${event.campaignId}`).emit('campaign-update', event);
    
    // Also broadcast to all connected clients for global updates
    this.io.emit('campaign-global-update', event);
    
    logger.debug(`Campaign update broadcasted: ${event.campaignId} - ${event.status}`);
  }

  sendCampaignStats(stats: CampaignStats): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    // Send to specific campaign room
    this.io.to(`campaign:${stats.campaignId}`).emit('campaign-stats', stats);
    
    logger.debug(`Campaign stats sent: ${stats.campaignId}`);
  }

  notifyCampaignStarted(campaignId: string, title: string, userId: string): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    const event: CampaignUpdateEvent = {
      campaignId,
      status: 'started',
      message: `Campaign "${title}" has started`,
      timestamp: new Date(),
    };

    // Notify campaign room
    this.io.to(`campaign:${campaignId}`).emit('campaign-update', event);
    
    // Notify user who created the campaign
    this.io.to(`user:${userId}`).emit('campaign-update', event);
    
    logger.info(`Campaign started notification sent: ${campaignId}`);
  }

  notifyCampaignCompleted(campaignId: string, title: string, userId: string, stats: CampaignStats): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    const event: CampaignUpdateEvent = {
      campaignId,
      status: 'completed',
      message: `Campaign "${title}" has completed`,
      progress: {
        total: stats.totalCustomers,
        processed: stats.processedCustomers,
        sent: stats.sentMessages,
        failed: stats.failedMessages,
      },
      timestamp: new Date(),
    };

    // Notify campaign room
    this.io.to(`campaign:${campaignId}`).emit('campaign-update', event);
    
    // Notify user who created the campaign
    this.io.to(`user:${userId}`).emit('campaign-update', event);
    
    // Send final stats
    this.sendCampaignStats(stats);
    
    logger.info(`Campaign completed notification sent: ${campaignId}`);
  }

  notifyCampaignProgress(campaignId: string, progress: CampaignUpdateEvent['progress']): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    const event: CampaignUpdateEvent = {
      campaignId,
      status: 'in-progress',
      progress,
      message: `Progress update`,
      timestamp: new Date(),
    };

    this.io.to(`campaign:${campaignId}`).emit('campaign-update', event);
    
    logger.debug(`Campaign progress update sent: ${campaignId}`);
  }

  notifyCampaignError(campaignId: string, title: string, error: string, userId: string): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    const event: CampaignUpdateEvent = {
      campaignId,
      status: 'error',
      message: `Campaign "${title}" encountered an error: ${error}`,
      timestamp: new Date(),
    };

    this.io.to(`campaign:${campaignId}`).emit('campaign-update', event);
    this.io.to(`user:${userId}`).emit('campaign-update', event);
    
    logger.error(`Campaign error notification sent: ${campaignId} - ${error}`);
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  broadcastMessageUpdate(campaignId: string, message: { id: string; status: string; deliveredAt?: Date; readAt?: Date; error?: string }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    this.io.to(`campaign:${campaignId}`).emit('message-update', message);
    logger.info(`Message update broadcasted for campaign: ${campaignId}, message: ${message.id}, status: ${message.status}`);
  }

  isInitialized(): boolean {
    return this.io !== null;
  }
}