import { Router } from 'express';
import Container from 'typedi';
import { ConversationController } from './conversation.controller';
import { authenticate, validate } from '../../middlewares';
import { conversationQuerySchema, postConversationMessageSchema } from './conversation.dto';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(ConversationController);

router.use(authenticate);

router.get('/', validate(conversationQuerySchema, 'query'), asyncHandler(controller.list));
router.get('/:id/timeline', asyncHandler(controller.timeline));
router.get('/:id', asyncHandler(controller.findById));
router.get('/:id/messages', asyncHandler(controller.findMessages));
router.post('/:id/messages', validate(postConversationMessageSchema, 'body'), asyncHandler(controller.reply));
router.patch('/:id/read', asyncHandler(controller.markRead));
router.patch('/:id/close', asyncHandler(controller.close));

export default router;
