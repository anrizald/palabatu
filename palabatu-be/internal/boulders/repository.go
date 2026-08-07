package boulders

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// Boulder is one rock at a crag -- the middle level of the crags ->
// boulders -> problems hierarchy (see handoff.md at the repo root). It owns
// the photo(s) climbers draw their lines on; every problem on it shares the
// same image set.
type Boulder struct {
	ID         string    `json:"id"`
	CragID     string    `json:"crag_id"`
	Name       *string   `json:"name"`
	ImageURLs  []string  `json:"image_urls"`
	RockType   *string   `json:"rock_type"`
	Lat        *float64  `json:"lat"`
	Lng        *float64  `json:"lng"`
	MergedInto *string   `json:"merged_into"`
	CreatedBy  *string   `json:"created_by"`
	CreatedAt  time.Time `json:"created_at"`
}

// BoulderListItem is the shape returned by GET /crags/:cragId/boulders and
// GET /boulders/:id -- Boulder plus a creator name and how many problems
// are on it, so the future photo-grid boulder picker and the dimmed
// empty-boulder state (handoff.md open item 1) don't need a second
// round-trip.
type BoulderListItem struct {
	ID           string    `json:"id"`
	CragID       string    `json:"crag_id"`
	Name         *string   `json:"name"`
	ImageURLs    []string  `json:"image_urls"`
	RockType     *string   `json:"rock_type"`
	Lat          *float64  `json:"lat"`
	Lng          *float64  `json:"lng"`
	MergedInto   *string   `json:"merged_into"`
	CreatedBy    *string   `json:"created_by"`
	CreatorName  *string   `json:"creator_name"`
	ProblemCount int       `json:"problem_count"`
	CreatedAt    time.Time `json:"created_at"`
}

const boulderListSelect = `
	SELECT
		b.id, b.crag_id, b.name, b.image_urls, b.rock_type, b.lat, b.lng,
		b.merged_into, b.created_by, pr.username AS creator_name,
		COALESCE((SELECT COUNT(*) FROM problems WHERE boulder_id = b.id), 0)::int AS problem_count,
		b.created_at
	FROM boulders b
	LEFT JOIN profiles pr ON b.created_by = pr.id
`

func listBoulders(ctx context.Context, cragID string) ([]BoulderListItem, error) {
	rows, err := db.Pool.Query(ctx, boulderListSelect+" WHERE b.crag_id = $1", cragID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	boulders := []BoulderListItem{}
	for rows.Next() {
		var b BoulderListItem
		if err := rows.Scan(
			&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.RockType, &b.Lat, &b.Lng,
			&b.MergedInto, &b.CreatedBy, &b.CreatorName, &b.ProblemCount, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		boulders = append(boulders, b)
	}
	return boulders, rows.Err()
}

func getBoulder(ctx context.Context, id string) (*BoulderListItem, error) {
	var b BoulderListItem
	err := db.Pool.QueryRow(ctx, boulderListSelect+" WHERE b.id = $1", id).Scan(
		&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.RockType, &b.Lat, &b.Lng,
		&b.MergedInto, &b.CreatedBy, &b.CreatorName, &b.ProblemCount, &b.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func createBoulder(ctx context.Context, cragID, name, rockType string, lat, lng *float64, imageURLs []string, createdBy string) (*Boulder, error) {
	if imageURLs == nil {
		imageURLs = []string{}
	}
	imageURLsJSON, err := json.Marshal(imageURLs)
	if err != nil {
		return nil, err
	}

	var b Boulder
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO boulders (crag_id, name, image_urls, rock_type, lat, lng, created_by)
		 VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
		 RETURNING id, crag_id, name, image_urls, rock_type, lat, lng, merged_into, created_by, created_at`,
		cragID, name, string(imageURLsJSON), rockType, lat, lng, createdBy,
	).Scan(&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.RockType, &b.Lat, &b.Lng, &b.MergedInto, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func getBoulderCreator(ctx context.Context, id string) (*string, error) {
	var createdBy *string
	err := db.Pool.QueryRow(ctx, `SELECT created_by FROM boulders WHERE id = $1`, id).Scan(&createdBy)
	if err != nil {
		return nil, err
	}
	return createdBy, nil
}

// getBoulderOwnerAndImages backs DeleteBoulderImage's authorization check
// and Cloudinary cleanup.
func getBoulderOwnerAndImages(ctx context.Context, id string) (createdBy *string, imageURLs []string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_by, image_urls FROM boulders WHERE id = $1`, id).Scan(&createdBy, &imageURLs)
	if err != nil {
		return nil, nil, err
	}
	return createdBy, imageURLs, nil
}

func updateBoulderRow(ctx context.Context, id, name, rockType string, lat, lng *float64) (*Boulder, error) {
	var b Boulder
	err := db.Pool.QueryRow(ctx,
		`UPDATE boulders SET name = $1, rock_type = $2, lat = $3, lng = $4 WHERE id = $5
		 RETURNING id, crag_id, name, image_urls, rock_type, lat, lng, merged_into, created_by, created_at`,
		name, rockType, lat, lng, id,
	).Scan(&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.RockType, &b.Lat, &b.Lng, &b.MergedInto, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// addBoulderImages appends newURLs to a boulder's image_urls jsonb array --
// same `|| $2::jsonb` pattern as problems.addProblemImages did before the
// photo ownership move.
func addBoulderImages(ctx context.Context, id string, newURLs []string) (*Boulder, error) {
	newURLsJSON, err := json.Marshal(newURLs)
	if err != nil {
		return nil, err
	}

	var b Boulder
	err = db.Pool.QueryRow(ctx,
		`UPDATE boulders SET image_urls = image_urls || $2::jsonb WHERE id = $1
		 RETURNING id, crag_id, name, image_urls, rock_type, lat, lng, merged_into, created_by, created_at`,
		id, string(newURLsJSON),
	).Scan(&b.ID, &b.CragID, &b.Name, &b.ImageURLs, &b.RockType, &b.Lat, &b.Lng, &b.MergedInto, &b.CreatedBy, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// removeBoulderImage drops one URL from a boulder's image_urls jsonb array.
// The ::text cast disambiguates jsonb's overloaded "-" operator, same
// reasoning as problems.removeProblemImage had before the photo ownership
// move.
func removeBoulderImage(ctx context.Context, id, url string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE boulders SET image_urls = image_urls - $2::text WHERE id = $1`, id, url)
	return err
}

// deleteAnnotationsForImage removes every problem-on-this-boulder's
// annotation on a (now-removed) image -- direct SQL against
// problems/topo_annotations rather than importing internal/problems, same
// one-way-dependency shape as devtools' cross-domain table reads (problems
// imports nothing from boulders' Go package either -- see internal/problems
// for the mirror image of this).
func deleteAnnotationsForImage(ctx context.Context, boulderID, imageURL string) error {
	_, err := db.Pool.Exec(ctx, `
		DELETE FROM topo_annotations
		WHERE image_url = $2 AND problem_id IN (SELECT id FROM problems WHERE boulder_id = $1)
	`, boulderID, imageURL)
	return err
}

// BoulderAnnotation mirrors problems.AnnotationRecord's shape -- duplicated
// rather than imported (same one-way-dependency reasoning as above).
type BoulderAnnotation struct {
	ID        string          `json:"id"`
	ProblemID string          `json:"problem_id"`
	ImageURL  string          `json:"image_url"`
	Data      json.RawMessage `json:"data"`
	UpdatedBy *string         `json:"updated_by"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// listAnnotationsForBoulder returns every problem-on-this-boulder's
// annotation row together, so a boulder's photo can be rendered with every
// problem's line on it at once (handoff.md decision 2: "one photo, N
// lines").
func listAnnotationsForBoulder(ctx context.Context, boulderID string) ([]BoulderAnnotation, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT ta.id, ta.problem_id, ta.image_url, ta.data, ta.updated_by, ta.created_at, ta.updated_at
		FROM topo_annotations ta
		JOIN problems p ON p.id = ta.problem_id
		WHERE p.boulder_id = $1
	`, boulderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	annotations := []BoulderAnnotation{}
	for rows.Next() {
		var a BoulderAnnotation
		if err := rows.Scan(&a.ID, &a.ProblemID, &a.ImageURL, &a.Data, &a.UpdatedBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		annotations = append(annotations, a)
	}
	return annotations, rows.Err()
}

// problemCreatorsOnBoulder backs the merge-suggested notification fan-out
// (merge.go) -- every distinct creator of a problem on the given boulder.
func problemCreatorsOnBoulder(ctx context.Context, boulderID string) ([]string, error) {
	rows, err := db.Pool.Query(ctx, `SELECT DISTINCT created_by FROM problems WHERE boulder_id = $1 AND created_by IS NOT NULL`, boulderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
