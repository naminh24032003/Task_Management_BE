const { Kafka } = require('kafkajs');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'user-service-consumer',
  brokers: [process.env.KAFKA_BROKERS || 'kafka.kafka.svc.cluster.local:9092'],
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME || 'kafka-user',
    password: process.env.KAFKA_PASSWORD || 'kafka-secret-password'
  },
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_CONSUMER_GROUP || 'user-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

/**
 * Event handlers
 */
const eventHandlers = {
  'user.created': async (event) => {
    console.log(`✨ User Created: ${event.user_id} - ${event.email}`);
    // Business logic:
    // - Send welcome email
    // - Create default user settings
    // - Track registration analytics
  },

  'user.updated': async (event) => {
    console.log(`🔄 User Updated: ${event.user_id}`);
    // Business logic:
    // - Invalidate cache
    // - Update search index
    // - Sync with CRM
  },

  'user.deleted': async (event) => {
    console.log(`🗑️  User Deleted: ${event.user_id}`);
    // Business logic:
    // - Clean up user data
    // - Cancel subscriptions
    // - Archive data for compliance
  },

  'user.login': async (event) => {
    console.log(`🔐 User Login: ${event.user_id} from ${event.metadata?.ip}`);
    // Business logic:
    // - Track login analytics
    // - Check for suspicious activity
    // - Update last login timestamp
  },

  'user.logout': async (event) => {
    console.log(`👋 User Logout: ${event.user_id}`);
    // Business logic:
    // - Invalidate session
    // - Track session duration
    // - Clean up temporary data
  }
};

/**
 * Process message
 */
async function processMessage(message, partition, offset) {
  try {
    // Parse message
    const event = JSON.parse(message.value.toString());
    const eventType = event.event_type;

    // Log message details
    console.log(`📨 Received: ${eventType} | User: ${event.user_id} | Partition: ${partition} | Offset: ${offset}`);

    // Find and execute handler
    const handler = eventHandlers[eventType];
    if (handler) {
      await handler(event);
    } else {
      console.warn(`⚠️  No handler for event type: ${eventType}`);
    }

  } catch (error) {
    console.error(`❌ Error processing message at offset ${offset}:`, error);
    // In production, you might want to:
    // - Send to dead letter queue
    // - Log to error tracking service
    // - Implement retry logic
    throw error; // This will pause the consumer
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Connect consumer
    await consumer.connect();
    console.log('✅ Consumer connected to Kafka');

    const topic = process.env.KAFKA_TOPIC_USERS || 'users';

    // Subscribe to topic
    await consumer.subscribe({
      topic,
      fromBeginning: false // Set to true to consume from the beginning
    });
    console.log(`📥 Subscribed to topic: ${topic}`);
    console.log(`👥 Consumer group: ${process.env.KAFKA_CONSUMER_GROUP || 'user-service-group'}`);

    // Start consuming messages
    await consumer.run({
      // Process each message
      eachMessage: async ({ topic, partition, message }) => {
        await processMessage(message, partition, message.offset);
      },

      // Process messages in batches (more efficient)
      // eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
      //   for (const message of batch.messages) {
      //     await processMessage(message, batch.partition, message.offset);
      //     resolveOffset(message.offset);
      //     await heartbeat();
      //   }
      // }
    });

    console.log('🎧 Consumer ready, listening for messages...');

  } catch (error) {
    console.error('❌ Error in consumer:', error);
    process.exit(1);
  }
}

/**
 * Error handling
 */
consumer.on('consumer.crash', async (event) => {
  console.error('💥 Consumer crashed:', event.payload.error);
  // Implement recovery logic or restart
});

consumer.on('consumer.disconnect', () => {
  console.warn('⚠️  Consumer disconnected');
});

consumer.on('consumer.network.request_timeout', (event) => {
  console.warn('⏱️  Request timeout:', event.payload);
});

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n⚠️  Shutting down consumer...');
  try {
    await consumer.disconnect();
    console.log('👋 Consumer disconnected gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
module.exports = {
  consumer,
  processMessage
};
