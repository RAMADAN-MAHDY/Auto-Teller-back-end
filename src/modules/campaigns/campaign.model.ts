import mongoose, { Document, Schema, Types } from 'mongoose';
import { CampaignStatus, CustomerGroup } from '../../common/constants';

export interface ICampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface ICampaign extends Document {
  title: string;
  templateId: Types.ObjectId;
  targetCustomerGroup: CustomerGroup;
  status: CampaignStatus;
  scheduledAt?: Date;
  createdBy: Types.ObjectId;
  completedAt?: Date;
  stats: ICampaignStats;
  createdAt: Date;
  updatedAt: Date;
}

const campaignStatsSchema = new Schema<ICampaignStats>(
  {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false },
);

const campaignSchema = new Schema<ICampaign>(
  {
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
      required: [true, 'Template is required'],
    },
    targetCustomerGroup: {
      type: String,
      enum: Object.values(CustomerGroup),
      required: [true, 'Target customer group is required'],
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
    },
    scheduledAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedAt: {
      type: Date,
    },
    stats: {
      type: campaignStatsSchema,
      default: () => ({ total: 0, sent: 0, delivered: 0, read: 0, failed: 0 }),
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

// Indexes
campaignSchema.index({ status: 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ scheduledAt: 1, status: 1 });
campaignSchema.index({ targetCustomerGroup: 1 });

export const CampaignModel = mongoose.model<ICampaign>('Campaign', campaignSchema);
