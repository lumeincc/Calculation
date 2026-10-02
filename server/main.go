// Command server is the backend of СтройРасчёт: accounts, company workspaces and shared
// estimates / price lists. It can also serve the built frontend from the same binary.
package main

import (
	"context"
	"embed"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"
)

//go:embed all:web
var webFS embed.FS

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	store, err := OpenStore(env("DB_PATH", "data/stroyraschet.db"))
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer store.Close()

	api := NewAPI(store, strings.Split(env("ALLOWED_ORIGINS", ""), ","))
	mux := http.NewServeMux()
	api.Routes(mux)
	mux.Handle("/", spaHandler())

	srv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           api.CORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
	}
	go func() {
		log.Printf("listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

// spaHandler serves the embedded frontend; unknown paths fall back to index.html.
func spaHandler() http.Handler {
	sub, _ := fs.Sub(webFS, "web")
	files := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(sub, p); err != nil {
			if _, err := fs.Stat(sub, "index.html"); err != nil {
				http.Error(w, "Фронтенд не собран: выполните npm run build и скопируйте dist в server/web", http.StatusNotFound)
				return
			}
			r.URL.Path = "/"
		}
		if strings.HasPrefix(p, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
}
