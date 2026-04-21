package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	_ "modernc.org/sqlite"
)

type Message struct {
	ID   int64     `json:"id"`
	User string    `json:"user"`
	Body string    `json:"body"`
	TS   time.Time `json:"ts"`
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
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id    INTEGER PRIMARY KEY AUTOINCREMENT,
			user  TEXT    NOT NULL,
			body  TEXT    NOT NULL,
			ts    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_messages_id ON messages(id);
	`)
	return err
}

func (s *Store) Insert(ctx context.Context, user, body string) (Message, error) {
	user = trim(user, 32)
	body = trim(body, 2000)
	if user == "" || body == "" {
		return Message{}, errors.New("user and body required")
	}
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO messages (user, body, ts) VALUES (?, ?, ?)`,
		user, body, now,
	)
	if err != nil {
		return Message{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Message{}, err
	}
	return Message{ID: id, User: user, Body: body, TS: now}, nil
}

func (s *Store) Recent(ctx context.Context, limit int) ([]Message, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user, body, ts FROM messages ORDER BY id DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.User, &m.Body, &m.TS); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	reverse(out)
	return out, rows.Err()
}

func (s *Store) Since(ctx context.Context, sinceID int64, limit int) ([]Message, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user, body, ts FROM messages WHERE id > ? ORDER BY id ASC LIMIT ?`,
		sinceID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.User, &m.Body, &m.TS); err != nil {
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
