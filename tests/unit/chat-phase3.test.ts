import { describe, it, expect } from 'vitest';
import { ConversationService } from '../../src/modules/conversations/conversation.service';

describe('chat phase 3 conversation outbound window', () => {
  it('should allow sending outbound replies when the last inbound is still inside the 24 hour window', () => {
    const service = new ConversationService();
    const allowed = service.isWithin24HourWindow(new Date(Date.now() - 1000 * 60 * 60 * 23));
    expect(allowed).toBe(true);
  });

  it('should reject sending outbound replies when the last inbound is outside the 24 hour window', () => {
    const service = new ConversationService();
    const allowed = service.isWithin24HourWindow(new Date(Date.now() - 1000 * 60 * 60 * 24 * 2));
    expect(allowed).toBe(false);
  });
});
