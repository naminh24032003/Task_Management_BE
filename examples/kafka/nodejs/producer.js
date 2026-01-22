const { Kafka, CompressionTypes } = require('kafkajs');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'user-service-producer',
  brokers: [process.env.KAFKA_BROKERS || 'kafka.kafka.svc.cluster.local:9092'],
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME || 'kafka-user',
    password: process.env.KAFKA_PASSWORD
  },
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const producer = kafka.producer({
  compression: CompressionTypes.LZ4,
  idempotent: true,
  maxInFlightRequests: 5,
  transactionalId: 'user-service-transactional-producer'
});

// User event types
const UserEventType = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
  LOGIN: 'user.login',
  LOGOUT: 'user.logout'
};

/**
 * Publish user event to Kafka
 */
async function publishUserEvent(eventType, userData) {
  const event = {
    event_type: eventType,
    user_id: userData.userId,
    email: userData.email,
    name: userData.name,
    timestamp: new Date().toISOString(),
    metadata: userData.metadata || {}
  };

  try {
    const result = await producer.send({
      topic: process.env.KAFKA_TOPIC_USERS || 'users',
      messages: [
        {
          key: userData.userId, // Partition by user ID
          value: JSON.stringify(event),
          headers: {
            'event_type': eventType,
            'service': 'user-service',
            'version': '1.0'
          }
        }
      ]
    });

    console.log(`✅ Published ${eventType}:`, {
      userId: userData.userId,
      partition: result[0].partition,
      offset: result[0].offset
    });

    return result;
  } catch (error) {
    console.error(`❌ Failed to publish ${eventType}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Connect producer
    await producer.connect();
    console.log('✅ Producer connected to Kafka');

    // Example 1: User Registration
    await publishUserEvent(UserEventType.CREATED, {
      userId: 'user-789',
      email: 'newuser@example.com',
      name: 'John Doe',
      metadata: {
        source: 'web',
        ip: '192.168.1.100'
      }
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 2: User Login
    await publishUserEvent(UserEventType.LOGIN, {
      userId: 'user-789',
      email: 'newuser@example.com',
      name: 'John Doe',
      metadata: {
        device: 'web-browser',
        ip: '192.168.1.100',
        location: 'Vietnam'
      }
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 3: User Profile Update
    await publishUserEvent(UserEventType.UPDATED, {
      userId: 'user-789',
      email: 'newuser@example.com',
      name: 'John Doe Updated',
      metadata: {
        fields_updated: ['name', 'avatar'],
        updated_by: 'user-789'
      }
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example 4: User Logout
    await publishUserEvent(UserEventType.LOGOUT, {
      userId: 'user-789',
      email: 'newuser@example.com',
      name: 'John Doe Updated',
      metadata: {
        session_duration: 3600,
        device: 'web-browser'
      }
    });

    console.log('🎉 All events published successfully!');

  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  } finally {
    // Disconnect
    await producer.disconnect();
    console.log('👋 Producer disconnected');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down...');
  await producer.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, shutting down...');
  await producer.disconnect();
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
module.exports = {
  producer,
  publishUserEvent,
  UserEventType
};
