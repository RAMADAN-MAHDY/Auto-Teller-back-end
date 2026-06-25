import { Router } from 'express';
import Container from 'typedi';
import { MessageController } from './message.controller';
import { authenticate, validate } from '../../middlewares';
import { messageQuerySchema } from './message.dto';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(MessageController);

router.use(authenticate);

/**
 * @openapi
 * /messages/campaign/{campaignId}:
 *   get:
 *     tags: [Messages]
 *     summary: Retrieve message delivery logs for a campaign
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, sent, delivered, read, failed] }
 *     responses:
 *       200:
 *         description: List of message logs
 */
router.get('/campaign/:campaignId', validate(messageQuerySchema, 'query'), asyncHandler(controller.findByCampaign));

/**
 * @openapi
 * /messages/{id}:
 *   get:
 *     tags: [Messages]
 *     summary: Retrieve details of a specific message log
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Message log details
 */
router.get('/:id', asyncHandler(controller.findById));

export default router;
