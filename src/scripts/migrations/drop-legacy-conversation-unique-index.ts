import mongoose from 'mongoose';
import { env } from '../../configs/env.config';

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  try {
    await mongoose.connection.collection('conversations').dropIndex('customerId_1');
    console.log('🗑️ Dropped legacy unique conversation index customerId_1 from conversations collection');
  } catch (error) {
    console.warn('Legacy conversation index drop skipped because the index is already absent or not available.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to drop the legacy conversation unique index:', error);
  process.exit(1);
});
