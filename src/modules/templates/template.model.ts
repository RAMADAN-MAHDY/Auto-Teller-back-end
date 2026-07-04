import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITemplate extends Document {
  name: string;
  body: string;
  variables: string[];
  isMeta?: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be at most 100 characters'],
    },
    body: {
      type: String,
      required: [true, 'Template body is required'],
      trim: true,
      maxlength: [4096, 'Body must be at most 4096 characters'],
    },
    variables: {
      type: [String],
      default: [],
    },
    isMeta: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
templateSchema.index({ name: 1 });
templateSchema.index({ isMeta: 1 });
templateSchema.index({ createdBy: 1 });

export const TemplateModel = mongoose.model<ITemplate>('Template', templateSchema);
