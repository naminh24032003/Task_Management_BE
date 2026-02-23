package grpc_test

import (
	"context"
	"net"
	"testing"

	taskv1 "task-service/api/task/v1"
	"task-service/internal/application/handler"
	transport_grpc "task-service/internal/transport/grpc"
	"task-service/tests/mocks"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
)

const bufSize = 1024 * 1024

var lis *bufconn.Listener

func startTaskServer() *grpc.Server {
	lis = bufconn.Listen(bufSize)
	s := grpc.NewServer()

	repo := &mocks.MockTaskRepository{}
	uow := &mocks.MockUnitOfWork{}
	finder := &mocks.MockTaskFinder{}
	cmdHandler := handler.NewCommandHandlerOutbox(uow, finder, nil, nil)
	queryHandler := handler.NewQueryHandler(repo, nil)

	svc := transport_grpc.NewTaskService(cmdHandler, queryHandler, nil)
	taskv1.RegisterTaskServiceServer(s, svc)

	go func() {
		if err := s.Serve(lis); err != nil {
			return
		}
	}()
	return s
}

func bufDialer(context.Context, string) (net.Conn, error) {
	return lis.Dial()
}

func TestHelloContract(t *testing.T) {
	s := startTaskServer()
	defer s.Stop()

	ctx := context.Background()
	conn, err := grpc.DialContext(ctx, "bufnet", grpc.WithContextDialer(bufDialer), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("Failed to dial bufnet: %v", err)
	}
	defer conn.Close()

	client := taskv1.NewTaskServiceClient(conn)
	resp, err := client.Hello(ctx, &taskv1.HelloRequest{Name: "Contract Test"})
	if err != nil {
		t.Fatalf("Hello failed: %v", err)
	}

	expected := "Hello, Contract Test!"
	if resp.Message != expected {
		t.Errorf("expected %s, got %s", expected, resp.Message)
	}
}
