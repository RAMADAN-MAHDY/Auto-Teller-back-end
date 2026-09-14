import mongoose, { Document, Schema, Types } from 'mongoose';
import { ConversationStatus } from '../../common/constants';

export interface IConversation extends Document {
  customerId: Types.ObjectId;
  phoneNumber: string;
  whatsappPhoneNumberId: string;
  status: ConversationStatus;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    whatsappPhoneNumberId: {
      type: String,
      required: [true, 'WhatsApp phone number ID is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.OPEN,
    },
    lastMessage: {
      type: String,
      trim: true,
      default: '',
    },
    lastMessageAt: {
      type: Date,
    },
    lastInboundAt: {
      type: Date,
    },
    lastOutboundAt: {
      type: Date,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
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

conversationSchema.index({ status: 1, lastMessageAt: -1 });
conversationSchema.index({ phoneNumber: 1 });
conversationSchema.index({ whatsappPhoneNumberId: 1 });

export const ConversationModel = mongoose.model<IConversation>('Conversation', conversationSchema);
