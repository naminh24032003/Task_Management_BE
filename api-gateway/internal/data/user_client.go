package data

import (
	"context"

	userv1 "github.com/naminh24032003/task_management_be/shared-proto/gen/go/api/user/v1"
	"google.golang.org/grpc"
)

type UserClient struct {
	client userv1.UserServiceClient
}

func NewUserClient(conn *grpc.ClientConn) *UserClient {
	return &UserClient{
		client: userv1.NewUserServiceClient(conn),
	}
}

func (c *UserClient) Hello(ctx context.Context, name string) (string, error) {
	resp, err := c.client.Hello(ctx, &userv1.HelloRequest{
		Name: name,
	})
	if err != nil {
		return "", err
	}
	return resp.Message, nil
}
