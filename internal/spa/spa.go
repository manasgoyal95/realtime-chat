package spa

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var embedded embed.FS

// Handler returns an http.Handler serving the embedded Vite build.
// It falls back to index.html for unknown non-asset paths (SPA routing).
// If no build is present, ok is false.
func Handler() (h http.Handler, ok bool) {
	sub, err := fs.Sub(embedded, "dist")
	if err != nil {
		return nil, false
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil, false
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := path.Clean(r.URL.Path)
		if clean == "/" {
			serveIndex(w, sub)
			return
		}
		trimmed := strings.TrimPrefix(clean, "/")
		if f, err := sub.Open(trimmed); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		if strings.Contains(path.Base(clean), ".") {
			http.NotFound(w, r)
			return
		}
		serveIndex(w, sub)
	}), true
}

func serveIndex(w http.ResponseWriter, sub fs.FS) {
	data, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		http.Error(w, "missing index", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(data)
}
