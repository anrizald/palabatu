package problems

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

// maxAnnotationBytes bounds freehand point-array abuse without a full
// per-shape schema check — see SaveAnnotation's validation-depth note.
const maxAnnotationBytes = 200 * 1024

func ListAnnotations(ctx context.Context, problemID string) ([]AnnotationRecord, error) {
	if _, err := GetProblem(ctx, problemID); err != nil {
		return nil, err
	}
	return listAnnotations(ctx, problemID)
}

// SaveAnnotation authorizes (Founder or admin, same rule as any other
// problem edit) and upserts the annotation for one of the problem's images.
// Validation is deliberately light — well-formed JSON array under a size
// cap, not a per-shape schema check — matching the Tags/Title opaque
// passthrough precedent in internal/auth; the write surface is already
// gated to owner/admin only.
func SaveAnnotation(ctx context.Context, userID, problemID, imageURL string, data json.RawMessage) (*AnnotationRecord, error) {
	if len(data) > maxAnnotationBytes || !json.Valid(data) {
		return nil, ErrInvalidAnnotation
	}
	var probe []json.RawMessage
	if err := json.Unmarshal(data, &probe); err != nil {
		return nil, ErrInvalidAnnotation
	}

	createdBy, imageURLs, err := getProblemOwnerAndImages(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	found := false
	for _, u := range imageURLs {
		if u == imageURL {
			found = true
			break
		}
	}
	if !found {
		return nil, ErrImageNotFound
	}

	return upsertAnnotation(ctx, problemID, imageURL, data, userID)
}
