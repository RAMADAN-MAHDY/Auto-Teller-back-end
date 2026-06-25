import { Types } from 'mongoose';

/** MongoDB ObjectId as string */
export type ObjectIdString = string;

/** Helper to convert string to ObjectId */
export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

/** Timestamp fields automatically added by Mongoose */
export interface TimestampFields {
  createdAt: Date;
  updatedAt: Date;
}
