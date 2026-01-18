package data

import (
	"time"

	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"task-service/internal/adapter/persistence/mongodb"
	mongoRepo "task-service/internal/adapter/persistence/mongodb"
	redisAdapter "task-service/internal/adapter/persistence/redis"
	"task-service/internal/domain/repository"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(
	NewData,
	NewMongoDatabase,
	NewRedisClient,
	NewTaskRepository,
)

// Data holds all database connections
type Data struct {
	db     *mongo.Database
	redis  *redis.Client
	logger *log.Helper
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Driver                 string        `json:"driver"`
	Source                 string        `json:"source"`
	Name                   string        `json:"name"`
	MinPoolSize            uint64        `json:"min_pool_size"`
	MaxPoolSize            uint64        `json:"max_pool_size"`
	ConnectTimeout         int           `json:"connect_timeout"`
	ServerSelectionTimeout int           `json:"server_selection_timeout"`
	SocketTimeout          int           `json:"socket_timeout"`
	ReadPreference         string        `json:"read_preference"`
	ReadConcern            string        `json:"read_concern"`
	WriteConcern           string        `json:"write_concern"`
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

	// Parse config
	var cfg struct {
		Data DataConfig `json:"data"`
	}

	if err := c.Scan(&cfg); err != nil {
		helper.Errorf("failed to scan config: %v", err)
		return nil, nil, err
	}

	// Convert to MongoDB config
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

	helper.Infof("connecting to MongoDB: %s/%s", mongoConfig.URI, mongoConfig.Database)

	// Create database connection
	db, cleanup, err := mongodb.NewDatabase(mongoConfig)
	if err != nil {
		helper.Errorf("failed to connect to MongoDB: %v", err)
		return nil, nil, err
	}

	helper.Info("MongoDB connected successfully")

	return db, cleanup, nil
}

// NewRedisClient creates a new Redis client
func NewRedisClient(c config.Config, logger log.Logger) (*redis.Client, func(), error) {
	helper := log.NewHelper(log.With(logger, "module", "data/redis"))

	// Parse config
	var cfg struct {
		Data DataConfig `json:"data"`
	}

	if err := c.Scan(&cfg); err != nil {
		helper.Errorf("failed to scan config: %v", err)
		return nil, nil, err
	}

	// Parse durations
	readTimeout, _ := time.ParseDuration(cfg.Data.Redis.ReadTimeout)
	writeTimeout, _ := time.ParseDuration(cfg.Data.Redis.WriteTimeout)
	connectTimeout, _ := time.ParseDuration(cfg.Data.Redis.ConnectTimeout)

	if readTimeout == 0 {
		readTimeout = 200 * time.Millisecond
	}
	if writeTimeout == 0 {
		writeTimeout = 200 * time.Millisecond
	}
	if connectTimeout == 0 {
		connectTimeout = 10 * time.Second
	}

	// Convert to Redis config
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

	helper.Infof("connecting to Redis: %s", redisConfig.Addr)

	// Create Redis client
	client, cleanup, err := redisAdapter.NewClient(redisConfig)
	if err != nil {
		helper.Errorf("failed to connect to Redis: %v", err)
		return nil, nil, err
	}

	helper.Info("Redis connected successfully")

	return client, cleanup, nil
}

// NewTaskRepository creates a new task repository
func NewTaskRepository(db *mongo.Database, logger log.Logger) repository.TaskRepository {
	helper := log.NewHelper(log.With(logger, "module", "data/repository"))
	helper.Info("creating task repository")

	return mongoRepo.NewTaskRepository(db)
}
