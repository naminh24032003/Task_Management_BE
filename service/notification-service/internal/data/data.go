package data

import (
	"context"
	"fmt"
	"time"

	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	goredis "github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"

	appConsumer "notification-service/internal/app/consumer"
	"notification-service/internal/app/dispatcher"
	"notification-service/internal/domain/template"
	"notification-service/internal/infrastructure/delivery"
	kafkaInfra "notification-service/internal/infrastructure/kafka"
	"notification-service/internal/infrastructure/redis"
	"notification-service/internal/infrastructure/repository"
	"notification-service/internal/ports"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(
	NewData,
	NewMongoClient,
	NewRedisClient,
	NewKafkaProducer,
	NewKafkaConsumer,
	NewNotificationRepository,
	NewIdempotencyStore,
	NewTemplateRenderer,
	NewMultiChannelSender,
	NewDispatcherRegistry,
	NewKafkaConsumerBootstrap,
)

// DataConfig represents the data layer configuration
type DataConfig struct {
	Database DatabaseConfig `json:"database"`
	Redis    RedisConfig    `json:"redis"`
	Kafka    KafkaConfig    `json:"kafka"`
}

type DatabaseConfig struct {
	Source string `json:"source"`
	Name   string `json:"name"`
}

type RedisConfig struct {
	Addr     string `json:"addr"`
	Password string `json:"password"`
	DB       int    `json:"db"`
}

type KafkaConfig struct {
	Brokers       interface{}     `json:"brokers"`
	ConsumerTopic string          `json:"consumer_topic"`
	ProducerTopic string          `json:"producer_topic"`
	ConsumerGroup string          `json:"consumer_group"`
	SASL          KafkaSASLConfig `json:"sasl"`
}

type KafkaSASLConfig struct {
	Enabled   interface{} `json:"enabled"`
	Mechanism string      `json:"mechanism"`
	Username  string      `json:"username"`
	Password  string      `json:"password"`
}

// Data holds all data layer dependencies
type Data struct {
	mongo *mongo.Client
	redis *goredis.Client
	log   *log.Helper
}

// NewData creates a new Data instance
func NewData(mongo *mongo.Client, redis *goredis.Client, logger log.Logger) (*Data, func(), error) {
	cleanup := func() {
		log.NewHelper(logger).Info("closing data resources")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if mongo != nil {
			mongo.Disconnect(ctx)
		}
		if redis != nil {
			redis.Close()
		}
	}
	return &Data{
		mongo: mongo,
		redis: redis,
		log:   log.NewHelper(logger),
	}, cleanup, nil
}

// NewMongoClient creates a new MongoDB client
func NewMongoClient(c config.Config, logger log.Logger) (*mongo.Client, error) {
	helper := log.NewHelper(log.With(logger, "module", "data/mongo"))

	var cfg struct {
		Data DataConfig `json:"data"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, fmt.Errorf("failed to scan config: %w", err)
	}

	helper.Infof("Connecting to MongoDB: %s", cfg.Data.Database.Source)

	clientOpts := options.Client().ApplyURI(cfg.Data.Database.Source)
	clientOpts.Monitor = otelmongo.NewMonitor()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	helper.Info("MongoDB connected successfully")
	return client, nil
}

// NewRedisClient creates a new Redis client
func NewRedisClient(c config.Config, logger log.Logger) (*goredis.Client, error) {
	helper := log.NewHelper(log.With(logger, "module", "data/redis"))

	var cfg struct {
		Data DataConfig `json:"data"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, fmt.Errorf("failed to scan config: %w", err)
	}

	helper.Infof("Connecting to Redis: %s", cfg.Data.Redis.Addr)

	client := goredis.NewClient(&goredis.Options{
		Addr:     cfg.Data.Redis.Addr,
		Password: cfg.Data.Redis.Password,
		DB:       cfg.Data.Redis.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	helper.Info("Redis connected successfully")
	return client, nil
}

// NewKafkaProducer creates a new Kafka producer
func NewKafkaProducer(c config.Config, logger log.Logger) (*kafkaInfra.Producer, func(), error) {
	helper := log.NewHelper(log.With(logger, "module", "data/kafka-producer"))

	var cfg struct {
		Data DataConfig `json:"data"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, nil, fmt.Errorf("failed to scan config: %w", err)
	}

	brokers := toStringSlice(cfg.Data.Kafka.Brokers, []string{"localhost:9092"})
	helper.Infof("Creating Kafka producer for topic: %s", cfg.Data.Kafka.ProducerTopic)

	producerConfig := kafkaInfra.ProducerConfig{
		Brokers: brokers,
		Topic:   cfg.Data.Kafka.ProducerTopic,
	}

	if toBool(cfg.Data.Kafka.SASL.Enabled, false) {
		producerConfig.SASL = &kafkaInfra.SASLConfig{
			Enabled:   true,
			Mechanism: cfg.Data.Kafka.SASL.Mechanism,
			Username:  cfg.Data.Kafka.SASL.Username,
			Password:  cfg.Data.Kafka.SASL.Password,
		}
	}

	producer, err := kafkaInfra.NewProducer(producerConfig)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	cleanup := func() {
		helper.Info("closing Kafka producer")
		producer.Close()
	}

	helper.Info("Kafka producer created successfully")
	return producer, cleanup, nil
}

// NewKafkaConsumer creates a new Kafka consumer
func NewKafkaConsumer(c config.Config, logger log.Logger) (*kafkaInfra.Consumer, error) {
	helper := log.NewHelper(log.With(logger, "module", "data/kafka-consumer"))

	var cfg struct {
		Data DataConfig `json:"data"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, fmt.Errorf("failed to scan config: %w", err)
	}

	brokers := toStringSlice(cfg.Data.Kafka.Brokers, []string{"localhost:9092"})
	helper.Infof("Creating Kafka consumer for topic: %s, group: %s",
		cfg.Data.Kafka.ConsumerTopic, cfg.Data.Kafka.ConsumerGroup)

	consumerConfig := kafkaInfra.ConsumerConfig{
		Brokers: brokers,
		Topic:   cfg.Data.Kafka.ConsumerTopic,
		GroupID: cfg.Data.Kafka.ConsumerGroup,
	}

	if toBool(cfg.Data.Kafka.SASL.Enabled, false) {
		consumerConfig.SASL = &kafkaInfra.SASLConfig{
			Enabled:   true,
			Mechanism: cfg.Data.Kafka.SASL.Mechanism,
			Username:  cfg.Data.Kafka.SASL.Username,
			Password:  cfg.Data.Kafka.SASL.Password,
		}
	}

	consumer, err := kafkaInfra.NewConsumer(consumerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	helper.Info("Kafka consumer created successfully")
	return consumer, nil
}

// NewNotificationRepository creates a new notification repository
func NewNotificationRepository(client *mongo.Client, c config.Config, logger log.Logger) ports.NotificationRepository {
	var cfg struct {
		Data DataConfig `json:"data"`
	}
	c.Scan(&cfg)

	repo := repository.NewMongoNotificationRepository(client, cfg.Data.Database.Name)

	// Create indexes in background
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := repo.CreateIndexes(ctx); err != nil {
			log.NewHelper(logger).Warnf("Failed to create indexes: %v", err)
		}
	}()

	return repo
}

// NewIdempotencyStore creates a new idempotency store
func NewIdempotencyStore(client *goredis.Client) ports.IdempotencyStore {
	return redis.NewIdempotencyStore(client)
}

// NewTemplateRenderer creates a new template renderer
func NewTemplateRenderer() *template.Renderer {
	return template.NewRenderer()
}

// NewMultiChannelSender creates a new multi-channel sender
func NewMultiChannelSender(producer *kafkaInfra.Producer, renderer *template.Renderer) *delivery.MultiChannelSenderImpl {
	multiSender := delivery.NewMultiChannelSender()

	// Register InApp sender (publishes to notification.events topic)
	inAppSender := delivery.NewInAppSender(producer)
	multiSender.RegisterSender(inAppSender)

	// Email and Push senders can be enabled via config
	// For now, they are disabled by default

	return multiSender
}

// NewDispatcherRegistry creates a new dispatcher registry
func NewDispatcherRegistry(
	repo ports.NotificationRepository,
	multiSender *delivery.MultiChannelSenderImpl,
	idempotency ports.IdempotencyStore,
) *dispatcher.Dispatcher {
	registry := dispatcher.NewRegistry(repo, multiSender, idempotency)
	return registry.RegisterAllHandlers()
}

// NewKafkaConsumerBootstrap creates a new Kafka consumer bootstrap
func NewKafkaConsumerBootstrap(
	kafkaConsumer *kafkaInfra.Consumer,
	disp *dispatcher.Dispatcher,
) *appConsumer.KafkaConsumerBootstrap {
	return appConsumer.NewKafkaConsumerBootstrap(kafkaConsumer, disp)
}

// Helper functions
func toStringSlice(v interface{}, defaultVal []string) []string {
	switch val := v.(type) {
	case []string:
		return val
	case []interface{}:
		result := make([]string, 0, len(val))
		for _, item := range val {
			if str, ok := item.(string); ok {
				result = append(result, str)
			}
		}
		if len(result) > 0 {
			return result
		}
	case string:
		return []string{val}
	}
	return defaultVal
}

func toBool(v interface{}, defaultVal bool) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true" || val == "1" || val == "yes"
	}
	return defaultVal
}
