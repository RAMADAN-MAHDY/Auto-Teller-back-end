import { Router } from 'express';
import Container from 'typedi';
import { UserController } from './user.controller';
import { authenticate, authorize, validate } from '../../middlewares';
import { createUserSchema, updateUserSchema } from './user.dto';
import { paginationQuerySchema } from '../../common/dto';
import { asyncHandler } from '../../common/utils';
import { UserRole } from '../../common/constants';

const router = Router();
const controller = Container.get(UserController);

// All routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, employee]
 *     responses:
 *       201:
 *         description: User created
 *       409:
 *         description: Email already exists
 */
router.post(
  '/',
  authorize(UserRole.ADMIN),
  validate(createUserSchema),
  asyncHandler(controller.create),
);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users (Admin only)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Users list
 */
router.get(
  '/',
  authorize(UserRole.ADMIN),
  validate(paginationQuerySchema, 'query'),
  asyncHandler(controller.findAll),
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', asyncHandler(controller.findById));

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [admin, employee] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch(
  '/:id',
  authorize(UserRole.ADMIN),
  validate(updateUserSchema),
  asyncHandler(controller.update),
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: User deleted
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  asyncHandler(controller.delete),
);

export default router;
