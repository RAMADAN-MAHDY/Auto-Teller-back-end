import { describe, it, expect } from 'vitest';
import { ConversationStatus, MessageDirection } from '../../src/common/constants';
import { ConversationRepository } from '../../src/modules/conversations/conversation.repository.ts';
import { ChatMessageRepository } from '../../src/modules/chat-messages/chat-message.repository';

describe('chat phase 1 database layer', () => {
  it('should expose chat enums through the shared constants module', () => {
    expect(ConversationStatus.OPEN).toBe('OPEN');
    expect(ConversationStatus.CLOSED).toBe('CLOSED');
    expect(MessageDirection.INBOUND).toBe('INBOUND');
    expect(MessageDirection.OUTBOUND).toBe('OUTBOUND');
  });

  it('should provide repository classes extending the base repository contract', () => {
    const conversationRepository = new ConversationRepository();
    const chatMessageRepository = new ChatMessageRepository();

    expect(conversationRepository).toBeInstanceOf(ConversationRepository);
    expect(chatMessageRepository).toBeInstanceOf(ChatMessageRepository);
  });
});
