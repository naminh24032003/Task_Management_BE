package main

import (
	"log"
	"net"

	"user-service/internal/server"
	"user-service/internal/service"
)

func main() {
	// Tạo UserService
	userSvc := service.NewUserService()

	// Tạo gRPC server
	grpcServer := server.NewGRPCServer(userSvc)

	// Listen trên port 50050
	lis, err := net.Listen("tcp", ":50050")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	log.Println("User Service gRPC server running at :50050")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
