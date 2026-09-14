import { Router } from 'express';
import Container from 'typedi';
import { ConversationController } from './conversation.controller';
import { authenticate, validate } from '../../middlewares';
import { conversationQuerySchema, postConversationMessageSchema } from './conversation.dto';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(ConversationController);

router.use(authenticate);

router.get('/', validate(conversationQuerySchema, 'query'), asyncHandler(controller.list.bind(controller)));
router.get('/:id/timeline', asyncHandler(controller.timeline.bind(controller)));
router.get('/:id', asyncHandler(controller.findById.bind(controller)));
router.get('/:id/messages', asyncHandler(controller.findMessages.bind(controller)));
router.post('/:id/messages', validate(postConversationMessageSchema, 'body'), asyncHandler(controller.reply.bind(controller)));
router.patch('/:id/read', asyncHandler(controller.markRead.bind(controller)));
router.patch('/:id/close', asyncHandler(controller.close.bind(controller)));

export default router;
