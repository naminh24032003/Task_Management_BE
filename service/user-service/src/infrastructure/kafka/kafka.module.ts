import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaProducerService } from './kafka-producer.service';
import kafkaConfig from '../config/kafka.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(kafkaConfig),
  ],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
