package main

import (
	"log"
	"net"

	userpb "user-service/api/user/v1"
	"user-service/internal/service"

	"google.golang.org/grpc"
)

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	server := grpc.NewServer()
	userpb.RegisterUserServiceServer(server, &service.UserServiceServer{})

	log.Println("User Service running at :50051")
	if err := server.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
