import mongoose, { Document, Schema, Types } from 'mongoose';
import { CustomerGroup } from '../../common/constants';

export interface ICustomer extends Document {
  fullName: string;
  phoneNumber: string;
  guarantorName?: string;
  guarantorPhone?: string;
  dueDate: Date;
  importedOverdueDays: number;
  overdueDays: number;
  customerGroup: CustomerGroup;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [150, 'Name must be at most 150 characters'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^\+?\d{10,15}$/, 'Please enter a valid phone number'],
    },
    guarantorName: {
      type: String,
      trim: true,
      maxlength: [150, 'Guarantor name must be at most 150 characters'],
    },
    guarantorPhone: {
      type: String,
      trim: true,
      match: [/^\+?\d{10,15}$/, 'Please enter a valid guarantor phone number'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    importedOverdueDays: {
      type: Number,
      required: [true, 'Imported overdue days is required'],
      min: 0,
    },
    overdueDays: {
      type: Number,
      required: [true, 'Overdue days is required'],
      min: 0,
    },
    customerGroup: {
      type: String,
      enum: Object.values(CustomerGroup),
      required: [true, 'Customer group is required'],
    },
    // notes: {
    //   type: String,
    //   trim: true,
    //   maxlength: [1000, 'Notes must be at most 1000 characters'],
    // },
    // tags: {
    //   type: [String],
    //   default: [],
    // },
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
// Note: phoneNumber already has unique: true in schema definition
customerSchema.index({ customerGroup: 1 });
customerSchema.index({ dueDate: 1 });
customerSchema.index({ fullName: 'text' });
customerSchema.index({ tags: 1 });

export const CustomerModel = mongoose.model<ICustomer>('Customer', customerSchema);
