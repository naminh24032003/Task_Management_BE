package grpc

import (
	"context"
	"fmt"
	"log"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	grpcMetadata "google.golang.org/grpc/metadata"

	userv1 "notification-service/api/user/v1"
	"notification-service/internal/ports"
)

// UserServiceClient implements ports.UserService via gRPC to user-service
type UserServiceClient struct {
	conn   *grpc.ClientConn
	client userv1.UserServiceClient
}

// NewUserServiceClient creates a new UserServiceClient
func NewUserServiceClient(address string) (*UserServiceClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to user service at %s: %w", address, err)
	}

	client := userv1.NewUserServiceClient(conn)
	log.Printf("User service gRPC client created for: %s", address)

	return &UserServiceClient{
		conn:   conn,
		client: client,
	}, nil
}

// Close closes the gRPC connection
func (c *UserServiceClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// GetUserPreference gets notification preferences for a user
func (c *UserServiceClient) GetUserPreference(ctx context.Context, userID string) (*ports.UserPreference, error) {
	email, err := c.GetUserEmail(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &ports.UserPreference{
		UserID:       userID,
		EmailEnabled: true,
		PushEnabled:  true,
		InAppEnabled: true,
		EmailAddress: email,
	}, nil
}

// GetUsersByProjectID gets all users in a project
func (c *UserServiceClient) GetUsersByProjectID(ctx context.Context, projectID string) ([]string, error) {
	return nil, nil
}

// GetUserEmail gets the email address for a user by calling user-service GetUser RPC
func (c *UserServiceClient) GetUserEmail(ctx context.Context, userID string) (string, error) {
	// Add internal service metadata
	md := grpcMetadata.Pairs("x-tenant-id", "system", "x-user-id", "system")
	ctx = grpcMetadata.NewOutgoingContext(ctx, md)

	resp, err := c.client.GetUser(ctx, &userv1.GetUserRequest{UserId: userID})
	if err != nil {
		return "", fmt.Errorf("failed to get user %s: %w", userID, err)
	}

	if resp.User == nil {
		return "", fmt.Errorf("user not found: %s", userID)
	}

	return resp.User.Email, nil
}

// GetUserPushToken gets the push notification token for a user
func (c *UserServiceClient) GetUserPushToken(ctx context.Context, userID string) (string, error) {
	return "", nil
}

// Verify interface implementation
var _ ports.UserService = (*UserServiceClient)(nil)
