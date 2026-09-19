package drafts

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// Draft is the full row, returned when resuming one (GET /api/drafts/:id)
// and from create/update. Payload stays json.RawMessage all the way out --
// this domain never unmarshals it into a concrete shape, only stores and
// returns it (see dto.go).
type Draft struct {
	ID        string          `json:"id"`
	Intent    string          `json:"intent"`
	Label     string          `json:"label"`
	Payload   json.RawMessage `json:"payload"`
	PhotoURLs []string        `json:"photo_urls"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// DraftListItem is GET /api/drafts' shape -- enough for the drafts overlay's
// list without shipping every draft's full payload over the wire.
// ThumbnailURL is photo_urls[1] (if any), not the opaque payload -- the
// drafts overlay's row thumbnail (handoff-drafts.md decision 6's "the
// staged photo, if any, is the card's thumbnail") needs one URL, not
// everything else a resume would need.
type DraftListItem struct {
	ID           string    `json:"id"`
	Intent       string    `json:"intent"`
	Label        string    `json:"label"`
	ThumbnailURL *string   `json:"thumbnail_url"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func listDrafts(ctx context.Context, userID string) ([]DraftListItem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, intent, label, photo_urls[1], updated_at
		FROM drafts
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []DraftListItem{}
	for rows.Next() {
		var d DraftListItem
		if err := rows.Scan(&d.ID, &d.Intent, &d.Label, &d.ThumbnailURL, &d.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, rows.Err()
}

// getDraft scopes on user_id in the WHERE clause, not as a separate
// ownership check after the fact -- a draft belonging to someone else reads
// as not-found, matching decision 7 ("private to their owner") rather than
// leaking that a given id exists at all via a 403 instead of a 404.
func getDraft(ctx context.Context, userID, id string) (*Draft, error) {
	var d Draft
	err := db.Pool.QueryRow(ctx, `
		SELECT id, intent, label, payload, photo_urls, created_at, updated_at
		FROM drafts
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(&d.ID, &d.Intent, &d.Label, &d.Payload, &d.PhotoURLs, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func createDraft(ctx context.Context, userID, intent, label string, payload json.RawMessage, photoURLs []string) (*Draft, error) {
	var d Draft
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO drafts (user_id, intent, label, payload, photo_urls)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, intent, label, payload, photo_urls, created_at, updated_at
	`, userID, intent, label, payload, photoURLs).Scan(&d.ID, &d.Intent, &d.Label, &d.Payload, &d.PhotoURLs, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// updateDraft returns the row's photo_urls as they stood *before* this
// update, alongside the updated row -- UpdateDraft (service.go) diffs old
// against new to find provisional uploads this write just orphaned. Reads
// the previous row inside the same transaction (FOR UPDATE, so a concurrent
// autosave can't read the same "before" snapshot twice) rather than a single
// UPDATE...FROM self-join, which would need its own join condition back to
// the very row it's updating to stay correct. updated_at is set explicitly,
// not left to a trigger -- this schema has none, and every other domain's
// UpdateX sets it the same way.
func updateDraft(ctx context.Context, userID, id, label string, payload json.RawMessage, photoURLs []string) (updated *Draft, previousPhotoURLs []string, err error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)

	if err := tx.QueryRow(ctx, `
		SELECT photo_urls FROM drafts WHERE id = $1 AND user_id = $2 FOR UPDATE
	`, id, userID).Scan(&previousPhotoURLs); err != nil {
		return nil, nil, err
	}

	var d Draft
	if err := tx.QueryRow(ctx, `
		UPDATE drafts SET label = $3, payload = $4, photo_urls = $5, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING id, intent, label, payload, photo_urls, created_at, updated_at
	`, id, userID, label, payload, photoURLs).Scan(&d.ID, &d.Intent, &d.Label, &d.Payload, &d.PhotoURLs, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	return &d, previousPhotoURLs, nil
}

// deleteDraft removes the row and returns the photo_urls it carried, for
// DeleteDraft (service.go) to sweep from Cloudinary -- once the row is gone
// there is nowhere else those URLs are recorded.
func deleteDraft(ctx context.Context, userID, id string) (photoURLs []string, err error) {
	err = db.Pool.QueryRow(ctx, `
		DELETE FROM drafts WHERE id = $1 AND user_id = $2
		RETURNING photo_urls
	`, id, userID).Scan(&photoURLs)
	if err != nil {
		return nil, err
	}
	return photoURLs, nil
}
