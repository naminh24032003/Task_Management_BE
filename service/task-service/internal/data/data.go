package data

import (
	"time"

	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"go.mongodb.org/mongo-driver/mongo"

	"task-service/internal/adapter/persistence/mongodb"
	mongoRepo "task-service/internal/adapter/persistence/mongodb"
	"task-service/internal/domain/repository"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(
	NewData,
	NewMongoDatabase,
	NewTaskRepository,
)

// Data holds all database connections
type Data struct {
	db     *mongo.Database
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

// DataConfig represents data configuration
type DataConfig struct {
	Database DatabaseConfig `json:"database"`
}

// NewData creates a new Data instance
func NewData(db *mongo.Database, logger log.Logger) (*Data, func(), error) {
	helper := log.NewHelper(log.With(logger, "module", "data"))

	d := &Data{
		db:     db,
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

// NewTaskRepository creates a new task repository
func NewTaskRepository(db *mongo.Database, logger log.Logger) repository.TaskRepository {
	helper := log.NewHelper(log.With(logger, "module", "data/repository"))
	helper.Info("creating task repository")

	return mongoRepo.NewTaskRepository(db)
}
