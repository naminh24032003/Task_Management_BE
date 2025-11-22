package main

import (
	"log"
	"net/http"

	"api-gateway/internal/data"
	"api-gateway/internal/server"
)

func main() {
	userClient := data.NewUserClient("localhost:50051")
	server.RegisterHTTPHandler(userClient)

	log.Println("API Gateway running at :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("failed to start HTTP server: %v", err)
	}
}
