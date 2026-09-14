import mongoose, { Document, Schema, Types } from 'mongoose';
import { ChatMessageStatus, ChatMessageType, MessageDirection } from '../../common/constants';

export interface IChatMessage extends Document {
  conversationId: Types.ObjectId;
  customerId: Types.ObjectId;
  whatsappMessageId?: string;
  direction: MessageDirection;
  type: ChatMessageType;
  text?: string;
  mediaUrl?: string;
  status: ChatMessageStatus;
  repliedToMessageId?: Types.ObjectId;
  repliedToCampaignMessageId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
    },
    whatsappMessageId: {
      type: String,
      trim: true,
      default: '',
    },
    direction: {
      type: String,
      enum: Object.values(MessageDirection),
      required: [true, 'Message direction is required'],
    },
    type: {
      type: String,
      enum: Object.values(ChatMessageType),
      default: ChatMessageType.TEXT,
    },
    text: {
      type: String,
      trim: true,
      default: '',
    },
    mediaUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ChatMessageStatus),
      default: ChatMessageStatus.PENDING,
    },
    repliedToMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatMessage',
    },
    repliedToCampaignMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
chatMessageSchema.index({ whatsappMessageId: 1 }, { unique: true, sparse: true });
chatMessageSchema.index({ customerId: 1 });
chatMessageSchema.index({ direction: 1, status: 1 });

export const ChatMessageModel = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
