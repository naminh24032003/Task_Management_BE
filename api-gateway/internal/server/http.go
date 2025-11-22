package server

import (
	"net/http"

	"api-gateway/internal/data"
)

func RegisterHTTPHandler(userClient *data.UserClient) {
	http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		if name == "" {
			name = "Guest"
		}
		msg, err := userClient.Hello(r.Context(), name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Write([]byte(msg))
	})
}
