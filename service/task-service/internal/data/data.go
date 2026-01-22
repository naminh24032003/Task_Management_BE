package data

import (
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
	Driver                 string `json:"driver"`
	Source                 string `json:"source"`
	Name                   string `json:"name"`
	MinPoolSize            uint64 `json:"min_pool_size"`
	MaxPoolSize            uint64 `json:"max_pool_size"`
	ConnectTimeout         int    `json:"connect_timeout"`
	ServerSelectionTimeout int    `json:"server_selection_timeout"`
	SocketTimeout          int    `json:"socket_timeout"`
	ReadPreference         string `json:"read_preference"`
	ReadConcern            string `json:"read_concern"`
	WriteConcern           string `json:"write_concern"`
}

// RedisConfig represents Redis configuration
type RedisConfig struct {
	Addr           string `json:"addr"`
	Password       string `json:"password"`
	DB             int    `json:"db"`
	KeyPrefix      string `json:"key_prefix"`
	ReadTimeout    string `json:"read_timeout"`
	WriteTimeout   string `json:"write_timeout"`
	ConnectTimeout string `json:"connect_timeout"`
	MaxRetries     int    `json:"max_retries"`
}

// DataConfig represents data configuration
type DataConfig struct {
	Database DatabaseConfig `json:"database"`
	Redis    RedisConfig    `json:"redis"`
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
		MinPoolSize:            cfg.Data.Database.MinPoolSize,
		MaxPoolSize:            cfg.Data.Database.MaxPoolSize,
		ConnectTimeout:         time.Duration(cfg.Data.Database.ConnectTimeout) * time.Second,
		ServerSelectionTimeout: time.Duration(cfg.Data.Database.ServerSelectionTimeout) * time.Second,
		SocketTimeout:          time.Duration(cfg.Data.Database.SocketTimeout) * time.Second,
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
		DB:             cfg.Data.Redis.DB,
		KeyPrefix:      cfg.Data.Redis.KeyPrefix,
		ReadTimeout:    readTimeout,
		WriteTimeout:   writeTimeout,
		ConnectTimeout: connectTimeout,
		MaxRetries:     cfg.Data.Redis.MaxRetries,
	}
	client, cleanup, err := redisAdapter.NewClient(redisConfig)
	if err != nil {
		return nil, nil, err
	}
	return client, cleanup, nil
}

func NewKafkaProducer(c config.Config, logger log.Logger) (*kafka.Producer, func(), error) {
	var cfg struct {
		Kafka struct {
			Brokers []string `json:"brokers"`
			Topic   string   `json:"topic"`
		} `json:"kafka"`
	}
	if err := c.Scan(&cfg); err != nil {
		return nil, nil, err
	}
	producer, err := kafka.NewProducer(kafka.ProducerConfig{
		Brokers: cfg.Kafka.Brokers,
		Topic:   cfg.Kafka.Topic,
	})
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
