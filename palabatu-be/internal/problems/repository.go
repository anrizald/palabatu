package problems

import (
	"context"
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
type ProblemListItem struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Grade             *string   `json:"grade"`
	CragID            string    `json:"crag_id"`
	CragName          *string   `json:"crag_name"`
	BoulderID         string    `json:"boulder_id"`
	BoulderName       *string   `json:"boulder_name"`
	FirstAscensionist *string   `json:"first_ascensionist"`
	DiscoveredBy      *string   `json:"discovered_by"`
	LandingHazards    *string   `json:"landing_hazards"`
	Descent           *string   `json:"descent"`
	HeightM           *float64  `json:"height_m"`
	Notes             *string   `json:"notes"`
	CreatedBy         *string   `json:"created_by"`
	CreatorName       *string   `json:"creator_name"`
	CreatorSlug       *string   `json:"creator_slug"`
	SendCount         int       `json:"send_count"`
	CreatedAt         time.Time `json:"created_at"`
}

// ProblemSummary is the shape returned by POST /problems's RETURNING clause.
type ProblemSummary struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Grade     *string `json:"grade"`
	CragID    string  `json:"crag_id"`
	BoulderID string  `json:"boulder_id"`
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
	CreatedBy         *string   `json:"created_by"`
	CreatedAt         time.Time `json:"created_at"`
}

// ProblemDetail is the shape returned by GET /problems/:id.
type ProblemDetail struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Grade             *string   `json:"grade"`
	CragID            string    `json:"crag_id"`
	CragName          *string   `json:"crag_name"`
	BoulderID         string    `json:"boulder_id"`
	BoulderName       *string   `json:"boulder_name"`
	FirstAscensionist *string   `json:"first_ascensionist"`
	DiscoveredBy      *string   `json:"discovered_by"`
	LandingHazards    *string   `json:"landing_hazards"`
	Descent           *string   `json:"descent"`
	HeightM           *float64  `json:"height_m"`
	Notes             *string   `json:"notes"`
	CreatedBy         *string   `json:"created_by"`
	CreatorName       *string   `json:"creator_name"`
	CreatorSlug       *string   `json:"creator_slug"`
	SendCount         int       `json:"send_count"`
	CreatedAt         time.Time `json:"created_at"`
}

const problemListSelect = `
	SELECT
		p.id, p.name, p.grade, p.crag_id, c.name AS crag_name, p.boulder_id, b.name AS boulder_name,
		p.first_ascensionist, p.discovered_by, p.landing_hazards, p.descent, p.height_m, p.notes,
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
			&p.FirstAscensionist, &p.DiscoveredBy, &p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes,
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
		&p.FirstAscensionist, &p.DiscoveredBy, &p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes,
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
	createdBy string,
) (*ProblemSummary, error) {
	var p ProblemSummary
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO problems (
			name, grade, boulder_id, crag_id, first_ascensionist, discovered_by,
			landing_hazards, descent, height_m, notes, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 RETURNING id, name, grade, crag_id, boulder_id`,
		name, grade, boulderID, cragID, firstAscensionist, discoveredBy, landingHazards, descent, heightM, notes, createdBy,
	).Scan(&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID)
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

func deleteProblemRow(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM problems WHERE id = $1`, id)
	return err
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
			landing_hazards, descent, height_m, notes, created_by, created_at`,
		name, grade, firstAscensionist, discoveredBy, landingHazards, descent, heightM, notes, id,
	).Scan(
		&p.ID, &p.Name, &p.Grade, &p.CragID, &p.BoulderID, &p.FirstAscensionist, &p.DiscoveredBy,
		&p.LandingHazards, &p.Descent, &p.HeightM, &p.Notes, &p.CreatedBy, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}
