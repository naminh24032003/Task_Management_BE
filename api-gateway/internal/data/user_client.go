package data

import (
	"context"
	"log"

	userpb "api-gateway/api/user/v1"

	"google.golang.org/grpc"
)

type UserClient struct {
	client userpb.UserServiceClient
}

func NewUserClient(target string) *UserClient {
	conn, err := grpc.Dial(target, grpc.WithInsecure())
	if err != nil {
		log.Fatalf("failed to connect user-service: %v", err)
	}
	client := userpb.NewUserServiceClient(conn)
	return &UserClient{client: client}
}

func (u *UserClient) Hello(ctx context.Context, name string) (string, error) {
	resp, err := u.client.Hello(ctx, &userpb.HelloRequest{Name: name})
	if err != nil {
		return "", err
	}
	return resp.Message, nil
}
