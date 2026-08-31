package problems

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"palabatu-be/internal/db"
)

// ProblemListItem is the shape returned by GET /problems. CragID/BoulderID
// are the crags -> boulders -> problems hierarchy (see handoff.md at the
// repo root); CragID is denormalized directly onto problems (also
// reachable via boulder_id -> boulders.crag_id) since every hot
// list/filter/map query wants it without a two-hop join. FirstAscensionist
// through Notes are the optional fields from handoff.md decisions 8-10.
// BoulderType/TopoURL/TopoLine are handoff-directory.md's tier 1: the rock's
// type (authoritative, unlike guessing boulder-vs-wall from the grade
// string — finding 4), its first photo (what palabatu-fe's cragCache.ts
// used to fetch via a per-crag fan-out just to resolve a thumbnail), and
// this problem's own drawn line on that photo, if any (decision 3) — nil
// when nothing's been drawn, not distinguished from an empty-array
// annotation (TopoAnnotationOverlay renders nothing for zero shapes
// either way, so the two aren't worth telling apart on the wire).
// TopoLine is passed through opaquely like auth.Profile.Title/.Tags --
// deliberately no swaggertype tag, matching that precedent: swag v2.0.0-rc5
// renders an untagged json.RawMessage as "array of integer" (it sees the
// underlying []byte), which is a known cosmetic-only mismatch, not the
// real shape; a `swaggertype:"array,object"` tag was tried to fix that
// display but crashes swag's v3.1 field parser with a nil pointer
// dereference inside complementSchema, so it's deliberately omitted.
type ProblemListItem struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Grade             *string         `json:"grade"`
	CragID            string          `json:"crag_id"`
	CragName          *string         `json:"crag_name"`
	BoulderID         string          `json:"boulder_id"`
	BoulderName       *string         `json:"boulder_name"`
	BoulderType       string          `json:"boulder_type"`
	TopoURL           *string         `json:"topo_url"`
	TopoLine          json.RawMessage `json:"topo_line"`
	FirstAscensionist *string         `json:"first_ascensionist"`
	DiscoveredBy      *string         `json:"discovered_by"`
	LandingHazards    *string         `json:"landing_hazards"`
	Descent           *string         `json:"descent"`
	HeightM           *float64        `json:"height_m"`
	Notes             *string         `json:"notes"`
	ImageURLs         []string        `json:"image_urls"`
	CreatedBy         *string         `json:"created_by"`
	CreatorName       *string         `json:"creator_name"`
	CreatorSlug       *string         `json:"creator_slug"`
	SendCount         int             `json:"send_count"`
	CreatedAt         time.Time       `json:"created_at"`
}

// ProblemSummary is the shape returned by POST /problems's RETURNING clause.
type ProblemSummary struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Grade     *string  `json:"grade"`
	CragID    string   `json:"crag_id"`
	BoulderID string   `json:"boulder_id"`
	ImageURLs []string `json:"image_urls"`
}

// ProblemRow is the shape returned by PUT /problems/:id's RETURNING *.
type ProblemRow struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Grade             *string   `json:"grade"`
	CragID            string    `json:"crag_id"`
	BoulderID         string    `json:"boulder_id"`
	FirstAscensionist *string   `json:"first_ascensionist"`
	DiscoveredBy      *string   `json:"discovered_by"`
	LandingHazards    *string   `json:"landing_hazards"`
	Descent           *string   `json:"descent"`
	HeightM           *float64  `json:"height_m"`
	Notes             *string   `json:"notes"`
	ImageURLs         []string  `json:"image_urls"`
	CreatedBy         *string   `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
}

// ProblemDetail is the shape returned by GET /problems/:id -- same field
// set as ProblemListItem, including tier 1's BoulderType/TopoURL/TopoLine
// (see that struct's doc comment).
type ProblemDetail struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Grade             *string         `json:"grade"`
	CragID            string          `json:"crag_id"`
	CragName          *string         `json:"crag_name"`
	BoulderID         string          `json:"boulder_id"`
	BoulderName       *string         `json:"boulder_name"`
	BoulderType       string          `json:"boulder_type"`
	TopoURL           *string         `json:"topo_url"`
	TopoLine          json.RawMessage `json:"topo_line"`
	FirstAscensionist *string         `json:"first_ascensionist"`
	DiscoveredBy      *string         `json:"discovered_by"`
	LandingHazards    *string         `json:"landing_hazards"`
	Descent           *string         `json:"descent"`
	HeightM           *float64        `json:"height_m"`
	Notes             *string         `json:"notes"`
	ImageURLs         []string        `json:"image_urls"`
	CreatedBy         *string         `json:"created_by"`
	CreatorName       *string         `json:"creator_name"`
	CreatorSlug       *string         `json:"creator_slug"`
	SendCount         int             `json:"send_count"`
	CreatedAt         time.Time       `json:"created_at"`
}

const problemListSelect = `
	SELECT
		p.id, p.name, p.grade, p.crag_id, c.name AS crag_name, p.boulder_id, b.name AS boulder_name,
		b.type AS boulder_type, b.image_urls->>0 AS topo_url,
		(SELECT ta.data FROM topo_annotations ta WHERE ta.problem_id = p.id AND ta.image_url = b.image_urls->>0) AS topo_line,
		p.first_ascensionist, p.discovered_by, p.landing_hazards, p.descent, p.height_m, p.notes, p.image_urls,
		p.created_by, pr.username AS creator_name, u.slug AS creator_slug,
		COALESCE((SELECT COUNT(*) FROM sends WHERE problem_id = p.id), 0)::int AS send_count,
		p.created_at
	FROM problems p
	JOIN crags c ON p.crag_id = c.id
	JOIN boulders b ON p.boulder_id = b.id
	LEFT JOIN profiles pr ON p.created_by = pr.id
	LEFT JOIN users u ON p.created_by = u.id
`

// listProblems optionally filters to one crag and/or one boulder (empty
// string = no filter) -- the real-join replacement for the free-text
// location_name grouping the frontend used to do client-side.
func listProblems(ctx context.Context, cragID, boulderID string) ([]ProblemListItem, error) {
	query := problemListSelect
	var args []any
	var conditions []string
	if cragID != "" {
		args = append(args, cragID)
		conditions = append(conditions, fmt.Sprintf("p.crag_id = $%d", len(args)))
	}
	if boulderID != "" {
		args = append(args, boulderID)
		conditions = append(conditions, fmt.Sprintf("p.boulder_id = $%d", len(args)))
	}
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	problems := []ProblemListItem{}
	for rows.Next() {
		var p ProblemListItem
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Grade, &p.CragID, &p.CragName, &p.BoulderID, &p.BoulderName,
			&p.BoulderType, &p.TopoURL, &p.TopoLine,
			&p.FirstAscensionist, &p.DiscoveredBy, &p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.ImageURLs,
			&p.CreatedBy, &p.CreatorName, &p.CreatorSlug, &p.SendCount, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		problems = append(problems, p)
	}
	return problems, rows.Err()
}

func getProblem(ctx context.Context, id string) (*ProblemDetail, error) {
	var p ProblemDetail
	err := db.Pool.QueryRow(ctx, problemListSelect+" WHERE p.id = $1", id).Scan(
		&p.ID, &p.Name, &p.Grade, &p.CragID, &p.CragName, &p.BoulderID, &p.BoulderName,
		&p.BoulderType, &p.TopoURL, &p.TopoLine,
		&p.FirstAscensionist, &p.DiscoveredBy, &p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.ImageURLs,
		&p.CreatedBy, &p.CreatorName, &p.CreatorSlug, &p.SendCount, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// getBoulderCragID resolves a boulder to the crag it belongs to, so
// CreateProblem can denormalize crag_id onto the new problem without
// trusting a client-supplied value. A direct SQL read against the
// boulders table, not a Go import of internal/boulders -- see that
// package's dependency-direction note.
func getBoulderCragID(ctx context.Context, boulderID string) (string, error) {
	var cragID string
	err := db.Pool.QueryRow(ctx, `SELECT crag_id FROM boulders WHERE id = $1`, boulderID).Scan(&cragID)
	return cragID, err
}

func createProblem(
	ctx context.Context,
	name, grade, boulderID, cragID, firstAscensionist, discoveredBy, landingHazards, descent, notes string,
	heightM *float64,
	imageURLs []string,
	createdBy string,
) (*ProblemSummary, error) {
	if imageURLs == nil {
		imageURLs = []string{}
	}
	imageURLsJSON, err := json.Marshal(imageURLs)
	if err != nil {
		return nil, err
	}

	var p ProblemSummary
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO problems (
			name, grade, boulder_id, crag_id, first_ascensionist, discovered_by,
			landing_hazards, descent, height_m, notes, image_urls, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
		 RETURNING id, name, grade, crag_id, boulder_id, image_urls`,
		name, grade, boulderID, cragID, firstAscensionist, discoveredBy, landingHazards, descent, heightM, notes, string(imageURLsJSON), createdBy,
	).Scan(&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.ImageURLs)
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

// getProblemOwnerAndBoulder backs UpdateProblem's re-parent check -- the
// problem's current boulder_id, so the service layer can tell whether a
// non-empty BoulderID in the request is actually a change.
func getProblemOwnerAndBoulder(ctx context.Context, id string) (createdBy *string, boulderID string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_by, boulder_id FROM problems WHERE id = $1`, id).Scan(&createdBy, &boulderID)
	if err != nil {
		return nil, "", err
	}
	return createdBy, boulderID, nil
}

// getProblemOwnerAndImages backs AddProblemImages/DeleteProblemImage's
// authorization check, mirroring boulders.getBoulderOwnerAndImages.
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

// reparentProblem moves a problem to a different boulder, resolving the new
// boulder's crag_id (denormalized onto problems -- see getBoulderCragID)
// and dropping every annotation this problem had, since a line drawn on the
// old rock's photo means nothing on the new one (handoff.md decision 13:
// "dropping them is acceptable; silently keeping a line pointed at a photo
// of a different rock is not"). One transaction. The new boulder's
// existence is enforced by problems_boulder_id_fkey -- callers translate
// that violation to ErrBoulderNotFound, same pattern as createProblem.
func reparentProblem(ctx context.Context, id, newBoulderID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var newCragID string
	if err := tx.QueryRow(ctx, `SELECT crag_id FROM boulders WHERE id = $1`, newBoulderID).Scan(&newCragID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE problems SET boulder_id = $1, crag_id = $2 WHERE id = $3`, newBoulderID, newCragID, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM topo_annotations WHERE problem_id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func updateProblemRow(
	ctx context.Context,
	id, name, grade, firstAscensionist, discoveredBy, landingHazards, descent, notes string,
	heightM *float64,
) (*ProblemRow, error) {
	var p ProblemRow
	err := db.Pool.QueryRow(ctx,
		`UPDATE problems SET
			name = $1, grade = $2, first_ascensionist = $3, discovered_by = $4,
			landing_hazards = $5, descent = $6, height_m = $7, notes = $8
		 WHERE id = $9
		 RETURNING id, name, grade, crag_id, boulder_id, first_ascensionist, discovered_by,
			landing_hazards, descent, height_m, notes, image_urls, created_by, created_at`,
		name, grade, firstAscensionist, discoveredBy, landingHazards, descent, heightM, notes, id,
	).Scan(
		&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.FirstAscensionist, &p.DiscoveredBy,
		&p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.ImageURLs, &p.CreatedBy, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// addProblemImages appends newURLs to a problem's image_urls jsonb array --
// same `|| $2::jsonb` pattern as boulders.addBoulderImages.
func addProblemImages(ctx context.Context, id string, newURLs []string) (*ProblemRow, error) {
	newURLsJSON, err := json.Marshal(newURLs)
	if err != nil {
		return nil, err
	}

	var p ProblemRow
	err = db.Pool.QueryRow(ctx,
		`UPDATE problems SET image_urls = image_urls || $2::jsonb WHERE id = $1
		 RETURNING id, name, grade, crag_id, boulder_id, first_ascensionist, discovered_by,
			landing_hazards, descent, height_m, notes, image_urls, created_by, created_at`,
		id, string(newURLsJSON),
	).Scan(
		&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.FirstAscensionist, &p.DiscoveredBy,
		&p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.ImageURLs, &p.CreatedBy, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// removeProblemImage drops one URL from a problem's image_urls jsonb array.
// The ::text cast disambiguates jsonb's overloaded "-" operator, same as
// boulders.removeBoulderImage.
func removeProblemImage(ctx context.Context, id, url string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE problems SET image_urls = image_urls - $2::text WHERE id = $1`, id, url)
	return err
}
