package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/IBM/sarama"
)

// TaskEvent represents a task-related event
type TaskEvent struct {
	EventType string    `json:"event_type"`
	TaskID    string    `json:"task_id"`
	Title     string    `json:"title"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

func main() {
	// Kafka configuration
	config := sarama.NewConfig()
	config.Version = sarama.V3_6_0_0
	config.Producer.Return.Successes = true
	config.Producer.RequiredAcks = sarama.WaitForAll
	config.Producer.Retry.Max = 5
	config.Producer.Compression = sarama.CompressionLZ4

	// SASL Authentication
	config.Net.SASL.Enable = true
	config.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
	config.Net.SASL.User = getEnv("KAFKA_USERNAME", "kafka-user")
	config.Net.SASL.Password = getEnv("KAFKA_PASSWORD", "kafka-secret-password")

	// Kafka brokers
	brokers := []string{getEnv("KAFKA_BROKERS", "kafka.kafka.svc.cluster.local:9092")}
	topic := getEnv("KAFKA_TOPIC_TASKS", "tasks")

	// Create producer
	producer, err := sarama.NewSyncProducer(brokers, config)
	if err != nil {
		log.Fatalf("Failed to create producer: %v", err)
	}
	defer producer.Close()

	log.Printf("✅ Connected to Kafka brokers: %v", brokers)
	log.Printf("📤 Publishing to topic: %s", topic)

	// Example 1: Task Created Event
	taskCreated := TaskEvent{
		EventType: "task.created",
		TaskID:    "task-123",
		Title:     "Implement user authentication",
		UserID:    "user-456",
		Status:    "pending",
		Timestamp: time.Now(),
	}

	if err := publishEvent(producer, topic, taskCreated); err != nil {
		log.Printf("❌ Failed to publish task.created: %v", err)
	}

	// Example 2: Task Updated Event
	time.Sleep(1 * time.Second)
	taskUpdated := TaskEvent{
		EventType: "task.updated",
		TaskID:    "task-123",
		Title:     "Implement user authentication",
		UserID:    "user-456",
		Status:    "in_progress",
		Timestamp: time.Now(),
	}

	if err := publishEvent(producer, topic, taskUpdated); err != nil {
		log.Printf("❌ Failed to publish task.updated: %v", err)
	}

	// Example 3: Task Completed Event
	time.Sleep(1 * time.Second)
	taskCompleted := TaskEvent{
		EventType: "task.completed",
		TaskID:    "task-123",
		Title:     "Implement user authentication",
		UserID:    "user-456",
		Status:    "completed",
		Timestamp: time.Now(),
	}

	if err := publishEvent(producer, topic, taskCompleted); err != nil {
		log.Printf("❌ Failed to publish task.completed: %v", err)
	}

	log.Println("🎉 All events published successfully!")
}

// publishEvent publishes an event to Kafka
func publishEvent(producer sarama.SyncProducer, topic string, event TaskEvent) error {
	// Serialize event to JSON
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Create Kafka message
	msg := &sarama.ProducerMessage{
		Topic: topic,
		Key:   sarama.StringEncoder(event.TaskID), // Use TaskID as partition key
		Value: sarama.ByteEncoder(payload),
		Headers: []sarama.RecordHeader{
			{
				Key:   []byte("event_type"),
				Value: []byte(event.EventType),
			},
		},
	}

	// Send message
	partition, offset, err := producer.SendMessage(msg)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	log.Printf("✅ Published %s to partition %d at offset %d", event.EventType, partition, offset)
	return nil
}

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
