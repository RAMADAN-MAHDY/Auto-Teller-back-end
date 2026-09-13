import mongoose from 'mongoose';
import { env } from '../../configs/env.config';

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  try {
    await mongoose.connection.collection('messages').dropIndex('campaignId_1_customerId_1');
    console.log('🗑️ Dropped deprecated unique index campaignId_1_customerId_1 from messages collection');
  } catch (error) {
    console.warn('Index drop skipped because the legacy index is already absent or not available.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to drop the legacy message index:', error);
  process.exit(1);
});
