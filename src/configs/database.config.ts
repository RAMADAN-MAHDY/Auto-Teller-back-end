import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from '../logger';

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.info('📦 MongoDB connected successfully');
    });

    mongoose.connection.on('error', (error) => {
      logger.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Drop deprecated index if still present in the MongoDB collection
    try {
      await mongoose.connection.collection('messages').dropIndex('campaignId_1_customerId_1');
      logger.info('🗑️ Dropped deprecated unique index campaignId_1_customerId_1 from messages collection');
    } catch {
      // Index already dropped or doesn't exist
    }
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('📦 MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('❌ Error disconnecting from MongoDB:', error);
  }
}
