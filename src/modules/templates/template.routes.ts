import { Router } from 'express';
import Container from 'typedi';
import { TemplateController } from './template.controller';
import { authenticate, validate } from '../../middlewares';
import { createTemplateSchema, updateTemplateSchema, templateQuerySchema } from './template.dto';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(TemplateController);

router.use(authenticate);

/**
 * @openapi
 * /templates:
 *   post:
 *     tags: [Templates]
 *     summary: Create a new message template
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, body]
 *             properties:
 *               name: { type: string }
 *               body: { type: string, example: "Dear {{name}}, your OTP is {{otp}}." }
 *     responses:
 *       201:
 *         description: Template created
 *       409:
 *         description: Template name already exists
 */
router.post('/', validate(createTemplateSchema), asyncHandler(controller.create));

/**
 * @openapi
 * /templates:
 *   get:
 *     tags: [Templates]
 *     summary: Get all templates (with search and pagination)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by template name
 *     responses:
 *       200:
 *         description: Templates list
 */
router.get('/', validate(templateQuerySchema, 'query'), asyncHandler(controller.findAll));

/**
 * @openapi
 * /templates/meta:
 *   get:
 *     tags: [Templates]
 *     summary: Fetch and sync Meta approved templates
 *     responses:
 *       200:
 *         description: Meta templates list
 */
router.get('/meta', asyncHandler(controller.getMetaTemplates));

/**
 * @openapi
 * /templates/{id}:
 *   get:
 *     tags: [Templates]
 *     summary: Get a template by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Not found
 */
router.get('/:id', asyncHandler(controller.findById));

/**
 * @openapi
 * /templates/{id}:
 *   patch:
 *     tags: [Templates]
 *     summary: Update a template
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template updated
 */
router.patch('/:id', validate(updateTemplateSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /templates/{id}:
 *   delete:
 *     tags: [Templates]
 *     summary: Delete a template
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Template deleted
 */
router.delete('/:id', asyncHandler(controller.delete));

export default router;
