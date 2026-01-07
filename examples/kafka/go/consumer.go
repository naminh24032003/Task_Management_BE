package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/IBM/sarama"
)

// TaskEvent represents a task-related event
type TaskEvent struct {
	EventType string `json:"event_type"`
	TaskID    string `json:"task_id"`
	Title     string `json:"title"`
	UserID    string `json:"user_id"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

// Consumer represents a Sarama consumer group consumer
type Consumer struct {
	ready chan bool
}

func main() {
	// Kafka configuration
	config := sarama.NewConfig()
	config.Version = sarama.V3_6_0_0
	config.Consumer.Return.Errors = true
	config.Consumer.Offsets.Initial = sarama.OffsetOldest
	config.Consumer.Group.Rebalance.Strategy = sarama.NewBalanceStrategyRoundRobin()

	// SASL Authentication
	config.Net.SASL.Enable = true
	config.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
	config.Net.SASL.User = getEnv("KAFKA_USERNAME", "kafka-user")
	config.Net.SASL.Password = getEnv("KAFKA_PASSWORD", "kafka-secret-password")

	// Kafka configuration
	brokers := []string{getEnv("KAFKA_BROKERS", "kafka.kafka.svc.cluster.local:9092")}
	topic := getEnv("KAFKA_TOPIC_TASKS", "tasks")
	group := getEnv("KAFKA_CONSUMER_GROUP", "task-service-group")

	log.Printf("✅ Starting consumer...")
	log.Printf("📥 Brokers: %v", brokers)
	log.Printf("📥 Topic: %s", topic)
	log.Printf("👥 Group: %s", group)

	// Create consumer group
	consumer := Consumer{
		ready: make(chan bool),
	}

	ctx, cancel := context.WithCancel(context.Background())
	client, err := sarama.NewConsumerGroup(brokers, group, config)
	if err != nil {
		log.Fatalf("Error creating consumer group: %v", err)
	}
	defer client.Close()

	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			// `Consume` should be called inside an infinite loop
			if err := client.Consume(ctx, []string{topic}, &consumer); err != nil {
				log.Printf("Error from consumer: %v", err)
			}
			// check if context was cancelled, signaling that the consumer should stop
			if ctx.Err() != nil {
				return
			}
			consumer.ready = make(chan bool)
		}
	}()

	<-consumer.ready // Await till the consumer has been set up
	log.Println("🎧 Consumer ready, listening for messages...")

	// Handle graceful shutdown
	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-ctx.Done():
		log.Println("Terminating: context cancelled")
	case <-sigterm:
		log.Println("Terminating: signal received")
	}

	cancel()
	wg.Wait()
	log.Println("👋 Consumer stopped")
}

// Setup is run at the beginning of a new session, before ConsumeClaim
func (consumer *Consumer) Setup(sarama.ConsumerGroupSession) error {
	close(consumer.ready)
	return nil
}

// Cleanup is run at the end of a session, once all ConsumeClaim goroutines have exited
func (consumer *Consumer) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

// ConsumeClaim must start a consumer loop of ConsumerGroupClaim's Messages()
func (consumer *Consumer) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for {
		select {
		case message := <-claim.Messages():
			if message == nil {
				return nil
			}

			// Process message
			var event TaskEvent
			if err := json.Unmarshal(message.Value, &event); err != nil {
				log.Printf("❌ Error unmarshaling message: %v", err)
				continue
			}

			// Handle different event types
			switch event.EventType {
			case "task.created":
				handleTaskCreated(event)
			case "task.updated":
				handleTaskUpdated(event)
			case "task.completed":
				handleTaskCompleted(event)
			case "task.deleted":
				handleTaskDeleted(event)
			default:
				log.Printf("⚠️  Unknown event type: %s", event.EventType)
			}

			// Log message details
			log.Printf("📨 Received: %s | Task: %s | Partition: %d | Offset: %d",
				event.EventType, event.TaskID, message.Partition, message.Offset)

			// Mark message as processed
			session.MarkMessage(message, "")

		case <-session.Context().Done():
			return nil
		}
	}
}

// Event handlers
func handleTaskCreated(event TaskEvent) {
	log.Printf("✨ Task Created: %s - %s (User: %s)", event.TaskID, event.Title, event.UserID)
	// Add your business logic here:
	// - Send notification to assigned user
	// - Update dashboard
	// - Track analytics
}

func handleTaskUpdated(event TaskEvent) {
	log.Printf("🔄 Task Updated: %s - Status: %s", event.TaskID, event.Status)
	// Add your business logic here:
	// - Send status update notification
	// - Update timeline
	// - Sync with external systems
}

func handleTaskCompleted(event TaskEvent) {
	log.Printf("✅ Task Completed: %s - %s", event.TaskID, event.Title)
	// Add your business logic here:
	// - Send completion notification
	// - Update user statistics
	// - Archive task data
}

func handleTaskDeleted(event TaskEvent) {
	log.Printf("🗑️  Task Deleted: %s", event.TaskID)
	// Add your business logic here:
	// - Clean up related data
	// - Send notification
	// - Update audit log
}

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
