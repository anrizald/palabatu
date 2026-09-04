package problems

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// AnnotationRecord is one problem topo-image's vector route annotation
// (freehand pen strokes + circles). Data is passed through opaquely as
// json.RawMessage — the shape (strokes/circles, normalized coordinates) is
// frontend-defined, same precedent as auth.Profile.Title/.Tags.
type AnnotationRecord struct {
	ID        string          `json:"id"`
	ProblemID string          `json:"problem_id"`
	ImageURL  string          `json:"image_url"`
	Data      json.RawMessage `json:"data"`
	UpdatedBy *string         `json:"updated_by"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func listAnnotations(ctx context.Context, problemID string) ([]AnnotationRecord, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, problem_id, image_url, data, updated_by, created_at, updated_at
		FROM topo_annotations
		WHERE problem_id = $1
	`, problemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	annotations := []AnnotationRecord{}
	for rows.Next() {
		var a AnnotationRecord
		if err := rows.Scan(&a.ID, &a.ProblemID, &a.ImageURL, &a.Data, &a.UpdatedBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		annotations = append(annotations, a)
	}
	return annotations, rows.Err()
}

// upsertAnnotation inserts or replaces the single annotation row for
// (problemID, imageURL), mirroring auth.upsertProfileRow's exact
// INSERT ... ON CONFLICT DO UPDATE ... ::jsonb pattern.
func upsertAnnotation(ctx context.Context, problemID, imageURL string, data json.RawMessage, updatedBy string) (*AnnotationRecord, error) {
	var a AnnotationRecord
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO topo_annotations (problem_id, image_url, data, updated_by)
		 VALUES ($1, $2, $3::jsonb, $4)
		 ON CONFLICT (problem_id, image_url) DO UPDATE SET data = $3::jsonb, updated_by = $4, updated_at = now()
		 RETURNING id, problem_id, image_url, data, updated_by, created_at, updated_at`,
		problemID, imageURL, string(data), updatedBy,
	).Scan(&a.ID, &a.ProblemID, &a.ImageURL, &a.Data, &a.UpdatedBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func deleteAnnotationForImage(ctx context.Context, problemID, imageURL string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM topo_annotations WHERE problem_id = $1 AND image_url = $2`, problemID, imageURL)
	return err
}

// getProblemOwnerAndBoulderImages backs SaveAnnotation's authorization and
// image-membership checks. The image set now lives on the problem's
// boulder, not the problem itself (handoff.md decision 2) -- a direct SQL
// join against boulders, not a Go import of internal/boulders (see that
// package's dependency-direction note).
func getProblemOwnerAndBoulderImages(ctx context.Context, id string) (createdBy *string, imageURLs []string, err error) {
	err = db.Pool.QueryRow(ctx, `
		SELECT p.created_by, b.image_urls
		FROM problems p
		JOIN boulders b ON b.id = p.boulder_id
		WHERE p.id = $1
	`, id).Scan(&createdBy, &imageURLs)
	if err != nil {
		return nil, nil, err
	}
	return createdBy, imageURLs, nil
}
