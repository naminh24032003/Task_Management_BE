# =============================================================================
# Minikube Environment - Default Values
# =============================================================================

environment = "dev"

# Enable all observability components
monitoring_enabled = true
logging_enabled    = true
istio_enabled      = true

# Platform Services
redis_enabled = true
redis_persistence_enabled = false

# Kafka
kafka_enabled = true
kafka_persistence_enabled = false
