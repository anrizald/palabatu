package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/db"
)

// Profile.Title and .Tags are passed through as opaque JSON: title is a
// JSON array of role strings (e.g. ["Council"]) and tags is a
// frontend-defined object ({ level, styles }), mirroring how
// palabatu-be/routes/api.ts just re-serializes whatever was stored rather
// than asserting a shape.
type Profile struct {
	ID        string          `json:"id"`
	Username  *string         `json:"username"`
	Title     json.RawMessage `json:"title"`
	Tags      json.RawMessage `json:"tags"`
	AvatarURL *string         `json:"avatar_url"`
}

func GetProfileByID(ctx context.Context, id string) (*Profile, error) {
	var p Profile
	err := db.Pool.QueryRow(ctx,
		`SELECT id, username, title, tags, avatar_url FROM profiles WHERE id = $1`,
		id,
	).Scan(&p.ID, &p.Username, &p.Title, &p.Tags, &p.AvatarURL)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func UpsertProfile(ctx context.Context, id, username string, title, tags json.RawMessage, avatarURL string) (*Profile, error) {
	var p Profile
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO profiles (id, username, title, tags, avatar_url)
		 VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
		 ON CONFLICT (id) DO UPDATE SET username = $2, title = $3::jsonb, tags = $4::jsonb, avatar_url = $5
		 RETURNING id, username, title, tags, avatar_url`,
		id, username, string(title), string(tags), avatarURL,
	).Scan(&p.ID, &p.Username, &p.Title, &p.Tags, &p.AvatarURL)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// GetUserTitles reads profiles.title for authorization checks (the
// "Council" role gate on problem edit/delete), mirroring
// palabatu-be/routes/api.ts's getUserTitles(). A missing profile, null
// title, or legacy non-array value all yield an empty slice rather than an
// error, matching that helper's try/catch fallback.
func GetUserTitles(ctx context.Context, userID string) ([]string, error) {
	var raw json.RawMessage
	err := db.Pool.QueryRow(ctx, `SELECT title FROM profiles WHERE id = $1`, userID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return []string{}, nil
	}

	var titles []string
	if err := json.Unmarshal(raw, &titles); err != nil {
		return []string{}, nil
	}
	return titles, nil
}
