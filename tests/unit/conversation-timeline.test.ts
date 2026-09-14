import { describe, it, expect } from 'vitest';
import { ConversationService } from '../../src/modules/conversations/conversation.service';

describe('ConversationService timeline merge', () => {
  it('should merge campaign and chat events chronologically and tag the source', () => {
    const service = new ConversationService();

    const merged = service.mergeTimelineEntries(
      [
        { createdAt: new Date('2026-09-14T09:00:00.000Z'), text: 'campaign message', source: 'campaign' },
      ],
      [
        { createdAt: new Date('2026-09-14T10:00:00.000Z'), text: 'chat reply', source: 'chat' },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('campaign');
    expect(merged[1].source).toBe('chat');
  });
});
