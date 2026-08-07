// Command backfill-crags is a one-off, hand-run migration helper for the
// crags -> boulders -> problems restructure (see handoff.md at the repo
// root). It groups every existing problem by its normalized free-text
// location into a new crag, gives each problem its own boulder -- there's
// no data saying which existing problems actually share a rock, so this is
// the honest backfill; real duplicates get merged later through the
// ordinary "these are the same rock" flow, not guessed at here -- and
// points problems.crag_id/boulder_id at the result. Idempotent: only reads
// problems where crag_id IS NULL, so re-running after a partial failure is
// safe.
//
// Run once, by hand, against the local Docker DB (from palabatu-be/):
//
//	go run ./cmd/backfill-crags
//
// then eyeball the printed summary before applying migrations/0015, which
// makes crag_id/boulder_id NOT NULL and drops the columns this script reads
// from (location, image_urls, lat, lng).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"palabatu-be/internal/db"
)

type legacyProblem struct {
	ID        string
	Location  *string
	Lat       *float64
	Lng       *float64
	ImageURLs []string
	CreatedBy *string
	CreatedAt time.Time
}

func (p legacyProblem) displayLocation() string {
	if p.Location == nil || strings.TrimSpace(*p.Location) == "" {
		return "(no location)"
	}
	return *p.Location
}

type locationGroup = []legacyProblem

func main() {
	_ = godotenv.Load()

	// Same guard as scripts/db.ps1: this writes data, so it must never run
	// against production by accident.
	if strings.Contains(os.Getenv("DATABASE_URL"), "neon.tech") {
		log.Fatal("DATABASE_URL points at Neon (production). Refusing to run -- point this at your local Postgres instead.")
	}

	db.Connect()
	ctx := context.Background()

	problems, err := loadUnbackfilledProblems(ctx)
	if err != nil {
		log.Fatalf("failed to load problems: %v", err)
	}
	if len(problems) == 0 {
		fmt.Println("Nothing to backfill -- every problem already has a crag_id.")
		return
	}

	groups := groupByLocation(problems)

	var cragCount, problemCount, skipped int
	for _, group := range groups {
		n, err := backfillGroup(ctx, group)
		if err != nil {
			log.Printf("WARNING: skipped group %q (%d problems): %v", group[0].displayLocation(), len(group), err)
			skipped += len(group)
			continue
		}
		fmt.Printf("crag %q: %d boulder(s)/problem(s)\n", group[0].displayLocation(), n)
		cragCount++
		problemCount += n
	}

	fmt.Printf("\nBackfill complete: %d crags, %d boulders, %d problems backfilled, %d problems skipped (see warnings above).\n",
		cragCount, problemCount, problemCount, skipped)
}

func loadUnbackfilledProblems(ctx context.Context) ([]legacyProblem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, location, lat, lng, image_urls, created_by, created_at
		FROM problems
		WHERE crag_id IS NULL
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var problems []legacyProblem
	for rows.Next() {
		var p legacyProblem
		if err := rows.Scan(&p.ID, &p.Location, &p.Lat, &p.Lng, &p.ImageURLs, &p.CreatedBy, &p.CreatedAt); err != nil {
			return nil, err
		}
		problems = append(problems, p)
	}
	return problems, rows.Err()
}

// groupByLocation groups by trim+lowercase location so "Citatah",
// "citatah", and " Citatah " land in one crag instead of three. A
// missing/empty location gets its own singleton group per problem --
// lumping every location-less row into one fake crag would be worse than
// the flat model this replaces.
func groupByLocation(problems []legacyProblem) []locationGroup {
	index := map[string]int{}
	var groups []locationGroup

	for _, p := range problems {
		key := strings.TrimSpace(strings.ToLower(p.displayLocation()))
		if p.displayLocation() == "(no location)" {
			key = "__singleton__" + p.ID
		}

		if i, ok := index[key]; ok {
			groups[i] = append(groups[i], p)
			continue
		}
		index[key] = len(groups)
		groups = append(groups, locationGroup{p})
	}
	return groups
}

// backfillGroup creates one crag for the group (name = the group's first
// problem's original location text, coordinates = the centroid of the
// group's problem coordinates -- the doc left "centroid vs. oldest
// problem's coords" open; centroid is more representative of the whole
// group) and one boulder per problem in the group, then points each problem
// at its new crag/boulder. Returns the number of problems backfilled.
func backfillGroup(ctx context.Context, group locationGroup) (int, error) {
	lat, lng, ok := centroid(group)
	if !ok {
		return 0, errors.New("no problem in this group has coordinates")
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	name := group[0].displayLocation()
	if name == "(no location)" {
		name = "Unnamed spot"
	}

	var cragID string
	err = tx.QueryRow(ctx, `
		INSERT INTO crags (name, lat, lng, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, name, lat, lng, group[0].CreatedBy, group[0].CreatedAt).Scan(&cragID)
	if err != nil {
		return 0, fmt.Errorf("insert crag: %w", err)
	}

	for _, p := range group {
		imageURLs := p.ImageURLs
		if imageURLs == nil {
			imageURLs = []string{}
		}
		imageURLsJSON, err := json.Marshal(imageURLs)
		if err != nil {
			return 0, fmt.Errorf("marshal image_urls for problem %s: %w", p.ID, err)
		}

		var boulderID string
		err = tx.QueryRow(ctx, `
			INSERT INTO boulders (crag_id, image_urls, lat, lng, created_by, created_at)
			VALUES ($1, $2::jsonb, $3, $4, $5, $6)
			RETURNING id
		`, cragID, string(imageURLsJSON), p.Lat, p.Lng, p.CreatedBy, p.CreatedAt).Scan(&boulderID)
		if err != nil {
			return 0, fmt.Errorf("insert boulder for problem %s: %w", p.ID, err)
		}

		if _, err := tx.Exec(ctx, `UPDATE problems SET crag_id = $1, boulder_id = $2 WHERE id = $3`, cragID, boulderID, p.ID); err != nil {
			return 0, fmt.Errorf("update problem %s: %w", p.ID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return len(group), nil
}

func centroid(group locationGroup) (lat, lng float64, ok bool) {
	var sumLat, sumLng float64
	var n int
	for _, p := range group {
		if p.Lat == nil || p.Lng == nil {
			continue
		}
		sumLat += *p.Lat
		sumLng += *p.Lng
		n++
	}
	if n == 0 {
		return 0, 0, false
	}
	return sumLat / float64(n), sumLng / float64(n), true
}
