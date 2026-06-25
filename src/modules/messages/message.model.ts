import mongoose, { Document, Schema, Types } from 'mongoose';
import { MessageStatus } from '../../common/constants';

export interface IMessage extends Document {
  campaignId: Types.ObjectId;
  customerId: Types.ObjectId;
  whatsappMessageId?: string;
  phoneNumber: string;
  status: MessageStatus;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign ID is required'],
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
    },
    whatsappMessageId: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.PENDING,
    },
    error: {
      type: String,
      trim: true,
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
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

// Indexes
messageSchema.index({ campaignId: 1, customerId: 1 }, { unique: true });
messageSchema.index({ campaignId: 1, status: 1 });
messageSchema.index({ whatsappMessageId: 1 });
messageSchema.index({ phoneNumber: 1 });

export const MessageModel = mongoose.model<IMessage>('Message', messageSchema);
