import { Router } from 'express';
import Container from 'typedi';
import { WebhookController } from './webhook.controller';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(WebhookController);

/**
 * @openapi
 * /webhooks/whatsapp:
 *   get:
 *     tags: [Webhooks]
 *     summary: Verify webhook endpoint for Meta Cloud API
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: hub.verify_token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: hub.challenge
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Webhook verified successfully
 *       403:
 *         description: Verification failed
 */
router.get('/whatsapp', asyncHandler(controller.verify));

/**
 * @openapi
 * /webhooks/whatsapp:
 *   post:
 *     tags: [Webhooks]
 *     summary: Receive WhatsApp real-time event updates from Meta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook acknowledged
 */
router.post('/whatsapp', asyncHandler(controller.handleCallback));

export default router;
