package server

import (
	stdHttp "net/http" // alias cho net/http

	kratosHttp "github.com/go-kratos/kratos/v2/transport/http" // alias cho Kratos HTTP
)

func NewHTTPServer1() *kratosHttp.Server {
	srv := kratosHttp.NewServer(
		kratosHttp.Address(":8000"),
	)

	srv.HandleFunc("/hello", func(w stdHttp.ResponseWriter, r *stdHttp.Request) {
		w.WriteHeader(stdHttp.StatusOK)
		w.Write([]byte("Hello world from API Gateway!"))
	})

	return srv
}
