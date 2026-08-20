import mongoose, { Document, Schema, Types } from 'mongoose';
import { CustomerGroup } from '../../common/constants';

/**
 * Sensitive fields (fullName, phoneNumber, guarantorName, guarantorPhone) are
 * encrypted at rest. Plaintext values are NEVER stored directly on this model.
 *
 * For each sensitive field we may store up to 3 sub-fields:
 * - `<field>Encrypted`: AES-256-GCM ciphertext (random IV) — holds the real value.
 * - `<field>Hash`: deterministic HMAC-SHA256 — used for exact-match lookups /
 *   uniqueness constraints (e.g. phoneNumberHash has the unique index that
 *   phoneNumber used to have).
 * - `<field>Index`: array of HMAC-SHA256 trigrams — used for partial/substring
 *   search (e.g. fullNameIndex replaces the old text index on fullName).
 *
 * Encryption/decryption and hash/index generation happen in the service layer
 * (see customer.service.ts), NOT here — this model only defines storage shape.
 */
export interface ICustomer extends Document {
  fullNameEncrypted: string;
  fullNameIndex: string[];
  phoneNumberEncrypted: string;
  phoneNumberHash: string;
  guarantorNameEncrypted?: string;
  guarantorPhoneEncrypted?: string;
  guarantorPhoneHash?: string;
  dueDate: Date;
  importedOverdueDays?: number;
  overdueDays: number;
  customerGroup: CustomerGroup;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    fullNameEncrypted: {
      type: String,
      required: [true, 'Full name is required'],
    },
    fullNameIndex: {
      type: [String],
      default: [],
    },
    phoneNumberEncrypted: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    phoneNumberHash: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
    },
    guarantorNameEncrypted: {
      type: String,
    },
    guarantorPhoneEncrypted: {
      type: String,
    },
    guarantorPhoneHash: {
      type: String,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    importedOverdueDays: {
      type: Number,
      // Kept for backward compatibility; the backend currently calculates overdueDays from dueDate.
      min: 0,
      default: 0,
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
// Note: phoneNumberHash already has unique: true in schema definition
customerSchema.index({ customerGroup: 1 });
customerSchema.index({ dueDate: 1 });
customerSchema.index({ fullNameIndex: 1 });
customerSchema.index({ tags: 1 });

export const CustomerModel = mongoose.model<ICustomer>('Customer', customerSchema);