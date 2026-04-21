package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/manasgoyal/realtime-chat/internal/api"
	"github.com/manasgoyal/realtime-chat/internal/hub"
	"github.com/manasgoyal/realtime-chat/internal/spa"
	"github.com/manasgoyal/realtime-chat/internal/store"
)

func main() {
	// Prefer PORT (Render/Heroku-style injection); fall back to ADDR; default to :8080.
	addr := envOr("ADDR", "")
	if addr == "" {
		if port := os.Getenv("PORT"); port != "" {
			addr = ":" + port
		} else {
			addr = ":8080"
		}
	}
	dbPath := envOr("DB_PATH", "chat.db")

	s, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer s.Close()

	h := hub.New(s)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h.Run(ctx)

	mux := http.NewServeMux()
	apiSrv := api.New(h, s)
	apiSrv.Routes(mux)

	if handler, ok := spa.Handler(); ok {
		mux.Handle("/", handler)
	} else {
		log.Println("no SPA build found — serving placeholder")
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte("realtime-chat backend running. Build the frontend with `npm run build` in web/.\n"))
		})
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down…")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
