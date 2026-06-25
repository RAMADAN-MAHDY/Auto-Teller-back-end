import { Router } from 'express';
import Container from 'typedi';
import { CampaignController } from './campaign.controller';
import { authenticate, validate } from '../../middlewares';
import { createCampaignSchema, updateCampaignSchema, campaignQuerySchema } from './campaign.dto';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(CampaignController);

router.use(authenticate);

/**
 * @openapi
 * /campaigns:
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a new campaign (draft or scheduled)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, templateId, targetGroupId]
 *             properties:
 *               title: { type: string }
 *               templateId: { type: string }
 *               targetGroupId: { type: string }
 *               scheduledAt: { type: string, format: date-time, example: "2026-06-30T12:00:00Z" }
 *     responses:
 *       201:
 *         description: Campaign created
 */
router.post('/', validate(createCampaignSchema), asyncHandler(controller.create));

/**
 * @openapi
 * /campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get all campaigns (with search and filters)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, scheduled, running, completed, failed] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaigns list
 */
router.get('/', validate(campaignQuerySchema, 'query'), asyncHandler(controller.findAll));

/**
 * @openapi
 * /campaigns/{id}:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get campaign details by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign details
 */
router.get('/:id', asyncHandler(controller.findById));

/**
 * @openapi
 * /campaigns/{id}:
 *   patch:
 *     tags: [Campaigns]
 *     summary: Update a campaign (only if draft or scheduled)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign updated
 */
router.patch('/:id', validate(updateCampaignSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /campaigns/{id}/trigger:
 *   post:
 *     tags: [Campaigns]
 *     summary: Manually trigger/execute a draft or scheduled campaign
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign triggered successfully
 */
router.post('/:id/trigger', asyncHandler(controller.trigger));

/**
 * @openapi
 * /campaigns/{id}:
 *   delete:
 *     tags: [Campaigns]
 *     summary: Delete a campaign (only if draft)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Campaign deleted
 */
router.delete('/:id', asyncHandler(controller.delete));

export default router;
