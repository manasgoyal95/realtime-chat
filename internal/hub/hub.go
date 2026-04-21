package hub

import (
	"context"
	"encoding/json"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/manasgoyal/realtime-chat/internal/store"
)

// Outgoing events (server → client).
type Event struct {
	Type     string          `json:"type"`
	ID       int64           `json:"id,omitempty"`
	User     string          `json:"user,omitempty"`
	Body     string          `json:"body,omitempty"`
	TS       *time.Time      `json:"ts,omitempty"`
	ClientID string          `json:"clientId,omitempty"`
	Online   []string        `json:"online,omitempty"`
	Raw      json.RawMessage `json:"-"`
}

type Hub struct {
	store  *store.Store
	roomID string

	register   chan *Client
	unregister chan *Client
	incoming   chan incomingMsg

	mu      sync.RWMutex
	clients map[*Client]struct{}
	typing  map[string]*time.Timer // user → timer clearing their typing state
}

type incomingMsg struct {
	client *Client
	kind   string
	body   string
	cid    string
}

func New(s *store.Store, roomID string) *Hub {
	return &Hub{
		store:      s,
		roomID:     roomID,
		register:   make(chan *Client),
		unregister: make(chan *Client),
		incoming:   make(chan incomingMsg, 64),
		clients:    make(map[*Client]struct{}),
		typing:     make(map[string]*time.Timer),
	}
}

// RoomID returns the room this hub serves.
func (h *Hub) RoomID() string { return h.roomID }

func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = struct{}{}
			h.mu.Unlock()
			h.broadcastPresence()

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			if t, ok := h.typing[c.user]; ok {
				t.Stop()
				delete(h.typing, c.user)
			}
			h.mu.Unlock()
			h.broadcastPresence()

		case msg := <-h.incoming:
			h.handleIncoming(ctx, msg)
		}
	}
}

func (h *Hub) Register(c *Client)   { h.register <- c }
func (h *Hub) Unregister(c *Client) { h.unregister <- c }

func (h *Hub) Submit(c *Client, kind, body, cid string) {
	select {
	case h.incoming <- incomingMsg{client: c, kind: kind, body: body, cid: cid}:
	default:
		log.Printf("hub: dropping message from %s (queue full)", c.user)
	}
}

func (h *Hub) handleIncoming(ctx context.Context, m incomingMsg) {
	switch m.kind {
	case "message":
		if m.body == "" {
			return
		}
		saved, err := h.store.Insert(ctx, h.roomID, m.client.user, m.body)
		if err != nil {
			log.Printf("store insert: %v", err)
			return
		}
		ts := saved.TS
		h.sendTo(m.client, Event{Type: "ack", ClientID: m.cid, ID: saved.ID})
		h.broadcast(Event{
			Type:     "message",
			ID:       saved.ID,
			User:     saved.User,
			Body:     saved.Body,
			TS:       &ts,
			ClientID: m.cid,
		})

	case "typing":
		h.mu.Lock()
		if t, ok := h.typing[m.client.user]; ok {
			t.Stop()
		}
		user := m.client.user
		h.typing[user] = time.AfterFunc(5*time.Second, func() {
			h.mu.Lock()
			delete(h.typing, user)
			h.mu.Unlock()
			h.broadcast(Event{Type: "typing_stop", User: user})
		})
		h.mu.Unlock()
		h.broadcast(Event{Type: "typing", User: m.client.user})
	}
}

func (h *Hub) broadcast(ev Event) {
	data, err := json.Marshal(ev)
	if err != nil {
		log.Printf("marshal event: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.send <- data:
		default:
			// slow consumer — drop; readPump will close on next write error.
		}
	}
}

func (h *Hub) sendTo(c *Client, ev Event) {
	data, err := json.Marshal(ev)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}

func (h *Hub) broadcastPresence() {
	h.mu.RLock()
	seen := make(map[string]struct{}, len(h.clients))
	for c := range h.clients {
		seen[c.user] = struct{}{}
	}
	h.mu.RUnlock()
	users := make([]string, 0, len(seen))
	for u := range seen {
		users = append(users, u)
	}
	sort.Strings(users)
	h.broadcast(Event{Type: "presence", Online: users})
}
