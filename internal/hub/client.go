package hub

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 4096
)

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	user string
}

func NewClient(h *Hub, conn *websocket.Conn, user string) *Client {
	return &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 32),
		user: user,
	}
}

func (c *Client) User() string { return c.user }

type inbound struct {
	Type     string `json:"type"`
	Body     string `json:"body,omitempty"`
	ClientID string `json:"clientId,omitempty"`
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("ws read: %v", err)
			}
			return
		}
		var in inbound
		if err := json.Unmarshal(data, &in); err != nil {
			continue
		}
		in.Body = strings.TrimSpace(in.Body)
		switch in.Type {
		case "message":
			if in.Body == "" {
				continue
			}
			c.hub.Submit(c, "message", in.Body, in.ClientID)
		case "typing":
			c.hub.Submit(c, "typing", "", "")
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
