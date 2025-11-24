package main

import (
	"log"
	"net/http"

	"api-gateway/internal/data"
	"api-gateway/internal/server"

	"google.golang.org/grpc"
)

func main() {
	// 1. Dial tới UserService gRPC
	conn, err := grpc.Dial("localhost:50050", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("failed to connect to user service: %v", err)
	}
	defer conn.Close()

	// 2. Tạo client từ connection
	userClient := data.NewUserClient(conn) // <-- nhận *grpc.ClientConn

	// 3. Đăng ký HTTP handler với client
	server.RegisterHTTPHandler(userClient)

	log.Println("API Gateway running at :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("failed to start HTTP server: %v", err)
	}
}
