package problems

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/db"
	"palabatu-be/internal/photocredits"
)

// ProblemListItem is the shape returned by GET /problems. CragID/BoulderID
// are the crags -> boulders -> problems hierarchy (see handoff.md at the
// repo root); CragID is denormalized directly onto problems (also
// reachable via boulder_id -> boulders.crag_id) since every hot
// list/filter/map query wants it without a two-hop join. FirstAscensionist
// through Notes are the optional fields from handoff.md decisions 8-10.
// BoulderType/TopoURL/TopoLine are tier 1 additions: the rock's
// type (authoritative, unlike guessing boulder-vs-wall from the grade
// string), its first photo (what palabatu-fe's cragCache.ts
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
	PitchCount        *int            `json:"pitch_count"`
	CommitmentGrade   *string         `json:"commitment_grade"`
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
	PitchCount        *int      `json:"pitch_count"`
	CommitmentGrade   *string   `json:"commitment_grade"`
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
	PitchCount        *int            `json:"pitch_count"`
	CommitmentGrade   *string         `json:"commitment_grade"`
	CreatedBy         *string         `json:"created_by"`
	CreatorName       *string         `json:"creator_name"`
	CreatorSlug       *string         `json:"creator_slug"`
	SendCount         int             `json:"send_count"`
	CreatedAt         time.Time       `json:"created_at"`

	// ImageCredits covers this problem's own beta/action shots only -- the
	// topo photo belongs to the boulder and carries the boulder's credits.
	// Populated by GetProblem only, never by listProblems, hence omitempty.
	// See internal/photocredits for why an absent entry means this problem's
	// own creator rather than an unknown uploader.
	ImageCredits []photocredits.Credit `json:"image_credits,omitempty"`

	// Pitches is the documented part of a multi-pitch route, in order -- empty
	// for a single-pitch one. It need not add up to PitchCount: how much of the
	// route somebody has written down is allowed to lag the claim about it.
	// Populated by GetProblem only, like ImageCredits.
	Pitches []Pitch `json:"pitches"`
}

const problemListSelect = `
	SELECT
		p.id, p.name, p.grade, p.crag_id, c.name AS crag_name, p.boulder_id, b.name AS boulder_name,
		b.type AS boulder_type, b.image_urls->>0 AS topo_url,
		(SELECT ta.data FROM topo_annotations ta WHERE ta.problem_id = p.id AND ta.image_url = b.image_urls->>0) AS topo_line,
		p.first_ascensionist, p.discovered_by, p.landing_hazards, p.descent, p.height_m, p.notes, p.image_urls,
		p.pitch_count, p.commitment_grade,
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
			&p.PitchCount, &p.CommitmentGrade,
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
		&p.PitchCount, &p.CommitmentGrade,
		&p.CreatedBy, &p.CreatorName, &p.CreatorSlug, &p.SendCount, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// getBoulderCragAndType resolves a boulder to the crag it belongs to, so
// CreateProblem can denormalize crag_id onto the new problem without
// trusting a client-supplied value, and to its type, which decides whether
// pitch detail may be written (only a wall takes it). A direct SQL read
// against the boulders table, not a Go import of internal/boulders -- see
// that package's dependency-direction note.
func getBoulderCragAndType(ctx context.Context, boulderID string) (cragID, boulderType string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT crag_id, type FROM boulders WHERE id = $1`, boulderID).Scan(&cragID, &boulderType)
	return cragID, boulderType, err
}

// getBoulderType is getBoulderCragAndType's type alone, for UpdateProblem
// when the route stays where it is.
func getBoulderType(ctx context.Context, boulderID string) (string, error) {
	var boulderType string
	err := db.Pool.QueryRow(ctx, `SELECT type FROM boulders WHERE id = $1`, boulderID).Scan(&boulderType)
	return boulderType, err
}

// listPitches reads a problem's documented pitches in order. Always a non-nil
// slice, so the wire shape is [] rather than null for a route with none.
func listPitches(ctx context.Context, problemID string) ([]Pitch, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT pitch_number, grade, length_m, notes FROM problem_pitches WHERE problem_id = $1 ORDER BY pitch_number`,
		problemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pitches := []Pitch{}
	for rows.Next() {
		var p Pitch
		if err := rows.Scan(&p.PitchNumber, &p.Grade, &p.LengthM, &p.Notes); err != nil {
			return nil, err
		}
		pitches = append(pitches, p)
	}
	return pitches, rows.Err()
}

// replacePitches makes a problem's documented pitches exactly the given set,
// inside the caller's transaction, in one round-trip. An empty set clears them.
// An empty note is written as NULL, so "no note" has one stored form.
func replacePitches(ctx context.Context, tx pgx.Tx, problemID string, pitches []Pitch) error {
	batch := &pgx.Batch{}
	batch.Queue(`DELETE FROM problem_pitches WHERE problem_id = $1`, problemID)
	for _, p := range pitches {
		batch.Queue(
			`INSERT INTO problem_pitches (problem_id, pitch_number, grade, length_m, notes) VALUES ($1, $2, $3, $4, NULLIF($5::text, ''))`,
			problemID, p.PitchNumber, p.Grade, p.LengthM, p.Notes)
	}
	results := tx.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := results.Exec(); err != nil {
			results.Close()
			return err
		}
	}
	return results.Close()
}

func createProblem(ctx context.Context, req CreateProblemRequest, cragID, createdBy string) (*ProblemSummary, error) {
	imageURLs := req.ImageURLs
	if imageURLs == nil {
		imageURLs = []string{}
	}
	imageURLsJSON, err := json.Marshal(imageURLs)
	if err != nil {
		return nil, err
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p ProblemSummary
	err = tx.QueryRow(ctx,
		`INSERT INTO problems (
			name, grade, boulder_id, crag_id, first_ascensionist, discovered_by,
			landing_hazards, descent, height_m, notes, image_urls, created_by,
			pitch_count, commitment_grade
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, NULLIF($14::text, ''))
		 RETURNING id, name, grade, crag_id, boulder_id, image_urls`,
		req.Name, req.Grade, req.BoulderID, cragID, req.FirstAscensionist, req.DiscoveredBy, req.LandingHazards,
		req.Descent, req.HeightM, req.Notes, string(imageURLsJSON), createdBy, req.PitchCount, req.CommitmentGrade,
	).Scan(&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.ImageURLs)
	if err != nil {
		return nil, err
	}
	if len(req.Pitches) > 0 {
		if err := replacePitches(ctx, tx, p.ID, req.Pitches); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
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

// getProblemForUpdate backs UpdateProblem's checks -- the problem's current
// boulder_id, so the service layer can tell whether a non-empty BoulderID in
// the request is actually a change, and its current pitch_count, which
// decides whether pitch rows have a count to hang off when the request leaves
// the count out.
func getProblemForUpdate(ctx context.Context, id string) (createdBy *string, boulderID string, pitchCount *int, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_by, boulder_id, pitch_count FROM problems WHERE id = $1`, id).
		Scan(&createdBy, &boulderID, &pitchCount)
	if err != nil {
		return nil, "", nil, err
	}
	return createdBy, boulderID, pitchCount, nil
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

// updateProblemRow writes only what req carries: COALESCE keeps a column when
// its value is nil, and the height is written only when req.HasHeight says the
// key was sent (so an explicit null still clears it). Doing this in one
// statement rather than reading the row first also leaves an untouched NULL
// column NULL and leaves no window for a concurrent edit to be overwritten.
//
// The pitch count works like the height (written only when HasPitchCount, so
// null clears it) and the commitment grade like the text fields, except that
// an empty string is stored as NULL rather than kept, since its CHECK forbids it.
// The documented pitches are replaced as a set, in the same transaction, only
// when the request carried a Pitches array.
func updateProblemRow(ctx context.Context, id string, req UpdateProblemRequest) (*ProblemRow, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p ProblemRow
	err = tx.QueryRow(ctx,
		`UPDATE problems SET
			name = COALESCE($1, name),
			grade = COALESCE($2, grade),
			first_ascensionist = COALESCE($3, first_ascensionist),
			discovered_by = COALESCE($4, discovered_by),
			landing_hazards = COALESCE($5, landing_hazards),
			descent = COALESCE($6, descent),
			height_m = CASE WHEN $7 THEN $8 ELSE height_m END,
			notes = COALESCE($9, notes),
			pitch_count = CASE WHEN $10 THEN $11 ELSE pitch_count END,
			commitment_grade = CASE WHEN $12::text IS NULL THEN commitment_grade ELSE NULLIF($12, '') END
		 WHERE id = $13
		 RETURNING id, name, grade, crag_id, boulder_id, first_ascensionist, discovered_by,
			landing_hazards, descent, height_m, notes, image_urls, pitch_count, commitment_grade, created_by, created_at`,
		req.Name, req.Grade, req.FirstAscensionist, req.DiscoveredBy, req.LandingHazards, req.Descent,
		req.HasHeight, req.HeightM, req.Notes, req.HasPitchCount, req.PitchCount, req.CommitmentGrade, id,
	).Scan(
		&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.FirstAscensionist, &p.DiscoveredBy,
		&p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.ImageURLs, &p.PitchCount, &p.CommitmentGrade,
		&p.CreatedBy, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if req.Pitches != nil {
		if err := replacePitches(ctx, tx, id, req.Pitches); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
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
			landing_hazards, descent, height_m, notes, image_urls, pitch_count, commitment_grade, created_by, created_at`,
		id, string(newURLsJSON),
	).Scan(
		&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.FirstAscensionist, &p.DiscoveredBy,
		&p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.ImageURLs, &p.PitchCount, &p.CommitmentGrade,
		&p.CreatedBy, &p.CreatedAt,
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
