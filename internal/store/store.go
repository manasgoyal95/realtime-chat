package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	_ "modernc.org/sqlite"
)

type Message struct {
	ID     int64     `json:"id"`
	RoomID string    `json:"roomId"`
	User   string    `json:"user"`
	Body   string    `json:"body"`
	TS     time.Time `json:"ts"`
}

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	// Create table at minimum viable shape, then additively evolve it.
	if _, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id    INTEGER PRIMARY KEY AUTOINCREMENT,
			user  TEXT    NOT NULL,
			body  TEXT    NOT NULL,
			ts    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`); err != nil {
		return err
	}
	// Add room_id additively — tolerates pre-existing rows by defaulting them to "public".
	if !s.hasColumn("messages", "room_id") {
		if _, err := s.db.Exec(
			`ALTER TABLE messages ADD COLUMN room_id TEXT NOT NULL DEFAULT 'public'`,
		); err != nil {
			return err
		}
	}
	if _, err := s.db.Exec(
		`CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id, id)`,
	); err != nil {
		return err
	}
	return nil
}

func (s *Store) hasColumn(table, col string) bool {
	rows, err := s.db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false
		}
		if name == col {
			return true
		}
	}
	return false
}

func (s *Store) Insert(ctx context.Context, room, user, body string) (Message, error) {
	room = trim(room, 40)
	user = trim(user, 32)
	body = trim(body, 2000)
	if room == "" || user == "" || body == "" {
		return Message{}, errors.New("room, user and body required")
	}
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO messages (room_id, user, body, ts) VALUES (?, ?, ?, ?)`,
		room, user, body, now,
	)
	if err != nil {
		return Message{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Message{}, err
	}
	return Message{ID: id, RoomID: room, User: user, Body: body, TS: now}, nil
}

func (s *Store) Recent(ctx context.Context, room string, limit int) ([]Message, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, room_id, user, body, ts FROM messages
		 WHERE room_id = ? ORDER BY id DESC LIMIT ?`, room, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.RoomID, &m.User, &m.Body, &m.TS); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	reverse(out)
	return out, rows.Err()
}

func (s *Store) Since(ctx context.Context, room string, sinceID int64, limit int) ([]Message, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, room_id, user, body, ts FROM messages
		 WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT ?`,
		room, sinceID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.RoomID, &m.User, &m.Body, &m.TS); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func reverse(m []Message) {
	for i, j := 0, len(m)-1; i < j; i, j = i+1, j-1 {
		m[i], m[j] = m[j], m[i]
	}
}

func trim(s string, max int) string {
	if len(s) > max {
		return s[:max]
	}
	return s
}
