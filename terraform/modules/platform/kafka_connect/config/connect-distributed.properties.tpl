# =============================================================================
# Kafka Connect Distributed Configuration
# =============================================================================

# Bootstrap servers
bootstrap.servers=${kafka_bootstrap_servers}

# Group ID for this Connect cluster
group.id=${group_id}

# Storage topics
config.storage.topic=${config_storage_topic}
offset.storage.topic=${offset_storage_topic}
status.storage.topic=${status_storage_topic}

# Replication factor for storage topics (1 for dev/minikube)
config.storage.replication.factor=1
offset.storage.replication.factor=1
status.storage.replication.factor=1

# Internal topics settings
offset.flush.interval.ms=10000

# Key/Value converters
key.converter=org.apache.kafka.connect.json.JsonConverter
value.converter=org.apache.kafka.connect.json.JsonConverter
key.converter.schemas.enable=false
value.converter.schemas.enable=false

# Internal converter (for connect internal topics)
internal.key.converter=org.apache.kafka.connect.json.JsonConverter
internal.value.converter=org.apache.kafka.connect.json.JsonConverter
internal.key.converter.schemas.enable=false
internal.value.converter.schemas.enable=false

# SASL Authentication
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="${kafka_sasl_username}" password="${kafka_sasl_password}";

# Producer SASL
producer.security.protocol=SASL_PLAINTEXT
producer.sasl.mechanism=SCRAM-SHA-256
producer.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="${kafka_sasl_username}" password="${kafka_sasl_password}";

# Consumer SASL
consumer.security.protocol=SASL_PLAINTEXT
consumer.sasl.mechanism=SCRAM-SHA-256
consumer.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="${kafka_sasl_username}" password="${kafka_sasl_password}";

# REST API
rest.port=8083
rest.advertised.host.name=kafka-connect

# Plugin path
plugin.path=/kafka/connect

# Task settings
task.shutdown.graceful.timeout.ms=30000

# Producer settings
producer.acks=all
producer.retries=3
producer.max.in.flight.requests.per.connection=1

# Consumer settings
consumer.auto.offset.reset=earliest
