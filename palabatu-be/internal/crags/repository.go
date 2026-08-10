package crags

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// Crag is the place you drive to and park at -- the top level of the
// crags -> boulders -> problems hierarchy (see handoff.md at the repo
// root). Lat/Lng are the approach/parking pin, required (unlike boulders',
// which are optional). ImageURLs is the approach shot -- "park here, the
// trail starts at this tree" -- never annotatable, unlike a boulder's.
type Crag struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Lat         float64   `json:"lat"`
	Lng         float64   `json:"lng"`
	Directions  *string   `json:"directions"`
	AccessNotes *string   `json:"access_notes"`
	ImageURLs   []string  `json:"image_urls"`
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
	ImageURLs    []string  `json:"image_urls"`
	CreatedBy    *string   `json:"created_by"`
	CreatorName  *string   `json:"creator_name"`
	BoulderCount int       `json:"boulder_count"`
	ProblemCount int       `json:"problem_count"`
	CreatedAt    time.Time `json:"created_at"`
}

const cragListSelect = `
	SELECT
		c.id, c.name, c.lat, c.lng, c.directions, c.access_notes, c.image_urls,
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
			&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.ImageURLs,
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
		&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.ImageURLs,
		&c.CreatedBy, &c.CreatorName, &c.BoulderCount, &c.ProblemCount, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func createCrag(ctx context.Context, name string, lat, lng float64, directions, accessNotes string, imageURLs []string, createdBy string) (*Crag, error) {
	if imageURLs == nil {
		imageURLs = []string{}
	}
	imageURLsJSON, err := json.Marshal(imageURLs)
	if err != nil {
		return nil, err
	}

	var c Crag
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO crags (name, lat, lng, directions, access_notes, image_urls, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
		 RETURNING id, name, lat, lng, directions, access_notes, image_urls, created_by, created_at`,
		name, lat, lng, directions, accessNotes, string(imageURLsJSON), createdBy,
	).Scan(&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.ImageURLs, &c.CreatedBy, &c.CreatedAt)
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

// getCragOwnerAndImages backs DeleteCragImage's authorization check and
// Cloudinary cleanup, mirroring boulders.getBoulderOwnerAndImages.
func getCragOwnerAndImages(ctx context.Context, id string) (createdBy *string, imageURLs []string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_by, image_urls FROM crags WHERE id = $1`, id).Scan(&createdBy, &imageURLs)
	if err != nil {
		return nil, nil, err
	}
	return createdBy, imageURLs, nil
}

func updateCragRow(ctx context.Context, id, name string, lat, lng float64, directions, accessNotes string) (*Crag, error) {
	var c Crag
	err := db.Pool.QueryRow(ctx,
		`UPDATE crags SET name = $1, lat = $2, lng = $3, directions = $4, access_notes = $5 WHERE id = $6
		 RETURNING id, name, lat, lng, directions, access_notes, image_urls, created_by, created_at`,
		name, lat, lng, directions, accessNotes, id,
	).Scan(&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.ImageURLs, &c.CreatedBy, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// addCragImages appends newURLs to a crag's image_urls jsonb array -- same
// `|| $2::jsonb` pattern as boulders.addBoulderImages.
func addCragImages(ctx context.Context, id string, newURLs []string) (*Crag, error) {
	newURLsJSON, err := json.Marshal(newURLs)
	if err != nil {
		return nil, err
	}

	var c Crag
	err = db.Pool.QueryRow(ctx,
		`UPDATE crags SET image_urls = image_urls || $2::jsonb WHERE id = $1
		 RETURNING id, name, lat, lng, directions, access_notes, image_urls, created_by, created_at`,
		id, string(newURLsJSON),
	).Scan(&c.ID, &c.Name, &c.Lat, &c.Lng, &c.Directions, &c.AccessNotes, &c.ImageURLs, &c.CreatedBy, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// removeCragImage drops one URL from a crag's image_urls jsonb array. The
// ::text cast disambiguates jsonb's overloaded "-" operator, same as
// boulders.removeBoulderImage.
func removeCragImage(ctx context.Context, id, url string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE crags SET image_urls = image_urls - $2::text WHERE id = $1`, id, url)
	return err
}
