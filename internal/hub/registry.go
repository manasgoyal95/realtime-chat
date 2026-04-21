package hub

import (
	"context"
	"sync"

	"github.com/manasgoyal/realtime-chat/internal/store"
)

// Registry owns one *Hub per room, lazily created on first access.
// Hubs stay alive for the lifetime of the registry context — fine for a
// small demo; a production version would evict idle hubs after N minutes.
type Registry struct {
	ctx   context.Context
	store *store.Store

	mu   sync.Mutex
	hubs map[string]*Hub
}

func NewRegistry(ctx context.Context, s *store.Store) *Registry {
	return &Registry{
		ctx:   ctx,
		store: s,
		hubs:  make(map[string]*Hub),
	}
}

// Get returns the hub for the given room, creating and starting it if needed.
func (r *Registry) Get(roomID string) *Hub {
	r.mu.Lock()
	defer r.mu.Unlock()
	if h, ok := r.hubs[roomID]; ok {
		return h
	}
	h := New(r.store, roomID)
	r.hubs[roomID] = h
	go h.Run(r.ctx)
	return h
}
