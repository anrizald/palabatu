package problems

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// ProblemListItem is the shape returned by GET /problems, matching the
// aliases in palabatu-be/routes/api.ts's SELECT.
type ProblemListItem struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Grade        *string   `json:"grade"`
	LocationName *string   `json:"location_name"`
	Latitude     *float64  `json:"latitude"`
	Longitude    *float64  `json:"longitude"`
	CreatedBy    *string   `json:"created_by"`
	ImageURLs    []string  `json:"image_urls"`
	CreatorName  *string   `json:"creator_name"`
	CreatorSlug  *string   `json:"creator_slug"`
	SendCount    int       `json:"send_count"`
	CreatedAt    time.Time `json:"created_at"`
}

// ProblemSummary is the shape returned by POST /problems's RETURNING clause.
type ProblemSummary struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Grade        *string  `json:"grade"`
	LocationName *string  `json:"location_name"`
	Latitude     *float64 `json:"latitude"`
	Longitude    *float64 `json:"longitude"`
}

// ProblemRow is the shape returned by PUT /problems/:id's RETURNING *,
// which (unlike the other two) uses the raw column names.
type ProblemRow struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Grade     *string   `json:"grade"`
	Location  *string   `json:"location"`
	Lat       *float64  `json:"lat"`
	Lng       *float64  `json:"lng"`
	CreatedBy *string   `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	ImageURLs []string  `json:"image_urls"`
}

// ProblemDetail is the shape returned by GET /problems/:id — ProblemListItem
// plus created_at, for the single-problem detail page.
type ProblemDetail struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Grade        *string   `json:"grade"`
	LocationName *string   `json:"location_name"`
	Latitude     *float64  `json:"latitude"`
	Longitude    *float64  `json:"longitude"`
	CreatedBy    *string   `json:"created_by"`
	ImageURLs    []string  `json:"image_urls"`
	CreatorName  *string   `json:"creator_name"`
	CreatorSlug  *string   `json:"creator_slug"`
	SendCount    int       `json:"send_count"`
	CreatedAt    time.Time `json:"created_at"`
}

func listProblems(ctx context.Context) ([]ProblemListItem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			p.id,
			p.name,
			p.grade,
			p.location AS location_name,
			p.lat AS latitude,
			p.lng AS longitude,
			p.created_by,
			p.image_urls,
			pr.username AS creator_name,
			u.slug AS creator_slug,
			COALESCE((SELECT COUNT(*) FROM sends WHERE problem_id = p.id), 0)::int AS send_count,
			p.created_at
		FROM problems p
		LEFT JOIN profiles pr ON p.created_by = pr.id
		LEFT JOIN users u ON p.created_by = u.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	problems := []ProblemListItem{}
	for rows.Next() {
		var p ProblemListItem
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Grade, &p.LocationName, &p.Latitude, &p.Longitude,
			&p.CreatedBy, &p.ImageURLs, &p.CreatorName, &p.CreatorSlug, &p.SendCount, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		problems = append(problems, p)
	}
	return problems, rows.Err()
}

func getProblem(ctx context.Context, id string) (*ProblemDetail, error) {
	var p ProblemDetail
	err := db.Pool.QueryRow(ctx, `
		SELECT
			p.id,
			p.name,
			p.grade,
			p.location AS location_name,
			p.lat AS latitude,
			p.lng AS longitude,
			p.created_by,
			p.image_urls,
			pr.username AS creator_name,
			u.slug AS creator_slug,
			p.created_at,
			COALESCE((SELECT COUNT(*) FROM sends WHERE problem_id = p.id), 0)::int AS send_count
		FROM problems p
		LEFT JOIN profiles pr ON p.created_by = pr.id
		LEFT JOIN users u ON p.created_by = u.id
		WHERE p.id = $1
	`, id).Scan(
		&p.ID, &p.Name, &p.Grade, &p.LocationName, &p.Latitude, &p.Longitude,
		&p.CreatedBy, &p.ImageURLs, &p.CreatorName, &p.CreatorSlug, &p.CreatedAt, &p.SendCount,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func createProblem(ctx context.Context, name, grade, location string, lat, lng float64, createdBy string, imageURLs []string) (*ProblemSummary, error) {
	imageURLsJSON, err := json.Marshal(imageURLs)
	if err != nil {
		return nil, err
	}

	var p ProblemSummary
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO problems (name, grade, location, lat, lng, created_by, image_urls)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
		 RETURNING id, name, grade, location AS location_name, lat AS latitude, lng AS longitude`,
		name, grade, location, lat, lng, createdBy, string(imageURLsJSON),
	).Scan(&p.ID, &p.Name, &p.Grade, &p.LocationName, &p.Latitude, &p.Longitude)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func getProblemCreator(ctx context.Context, id string) (*string, error) {
	var createdBy *string
	err := db.Pool.QueryRow(ctx, `SELECT created_by FROM problems WHERE id = $1`, id).Scan(&createdBy)
	if err != nil {
		return nil, err
	}
	return createdBy, nil
}

// getProblemOwnerAndImages backs DELETE /problems/:id's authorization check
// and Cloudinary cleanup.
func getProblemOwnerAndImages(ctx context.Context, id string) (createdBy *string, imageURLs []string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_by, image_urls FROM problems WHERE id = $1`, id).Scan(&createdBy, &imageURLs)
	if err != nil {
		return nil, nil, err
	}
	return createdBy, imageURLs, nil
}

func deleteProblemRow(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM problems WHERE id = $1`, id)
	return err
}

// removeProblemImage drops one URL from a problem's image_urls jsonb array.
// The ::text cast disambiguates jsonb's overloaded "-" operator (text /
// integer / text[] operands), which Postgres can't resolve from a bare
// parameter placeholder.
func removeProblemImage(ctx context.Context, id, url string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE problems SET image_urls = image_urls - $2::text WHERE id = $1`, id, url)
	return err
}

func updateProblemRow(ctx context.Context, id, name, grade, locationName string, lat, lng float64) (*ProblemRow, error) {
	var p ProblemRow
	err := db.Pool.QueryRow(ctx,
		`UPDATE problems SET name = $1, grade = $2, location = $3, lat = $4, lng = $5 WHERE id = $6
		 RETURNING id, name, grade, location, lat, lng, created_by, created_at, image_urls`,
		name, grade, locationName, lat, lng, id,
	).Scan(&p.ID, &p.Name, &p.Grade, &p.Location, &p.Lat, &p.Lng, &p.CreatedBy, &p.CreatedAt, &p.ImageURLs)
	if err != nil {
		return nil, err
	}
	return &p, nil
}
