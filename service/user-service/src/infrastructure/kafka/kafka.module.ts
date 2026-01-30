import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';
import { EVENT_PUBLISHER } from '../../application/ports/event-publisher.port';
import kafkaConfig from '../config/kafka.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(kafkaConfig),
  ],
  providers: [
    KafkaProducerService,
    {
      provide: EVENT_PUBLISHER,
      useExisting: KafkaProducerService,
    },
  ],
  exports: [
    KafkaProducerService,
    EVENT_PUBLISHER,
  ],
})
export class KafkaModule {}
