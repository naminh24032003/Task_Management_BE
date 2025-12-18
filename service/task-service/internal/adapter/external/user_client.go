package external

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// UserClient wraps gRPC client for user-service
type UserClient struct {
	conn *grpc.ClientConn
	// client userv1.UserServiceClient
}

// NewUserClient creates a client for user-service
func NewUserClient(address string) (*UserClient, error) {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	return &UserClient{
		conn: conn,
		// client: userv1.NewUserServiceClient(conn),
	}, nil
}

// ValidateUser validates if user exists
func (c *UserClient) ValidateUser(ctx context.Context, userID string) (bool, error) {
	// TODO: Implement actual gRPC call
	// resp, err := c.client.GetUser(ctx, &userv1.GetUserRequest{
	//     Id: userID,
	// })
	// return resp != nil, err
	return true, nil
}

// GetUserCapacity returns user's capacity for new tasks
func (c *UserClient) GetUserCapacity(ctx context.Context, userID string) (int, error) {
	// TODO: Implement actual gRPC call
	// This could be based on user's current task count vs max allowed
	return 10, nil
}

// Close closes the client connection
func (c *UserClient) Close() error {
	return c.conn.Close()
}
