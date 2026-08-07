package crags

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

// Crag is the place you drive to and park at -- the top level of the
// crags -> boulders -> problems hierarchy (see handoff.md at the repo
// root). Lat/Lng are the approach/parking pin, required (unlike boulders',
// which are optional).
type Crag struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Lat         float64   `json:"lat"`
	Lng         float64   `json:"lng"`
	Directions  *string   `json:"directions"`
	AccessNotes *string   `json:"access_notes"`
	CreatedBy   *string   `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

// CragListItem is the shape returned by GET /crags and GET /crags/:id.
// BoulderCount/ProblemCount let a future frontend render the dimmed
// empty-crag state (handoff.md open item 1) without a second round-trip.
type CragListItem struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Lat          float64   `json:"lat"`
	Lng          float64   `json:"lng"`
	Directions   *string   `json:"directions"`
	AccessNotes  *string   `json:"access_notes"`
	CreatedBy    *string   `json:"created_by"`
	CreatorName  *string   `json:"creator_name"`
	BoulderCount int       `json:"boulder_count"`
	ProblemCount int       `json:"problem_count"`
	CreatedAt    time.Time `json:"created_at"`
}

const cragListSelect = `
	SELECT
		c.id, c.name, c.lat, c.lng, c.directions, c.access_notes,
		c.created_by, pr.username AS creator_name,
		COALESCE((SELECT COUNT(*) FROM boulders WHERE crag_id = c.id), 0)::int AS boulder_count,
		COALESCE((SELECT COUNT(*) FROM problems WHERE crag_id = c.id), 0)::int AS problem_count,
		c.created_at
	FROM crags c
	LEFT JOIN profiles pr ON c.created_by = pr.id
`

func listCrags(ctx context.Context) ([]CragListItem, error) {
	rows, err := db.Pool.Query(ctx, cragListSelect)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	crags := []CragListItem{}
	for rows.Next() {
		var c CragListItem
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes,
			&c.CreatedBy, &c.CreatorName, &c.BoulderCount, &c.ProblemCount, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		crags = append(crags, c)
	}
	return crags, rows.Err()
}

func getCrag(ctx context.Context, id string) (*CragListItem, error) {
	var c CragListItem
	err := db.Pool.QueryRow(ctx, cragListSelect+" WHERE c.id = $1", id).Scan(
		&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes,
		&c.CreatedBy, &c.CreatorName, &c.BoulderCount, &c.ProblemCount, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func createCrag(ctx context.Context, name string, lat, lng float64, directions, accessNotes, createdBy string) (*Crag, error) {
	var c Crag
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO crags (name, lat, lng, directions, access_notes, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, name, lat, lng, directions, access_notes, created_by, created_at`,
		name, lat, lng, directions, accessNotes, createdBy,
	).Scan(&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.CreatedBy, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func getCragCreator(ctx context.Context, id string) (*string, error) {
	var createdBy *string
	err := db.Pool.QueryRow(ctx, `SELECT created_by FROM crags WHERE id = $1`, id).Scan(&createdBy)
	if err != nil {
		return nil, err
	}
	return createdBy, nil
}

func updateCragRow(ctx context.Context, id, name string, lat, lng float64, directions, accessNotes string) (*Crag, error) {
	var c Crag
	err := db.Pool.QueryRow(ctx,
		`UPDATE crags SET name = $1, lat = $2, lng = $3, directions = $4, access_notes = $5 WHERE id = $6
		 RETURNING id, name, lat, lng, directions, access_notes, created_by, created_at`,
		name, lat, lng, directions, accessNotes, id,
	).Scan(&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.CreatedBy, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
