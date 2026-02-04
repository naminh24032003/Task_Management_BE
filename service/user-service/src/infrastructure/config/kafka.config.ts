import { registerAs } from '@nestjs/config';

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  sasl: {
    mechanism: 'scram-sha-256' | 'scram-sha-512' | 'plain';
    username: string;
    password: string;
  };
  ssl: boolean;
  connectionTimeout: number;
  requestTimeout: number;
  retry: {
    initialRetryTime: number;
    retries: number;
  };
  topics: {
    userEvents: string;
    notificationCommands: string;
    auditLogs: string;
    deadLetterQueue: string;
  };
}

export default registerAs(
  'kafka',
  (): KafkaConfig => ({
    brokers: (process.env.KAFKA_BROKERS || 'kafka.kafka.svc.cluster.local:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'user-service',
    groupId: process.env.KAFKA_GROUP_ID || 'user-service-group',
    sasl: {
      mechanism: (process.env.KAFKA_SASL_MECHANISM as KafkaConfig['sasl']['mechanism']) || 'scram-sha-256',
      username: process.env.KAFKA_USERNAME || 'kafka-user',
      password: process.env.KAFKA_PASSWORD || '',
    },
    ssl: process.env.KAFKA_SSL === 'true',
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000', 10),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
    retry: {
      initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_TIME || '300', 10),
      retries: parseInt(process.env.KAFKA_RETRIES || '10', 10),
    },
    topics: {
      userEvents: process.env.KAFKA_TOPIC_USER_EVENTS || 'user.events',
      notificationCommands: process.env.KAFKA_TOPIC_NOTIFICATION_COMMANDS || 'notification.commands',
      auditLogs: process.env.KAFKA_TOPIC_AUDIT_LOGS || 'audit.logs',
      deadLetterQueue: process.env.KAFKA_TOPIC_DLQ || 'dlq',
    },
  }),
);
