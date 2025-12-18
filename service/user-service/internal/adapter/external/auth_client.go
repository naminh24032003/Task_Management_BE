package external

import (
	"context"

	// Import task service proto
	// taskv1 "task-service/api/task/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// AuthClient wraps gRPC client for auth service
type AuthClient struct {
	conn *grpc.ClientConn
	// client authv1.AuthServiceClient
}

// NewAuthClient creates a client for auth-service
func NewAuthClient(address string) (*AuthClient, error) {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	return &AuthClient{
		conn: conn,
		// client: authv1.NewAuthServiceClient(conn),
	}, nil
}

// VerifyToken verifies JWT token via auth-service
func (c *AuthClient) VerifyToken(ctx context.Context, token string) (bool, error) {
	// TODO: Implement actual gRPC call
	// resp, err := c.client.VerifyToken(ctx, &authv1.VerifyTokenRequest{
	//     Token: token,
	// })
	return true, nil
}

// Close closes the client connection
func (c *AuthClient) Close() error {
	return c.conn.Close()
}
