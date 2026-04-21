package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/gorilla/websocket"
	"github.com/manasgoyal/realtime-chat/internal/hub"
	"github.com/manasgoyal/realtime-chat/internal/store"
)

type Server struct {
	Registry *hub.Registry
	Store    *store.Store
	Upgrader websocket.Upgrader
}

func New(r *hub.Registry, s *store.Store) *Server {
	return &Server{
		Registry: r,
		Store:    s,
		Upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     func(r *http.Request) bool { return true },
		},
	}
}

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", s.healthz)
	mux.HandleFunc("/api/messages", s.getMessages)
	mux.HandleFunc("/ws", s.handleWS)
}

func (s *Server) healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) getMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	room := sanitizeRoom(q.Get("room"))
	if room == "" {
		http.Error(w, "missing or invalid room", http.StatusBadRequest)
		return
	}

	var msgs []store.Message
	var err error
	if sinceStr := q.Get("since"); sinceStr != "" {
		var since int64
		since, err = strconv.ParseInt(sinceStr, 10, 64)
		if err != nil {
			http.Error(w, "bad since", http.StatusBadRequest)
			return
		}
		msgs, err = s.Store.Since(ctx, room, since, 500)
	} else {
		limit := 50
		if l := q.Get("limit"); l != "" {
			if n, e := strconv.Atoi(l); e == nil {
				limit = n
			}
		}
		msgs, err = s.Store.Recent(ctx, room, limit)
	}
	if err != nil {
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	if msgs == nil {
		msgs = []store.Message{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msgs)
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	user := sanitizeUser(r.URL.Query().Get("user"))
	if user == "" {
		http.Error(w, "missing user", http.StatusBadRequest)
		return
	}
	room := sanitizeRoom(r.URL.Query().Get("room"))
	if room == "" {
		http.Error(w, "missing or invalid room", http.StatusBadRequest)
		return
	}
	conn, err := s.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	h := s.Registry.Get(room)
	c := hub.NewClient(h, conn, user)
	h.Register(c)
	go c.WritePump()
	go c.ReadPump()
}

func sanitizeUser(u string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range u {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		}
	}
	out := strings.TrimSpace(b.String())
	if len(out) > 32 {
		out = out[:32]
	}
	return out
}

var roomPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,39}$`)

// sanitizeRoom lowercases the input and accepts it only if it matches
// [a-z0-9][a-z0-9-]{2,39}. Returns "" for anything invalid.
func sanitizeRoom(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if !roomPattern.MatchString(s) {
		return ""
	}
	return s
}
