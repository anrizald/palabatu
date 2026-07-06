package service

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/repository"
)

// GetProfile returns (nil, nil) when no profile row exists, matching
// palabatu-be/routes/api.ts's `res.json(null)` for a missing profile.
func GetProfile(ctx context.Context, id string) (*repository.Profile, error) {
	profile, err := repository.GetProfileByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return profile, err
}

func UpsertProfile(ctx context.Context, id, username string, title, tags json.RawMessage, avatarURL string) (*repository.Profile, error) {
	if title == nil {
		title = json.RawMessage("null")
	}
	if tags == nil {
		tags = json.RawMessage("null")
	}
	return repository.UpsertProfile(ctx, id, username, title, tags, avatarURL)
}
