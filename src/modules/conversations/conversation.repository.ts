import { Service } from 'typedi';
import { BaseRepository } from '../../database/base.repository';
import { ConversationModel, IConversation } from './conversation.model';

@Service()
export class ConversationRepository extends BaseRepository<IConversation> {
  constructor() {
    super(ConversationModel);
  }

  async findByCustomerId(customerId: string): Promise<IConversation | null> {
    return this.model.findOne({ customerId }).exec();
  }

  async findByPhoneNumber(phoneNumber: string): Promise<IConversation | null> {
    return this.model.findOne({ phoneNumber }).exec();
  }
}
