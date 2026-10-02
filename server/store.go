package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS workspaces (
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	invite_code TEXT NOT NULL UNIQUE,
	created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
	id           TEXT PRIMARY KEY,
	email        TEXT NOT NULL UNIQUE,
	name         TEXT NOT NULL,
	pass_hash    BLOB NOT NULL,
	workspace_id TEXT NOT NULL REFERENCES workspaces(id),
	role         TEXT NOT NULL,
	created_at   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token_hash TEXT PRIMARY KEY,
	user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS estimates (
	workspace_id TEXT NOT NULL,
	id           TEXT NOT NULL,
	version      INTEGER NOT NULL,
	updated_at   INTEGER NOT NULL,
	updated_by   TEXT NOT NULL,
	deleted      INTEGER NOT NULL DEFAULT 0,
	data         TEXT NOT NULL,
	PRIMARY KEY (workspace_id, id)
);
CREATE INDEX IF NOT EXISTS estimates_updated ON estimates (workspace_id, updated_at);
CREATE TABLE IF NOT EXISTS docs (
	workspace_id TEXT NOT NULL,
	key          TEXT NOT NULL,
	version      INTEGER NOT NULL,
	updated_at   INTEGER NOT NULL,
	updated_by   TEXT NOT NULL,
	data         TEXT NOT NULL,
	PRIMARY KEY (workspace_id, key)
);
`

// Store wraps the SQLite database. SQLite with WAL is plenty for a team-sized workload and keeps
// the server a single binary with a single data file to back up.
type Store struct {
	db *sql.DB
}

func OpenStore(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite allows one writer; serialising keeps it simple and safe.
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func nowMs() int64 { return time.Now().UnixMilli() }

var ErrConflict = errors.New("version conflict")
var ErrNotFound = errors.New("not found")

type Workspace struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	InviteCode string `json:"inviteCode,omitempty"`
}

type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	WorkspaceID string `json:"workspaceId"`
	Role        string `json:"role"`
	passHash    []byte
}

func (s *Store) CreateWorkspace(ctx context.Context, tx *sql.Tx, name string) (Workspace, error) {
	w := Workspace{ID: newID(), Name: name, InviteCode: newInviteCode()}
	_, err := tx.ExecContext(ctx, `INSERT INTO workspaces (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)`, w.ID, w.Name, w.InviteCode, nowMs())
	return w, err
}

func (s *Store) WorkspaceByInvite(ctx context.Context, tx *sql.Tx, code string) (Workspace, error) {
	var w Workspace
	err := tx.QueryRowContext(ctx, `SELECT id, name, invite_code FROM workspaces WHERE invite_code = ?`, code).Scan(&w.ID, &w.Name, &w.InviteCode)
	if errors.Is(err, sql.ErrNoRows) {
		return w, ErrNotFound
	}
	return w, err
}

func (s *Store) Workspace(ctx context.Context, id string) (Workspace, error) {
	var w Workspace
	err := s.db.QueryRowContext(ctx, `SELECT id, name, invite_code FROM workspaces WHERE id = ?`, id).Scan(&w.ID, &w.Name, &w.InviteCode)
	if errors.Is(err, sql.ErrNoRows) {
		return w, ErrNotFound
	}
	return w, err
}

func (s *Store) RotateInvite(ctx context.Context, workspaceID string) (string, error) {
	code := newInviteCode()
	_, err := s.db.ExecContext(ctx, `UPDATE workspaces SET invite_code = ? WHERE id = ?`, code, workspaceID)
	return code, err
}

func (s *Store) RenameWorkspace(ctx context.Context, workspaceID, name string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE workspaces SET name = ? WHERE id = ?`, name, workspaceID)
	return err
}

func (s *Store) CreateUser(ctx context.Context, tx *sql.Tx, u User) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO users (id, email, name, pass_hash, workspace_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.Name, u.passHash, u.WorkspaceID, u.Role, nowMs())
	return err
}

func (s *Store) UserByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := s.db.QueryRowContext(ctx, `SELECT id, email, name, pass_hash, workspace_id, role FROM users WHERE email = ?`, email).
		Scan(&u.ID, &u.Email, &u.Name, &u.passHash, &u.WorkspaceID, &u.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) Members(ctx context.Context, workspaceID string) ([]User, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, email, name, workspace_id, role FROM users WHERE workspace_id = ? ORDER BY created_at`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.WorkspaceID, &u.Role); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// RemoveMember deletes a user of the workspace together with their sessions.
func (s *Store) RemoveMember(ctx context.Context, workspaceID, userID string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = ? AND workspace_id = ? AND role <> 'owner'`, userID, workspaceID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) CreateSession(ctx context.Context, userID string, ttl time.Duration) (string, error) {
	token := newToken()
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
		hashToken(token), userID, time.Now().Add(ttl).UnixMilli(), nowMs())
	return token, err
}

func (s *Store) UserBySession(ctx context.Context, token string) (User, error) {
	var u User
	err := s.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u.workspace_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, hashToken(token), nowMs()).
		Scan(&u.ID, &u.Email, &u.Name, &u.WorkspaceID, &u.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

// Record is a versioned JSON document: an estimate or a shared workspace document.
type Record struct {
	ID        string `json:"id"`
	Version   int64  `json:"version"`
	UpdatedAt int64  `json:"updatedAt"`
	UpdatedBy string `json:"updatedBy"`
	Deleted   bool   `json:"deleted,omitempty"`
	Data      []byte `json:"-"`
}

func (s *Store) EstimatesSince(ctx context.Context, workspaceID string, since int64) ([]Record, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, version, updated_at, updated_by, deleted, data FROM estimates WHERE workspace_id = ? AND updated_at >= ? ORDER BY updated_at`, workspaceID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Record{}
	for rows.Next() {
		var r Record
		var data string
		if err := rows.Scan(&r.ID, &r.Version, &r.UpdatedAt, &r.UpdatedBy, &r.Deleted, &data); err != nil {
			return nil, err
		}
		r.Data = []byte(data)
		out = append(out, r)
	}
	return out, rows.Err()
}

// PutEstimate writes an estimate if `base` matches the stored version (0 = new). On a mismatch it
// returns ErrConflict together with the current record so the client can resolve it.
func (s *Store) PutEstimate(ctx context.Context, workspaceID, id string, base int64, data []byte, by string, deleted bool) (Record, error) {
	return s.putVersioned(ctx, "estimates", "id", workspaceID, id, base, data, by, deleted)
}

func (s *Store) GetEstimate(ctx context.Context, workspaceID, id string) (Record, error) {
	return s.getVersioned(ctx, "estimates", "id", workspaceID, id)
}

func (s *Store) GetDoc(ctx context.Context, workspaceID, key string) (Record, error) {
	return s.getVersioned(ctx, "docs", "key", workspaceID, key)
}

func (s *Store) PutDoc(ctx context.Context, workspaceID, key string, base int64, data []byte, by string) (Record, error) {
	return s.putVersioned(ctx, "docs", "key", workspaceID, key, base, data, by, false)
}

func (s *Store) getVersioned(ctx context.Context, table, idCol, workspaceID, id string) (Record, error) {
	var r Record
	var data string
	q := fmt.Sprintf(`SELECT %s, version, updated_at, updated_by, data FROM %s WHERE workspace_id = ? AND %s = ?`, idCol, table, idCol)
	err := s.db.QueryRowContext(ctx, q, workspaceID, id).Scan(&r.ID, &r.Version, &r.UpdatedAt, &r.UpdatedBy, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return r, ErrNotFound
	}
	if table == "estimates" && err == nil {
		_ = s.db.QueryRowContext(ctx, `SELECT deleted FROM estimates WHERE workspace_id = ? AND id = ?`, workspaceID, id).Scan(&r.Deleted)
	}
	r.Data = []byte(data)
	return r, err
}

func (s *Store) putVersioned(ctx context.Context, table, idCol, workspaceID, id string, base int64, data []byte, by string, deleted bool) (Record, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Record{}, err
	}
	defer tx.Rollback()
	var current int64
	err = tx.QueryRowContext(ctx, fmt.Sprintf(`SELECT version FROM %s WHERE workspace_id = ? AND %s = ?`, table, idCol), workspaceID, id).Scan(&current)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Record{}, err
	}
	if current != base {
		tx.Rollback()
		cur, gerr := s.getVersioned(ctx, table, idCol, workspaceID, id)
		if gerr != nil {
			return Record{}, gerr
		}
		return cur, ErrConflict
	}
	r := Record{ID: id, Version: current + 1, UpdatedAt: nowMs(), UpdatedBy: by, Deleted: deleted, Data: data}
	if table == "estimates" {
		_, err = tx.ExecContext(ctx, `INSERT INTO estimates (workspace_id, id, version, updated_at, updated_by, deleted, data) VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (workspace_id, id) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by, deleted = excluded.deleted, data = excluded.data`,
			workspaceID, id, r.Version, r.UpdatedAt, by, deleted, string(data))
	} else {
		_, err = tx.ExecContext(ctx, `INSERT INTO docs (workspace_id, key, version, updated_at, updated_by, data) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT (workspace_id, key) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by, data = excluded.data`,
			workspaceID, id, r.Version, r.UpdatedAt, by, string(data))
	}
	if err != nil {
		return Record{}, err
	}
	return r, tx.Commit()
}
