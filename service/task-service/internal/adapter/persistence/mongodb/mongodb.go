package mongodb

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
	"go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"
)

// Config represents MongoDB configuration
type Config struct {
	URI      string
	Database string
	// Connection Pool
	MinPoolSize uint64
	MaxPoolSize uint64
	// Timeouts
	ConnectTimeout         time.Duration
	ServerSelectionTimeout time.Duration
	SocketTimeout          time.Duration
	// Read/Write Concerns
	ReadPreference string
	ReadConcern    string
	WriteConcern   string
}

// NewDatabase creates a new MongoDB database connection
func NewDatabase(cfg *Config) (*mongo.Database, func(), error) {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ConnectTimeout)
	defer cancel()

	// Client options
	clientOptions := options.Client().
		ApplyURI(cfg.URI).
		SetMinPoolSize(cfg.MinPoolSize).
		SetMaxPoolSize(cfg.MaxPoolSize).
		SetServerSelectionTimeout(cfg.ServerSelectionTimeout).
		SetSocketTimeout(cfg.SocketTimeout).
		SetRetryWrites(true).
		SetRetryReads(true).
		SetMonitor(otelmongo.NewMonitor())

	// Read Preference
	switch cfg.ReadPreference {
	case "primary":
		clientOptions.SetReadPreference(readpref.Primary())
	case "primaryPreferred":
		clientOptions.SetReadPreference(readpref.PrimaryPreferred())
	case "secondary":
		clientOptions.SetReadPreference(readpref.Secondary())
	case "secondaryPreferred":
		clientOptions.SetReadPreference(readpref.SecondaryPreferred())
	case "nearest":
		clientOptions.SetReadPreference(readpref.Nearest())
	default:
		clientOptions.SetReadPreference(readpref.PrimaryPreferred())
	}

	// Read Concern
	switch cfg.ReadConcern {
	case "local":
		clientOptions.SetReadConcern(readconcern.Local())
	case "majority":
		clientOptions.SetReadConcern(readconcern.Majority())
	case "linearizable":
		clientOptions.SetReadConcern(readconcern.Linearizable())
	case "available":
		clientOptions.SetReadConcern(readconcern.Available())
	default:
		clientOptions.SetReadConcern(readconcern.Majority())
	}

	// Write Concern
	var wc *writeconcern.WriteConcern
	switch cfg.WriteConcern {
	case "1":
		wc = writeconcern.New(writeconcern.W(1), writeconcern.J(true), writeconcern.WTimeout(5*time.Second))
	case "majority":
		wc = writeconcern.New(writeconcern.WMajority(), writeconcern.J(true), writeconcern.WTimeout(5*time.Second))
	default:
		wc = writeconcern.New(writeconcern.WMajority(), writeconcern.J(true), writeconcern.WTimeout(5*time.Second))
	}
	clientOptions.SetWriteConcern(wc)

	// Connect to MongoDB
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	fmt.Println("✅ Connected to MongoDB successfully")

	db := client.Database(cfg.Database)

	// Cleanup function
	cleanup := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := client.Disconnect(ctx); err != nil {
			fmt.Printf("Error disconnecting from MongoDB: %v\n", err)
		} else {
			fmt.Println("Disconnected from MongoDB")
		}
	}

	return db, cleanup, nil
}
