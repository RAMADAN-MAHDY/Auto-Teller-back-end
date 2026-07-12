import 'reflect-metadata';
import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import Container from 'typedi';
import axios from 'axios';



import { env } from './configs/env.config';
import { connectDatabase, disconnectDatabase } from './configs/database.config';
import { disconnectRedis } from './configs/redis.config';
import { swaggerSpec } from './configs/swagger.config';
import { logger } from './logger';
import { QueueService } from './queues/queue.service';
import { WebSocketServer } from './websocket/websocket.server';

// Middlewares
import {
  errorHandler,
  requestLogger,
  mongoSanitizer,
  parameterPollutionProtection,
} from './middlewares';

// Route Imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import customerRoutes from './modules/customers/customer.routes';

import templateRoutes from './modules/templates/template.routes';
import campaignRoutes from './modules/campaigns/campaign.routes';
import messageRoutes from './modules/messages/message.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';
import reportRoutes from './modules/reports/report.routes';

const app: Application = express();
const httpServer = createServer(app);

// 1. Establish Database Connection
connectDatabase();

// 2. Initialize Queue System (Workers and Schedulers run in-process for MVP)
const queueService = Container.get(QueueService);
queueService.init();
queueService.startSchedulerCron();

// 3. Initialize WebSocket Server
const webSocketServer = Container.get(WebSocketServer);
webSocketServer.initialize(httpServer);

// 3. Global Security and Logging Middlewares
// console.log('CORS_ORIGIN:', env.CORS_ORIGIN);
const corsOrigin = env.CORS_ORIGIN.split(',');

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitizer);
app.use(parameterPollutionProtection);
app.use(requestLogger);

// 4. OpenAPI / Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
logger.info(`📖 API documentation available at http://localhost:${env.PORT}/api-docs`);

// 5. Register Routes
const apiPrefix = '/api/v1';

// Webhooks must be public (Meta API bypasses JWT check)
app.use(`${apiPrefix}/webhooks`, webhookRoutes);

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/customers`, customerRoutes);

app.use(`${apiPrefix}/templates`, templateRoutes);
app.use(`${apiPrefix}/campaigns`, campaignRoutes);
app.use(`${apiPrefix}/messages`, messageRoutes);
app.use(`${apiPrefix}/reports`, reportRoutes);

// Base Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});


/**
 * STEP 1: Exchange code → Access Token
 */
app.post("/exchange-token", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const response = await axios.get(
      "https://graph.facebook.com/v25.0/oauth/access_token",
      {
        params: {
          client_id: process.env.APP_ID,
          client_secret: process.env.APP_SECRET,
          redirect_uri: process.env.REDIRECT_URI,
          code: code,
        },
      }
    );

    return res.json({
      success: true,
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});


/**
 * STEP 2: Handle Callback from WhatsApp
 */
app.get("/callback", (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.status(400).send("Login failed: " + error);
  }

  if (!code) {
    return res.status(400).send("No code received");
  }

  // هنا عندك الكود
  console.log("AUTH CODE:", code);

  res.send(`
    <h2>Success</h2>
    <p>You can now return to Postman or backend</p>
    <p>Code: ${code}</p>
  `);
});










// 6. Global Error Handler Middleware
app.use(errorHandler);

// 7. Start Listening
const server = httpServer.listen(env.PORT, () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  logger.info(`🔌 WebSocket server initialized on port ${env.PORT}`);
});

// 8. Graceful Shutdown Handlers
async function gracefulShutdown(signal: string) {
  logger.warn(`⚠️ Received ${signal}. Starting graceful shutdown...`);

  // Close HTTP Server
  server.close(() => {
    logger.info('🔴 HTTP server closed');
  });

  // Close queues and workers
  await queueService.close();

  // Close DB Connections
  await disconnectDatabase();
  await disconnectRedis();

  logger.info('👋 Graceful shutdown complete. Exiting process.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
