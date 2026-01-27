package data

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"task-service/internal/adapter/messaging/kafka"
	"task-service/internal/adapter/persistence/mongodb"
	mongoRepo "task-service/internal/adapter/persistence/mongodb"
	redisAdapter "task-service/internal/adapter/persistence/redis"
	"task-service/internal/application/handler"
	"task-service/internal/domain/repository"
	domainService "task-service/internal/domain/service"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(
	NewData,
	NewMongoDatabase,
	NewRedisClient,
	NewKafkaProducer,
	NewTaskRepository,
	NewTaskEventPublisher,
	NewTaskDomainService,
	NewCommandHandler,
	NewQueryHandler,
)

// Data holds all database connections
type Data struct {
	db     *mongo.Database
	redis  *redis.Client
	logger *log.Helper
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Driver                 string      `json:"driver"`
	Source                 string      `json:"source"`
	Name                   string      `json:"name"`
	MinPoolSize            interface{} `json:"min_pool_size"`
	MaxPoolSize            interface{} `json:"max_pool_size"`
	ConnectTimeout         interface{} `json:"connect_timeout"`
	ServerSelectionTimeout interface{} `json:"server_selection_timeout"`
	SocketTimeout          interface{} `json:"socket_timeout"`
	ReadPreference         string      `json:"read_preference"`
	ReadConcern            string      `json:"read_concern"`
	WriteConcern           string      `json:"write_concern"`
}

// RedisConfig represents Redis configuration
type RedisConfig struct {
	Addr           string      `json:"addr"`
	Password       string      `json:"password"`
	DB             interface{} `json:"db"`
	KeyPrefix      string      `json:"key_prefix"`
	ReadTimeout    string      `json:"read_timeout"`
	WriteTimeout   string      `json:"write_timeout"`
	ConnectTimeout string      `json:"connect_timeout"`
	MaxRetries     interface{} `json:"max_retries"`
}

// KafkaConfig represents Kafka configuration
type KafkaConfig struct {
	Brokers    interface{}     `json:"brokers"`
	TopicTasks string          `json:"topic_tasks"`
	SASL       KafkaSASLConfig `json:"sasl"`
}

// KafkaSASLConfig represents Kafka SASL authentication configuration
type KafkaSASLConfig struct {
	Enabled   interface{} `json:"enabled"`
	Mechanism string      `json:"mechanism"`
	Username  string      `json:"username"`
	Password  string      `json:"password"`
}

// DataConfig represents data configuration
type DataConfig struct {
	Database DatabaseConfig `json:"database"`
	Redis    RedisConfig    `json:"redis"`
	Kafka    KafkaConfig    `json:"kafka"`
}

// NewData creates a new Data instance
func NewData(db *mongo.Database, redisClient *redis.Client, logger log.Logger) (*Data, func(), error) {
	helper := log.NewHelper(log.With(logger, "module", "data"))

	d := &Data{
		db:     db,
		redis:  redisClient,
		logger: helper,
	}

	cleanup := func() {
		helper.Info("closing data resources")
	}

	return d, cleanup, nil
}

// NewMongoDatabase creates a new MongoDB database connection
func NewMongoDatabase(c config.Config, logger log.Logger) (*mongo.Database, func(), error) {
	helper := log.NewHelper(log.With(logger, "module", "data/mongodb"))

	var cfg struct {
		Data DataConfig `json:"data"`
	}

	if err := c.Scan(&cfg); err != nil {
		helper.Errorf("failed to scan config: %v", err)
		return nil, nil, err
	}

	mongoConfig := &mongodb.Config{
		URI:                    cfg.Data.Database.Source,
		Database:               cfg.Data.Database.Name,
		MinPoolSize:            toUint64(cfg.Data.Database.MinPoolSize, 10),
		MaxPoolSize:            toUint64(cfg.Data.Database.MaxPoolSize, 100),
		ConnectTimeout:         toDuration(cfg.Data.Database.ConnectTimeout, 10),
		ServerSelectionTimeout: toDuration(cfg.Data.Database.ServerSelectionTimeout, 30),
		SocketTimeout:          toDuration(cfg.Data.Database.SocketTimeout, 45),
		ReadPreference:         cfg.Data.Database.ReadPreference,
		ReadConcern:            cfg.Data.Database.ReadConcern,
		WriteConcern:           cfg.Data.Database.WriteConcern,
	}

	db, cleanup, err := mongodb.NewDatabase(mongoConfig)
	if err != nil {
		return nil, nil, err
	}

	return db, cleanup, nil
}

// NewRedisClient ... (same as before)
func NewRedisClient(c config.Config, logger log.Logger) (*redis.Client, func(), error) {
	var cfg struct {
		Data DataConfig `json:"data"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, nil, err
	}
	readTimeout, _ := time.ParseDuration(cfg.Data.Redis.ReadTimeout)
	writeTimeout, _ := time.ParseDuration(cfg.Data.Redis.WriteTimeout)
	connectTimeout, _ := time.ParseDuration(cfg.Data.Redis.ConnectTimeout)
	redisConfig := &redisAdapter.Config{
		Addr:           cfg.Data.Redis.Addr,
		Password:       cfg.Data.Redis.Password,
		DB:             toInt(cfg.Data.Redis.DB, 0),
		KeyPrefix:      cfg.Data.Redis.KeyPrefix,
		ReadTimeout:    readTimeout,
		WriteTimeout:   writeTimeout,
		ConnectTimeout: connectTimeout,
		MaxRetries:     toInt(cfg.Data.Redis.MaxRetries, 3),
	}
	client, cleanup, err := redisAdapter.NewClient(redisConfig)
	if err != nil {
		return nil, nil, err
	}
	return client, cleanup, nil
}

func NewKafkaProducer(c config.Config, logger log.Logger) (*kafka.Producer, func(), error) {
	helper := log.NewHelper(log.With(logger, "module", "data/kafka"))

	var cfg struct {
		Data DataConfig `json:"data"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, nil, err
	}

	kafkaCfg := cfg.Data.Kafka
	producerConfig := kafka.ProducerConfig{
		Brokers: toStringSlice(kafkaCfg.Brokers, []string{"localhost:9092"}),
		Topic:   kafkaCfg.TopicTasks,
	}

	// Configure SASL if enabled
	if toBool(kafkaCfg.SASL.Enabled, true) {
		producerConfig.SASL = &kafka.SASLConfig{
			Enabled:   true,
			Mechanism: kafkaCfg.SASL.Mechanism,
			Username:  kafkaCfg.SASL.Username,
			Password:  kafkaCfg.SASL.Password,
		}
	}

	helper.Infof("Connecting to Kafka brokers: %v, topic: %s, SASL: %v",
		kafkaCfg.Brokers, kafkaCfg.TopicTasks, kafkaCfg.SASL.Enabled)

	producer, err := kafka.NewProducer(producerConfig)
	if err != nil {
		return nil, nil, err
	}
	return producer, func() { producer.Close() }, nil
}

func NewTaskRepository(db *mongo.Database) repository.TaskRepository {
	return mongoRepo.NewTaskRepository(db)
}

func NewTaskEventPublisher(producer *kafka.Producer) handler.EventPublisher {
	return kafka.NewTaskEventPublisher(producer)
}

func NewTaskDomainService(repo repository.TaskRepository) *domainService.TaskDomainService {
	return domainService.NewTaskDomainService(repo)
}

func NewCommandHandler(repo repository.TaskRepository, ds *domainService.TaskDomainService, ep handler.EventPublisher) *handler.CommandHandler {
	return handler.NewCommandHandler(repo, ds, ep)
}

func NewQueryHandler(repo repository.TaskRepository) *handler.QueryHandler {
	return handler.NewQueryHandler(repo)
}
func toDuration(v interface{}, defaultSeconds int) time.Duration {
	if v == nil {
		return time.Duration(defaultSeconds) * time.Second
	}
	switch val := v.(type) {
	case int:
		return time.Duration(val) * time.Second
	case int32:
		return time.Duration(val) * time.Second
	case int64:
		return time.Duration(val) * time.Second
	case float64:
		return time.Duration(val) * time.Second
	case string:
		d, err := time.ParseDuration(val)
		if err == nil {
			return d
		}
		// Try parsing as int
		var intVal int
		if _, err := fmt.Sscanf(val, "%d", &intVal); err == nil {
			return time.Duration(intVal) * time.Second
		}
	}
	return time.Duration(defaultSeconds) * time.Second
}
func toUint64(v interface{}, defaultVal uint64) uint64 {
	if v == nil {
		return defaultVal
	}
	switch val := v.(type) {
	case int:
		return uint64(val)
	case int32:
		return uint64(val)
	case int64:
		return uint64(val)
	case float64:
		return uint64(val)
	case string:
		var res uint64
		if _, err := fmt.Sscanf(val, "%d", &res); err == nil {
			return res
		}
	}
	return defaultVal
}
func toStringSlice(v interface{}, defaultVal []string) []string {
	if v == nil {
		return defaultVal
	}
	switch val := v.(type) {
	case []interface{}:
		res := make([]string, len(val))
		for i, item := range val {
			res[i] = fmt.Sprint(item)
		}
		return res
	case []string:
		return val
	case string:
		if val == "" {
			return defaultVal
		}
		return strings.Split(val, ",")
	}
	return defaultVal
}
func toInt(v interface{}, defaultVal int) int {
	if v == nil {
		return defaultVal
	}
	switch val := v.(type) {
	case int:
		return val
	case int32:
		return int(val)
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		var res int
		if _, err := fmt.Sscanf(val, "%d", &res); err == nil {
			return res
		}
	}
	return defaultVal
}

func toBool(v interface{}, defaultVal bool) bool {
	if v == nil {
		return defaultVal
	}
	switch val := v.(type) {
	case bool:
		return val
	case string:
		b, err := strconv.ParseBool(val)
		if err == nil {
			return b
		}
	}
	return defaultVal
}
