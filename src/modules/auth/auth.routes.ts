import { Router } from 'express';
import Container from 'typedi';
import { AuthController } from './auth.controller';
import { authenticate, validate } from '../../middlewares';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.dto';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(AuthController);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
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
 *                 example: john.doe@bankreach.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       201:
 *         description: Registration successful
 *       409:
 *         description: Email already exists
 */
router.post('/register', validate(registerSchema), asyncHandler(controller.register));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@bankreach.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), asyncHandler(controller.login));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(controller.refresh));

/**
 * @openapi
 * /auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change current user password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmNewPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: OldPassword123
 *               newPassword:
 *                 type: string
 *                 example: NewPassword123
 *               confirmNewPassword:
 *                 type: string
 *                 example: NewPassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password or authentication required
 */
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(controller.changePassword),
);

export default router;
