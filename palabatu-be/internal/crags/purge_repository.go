package crags

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// CragSnapshot is the only thing that survives a purge. Data is one JSON
// document holding every destroyed row, verbatim, built by Postgres itself
// (row_to_json) rather than hand-modelled here -- a backup that quietly
// drops a column the day someone adds one is worse than no backup, and this
// shape cannot drift from the schema because it is generated from it.
//
// It is returned to the caller rather than written server-side on purpose:
// there is nowhere durable to write it (Railway's filesystem is ephemeral,
// see railway_prod_deployment_handoff.md), and an admin's own download is a
// copy the app cannot later lose.
type CragSnapshot struct {
	PurgedAt time.Time       `json:"purged_at"`
	PurgedBy string          `json:"purged_by"`
	Data     json.RawMessage `json:"data" swaggertype:"object"`
}

// snapshotSQL builds the whole document in one round-trip. Every child set
// is scoped through the crag, and the problem-level sets go through
// problems.crag_id (the denormalized column) rather than a two-hop join
// through boulders -- same reason every other hot query in this codebase
// uses it.
const snapshotSQL = `
SELECT json_build_object(
	'crag',             (SELECT row_to_json(c) FROM crags c WHERE c.id = $1),
	'boulders',         COALESCE((SELECT json_agg(row_to_json(b)) FROM boulders b WHERE b.crag_id = $1), '[]'::json),
	'problems',         COALESCE((SELECT json_agg(row_to_json(p)) FROM problems p WHERE p.crag_id = $1), '[]'::json),
	'approaches',       COALESCE((SELECT json_agg(row_to_json(a)) FROM approaches a WHERE a.crag_id = $1), '[]'::json),
	'approach_steps',   COALESCE((SELECT json_agg(row_to_json(s)) FROM approach_steps s
	                              WHERE s.approach_id IN (SELECT id FROM approaches WHERE crag_id = $1)), '[]'::json),
	'comments',         COALESCE((SELECT json_agg(row_to_json(cm)) FROM comments cm
	                              WHERE cm.problem_id IN (SELECT id FROM problems WHERE crag_id = $1)), '[]'::json),
	'sends',            COALESCE((SELECT json_agg(row_to_json(sd)) FROM sends sd
	                              WHERE sd.problem_id IN (SELECT id FROM problems WHERE crag_id = $1)), '[]'::json),
	'topo_annotations', COALESCE((SELECT json_agg(row_to_json(t)) FROM topo_annotations t
	                              WHERE t.problem_id IN (SELECT id FROM problems WHERE crag_id = $1)), '[]'::json),
	'reports',          COALESCE((SELECT json_agg(row_to_json(r)) FROM reports r
	                              WHERE r.problem_id IN (SELECT id FROM problems WHERE crag_id = $1)), '[]'::json),
	'merge_requests',   COALESCE((SELECT json_agg(row_to_json(mr)) FROM boulder_merge_requests mr
	                              WHERE mr.source_boulder_id IN (SELECT id FROM boulders WHERE crag_id = $1)
	                                 OR mr.target_boulder_id IN (SELECT id FROM boulders WHERE crag_id = $1)), '[]'::json)
)`

func getCragSnapshot(ctx context.Context, cragID string) (json.RawMessage, error) {
	var data json.RawMessage
	if err := db.Pool.QueryRow(ctx, snapshotSQL, cragID).Scan(&data); err != nil {
		return nil, err
	}
	return data, nil
}

// getPurgeCounts is the number an admin has to confirm. Counted the same
// way the snapshot is collected, so the two can never disagree about what
// is in scope.
func getPurgeCounts(ctx context.Context, cragID string) (*PurgeCounts, error) {
	var c PurgeCounts
	err := db.Pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM boulders WHERE crag_id = $1),
			(SELECT COUNT(*) FROM problems WHERE crag_id = $1),
			(SELECT COUNT(*) FROM sends WHERE problem_id IN (SELECT id FROM problems WHERE crag_id = $1)),
			(SELECT COUNT(*) FROM comments WHERE problem_id IN (SELECT id FROM problems WHERE crag_id = $1)),
			(SELECT COUNT(*) FROM topo_annotations WHERE problem_id IN (SELECT id FROM problems WHERE crag_id = $1)),
			(SELECT COUNT(*) FROM approaches WHERE crag_id = $1),
			(SELECT COUNT(*) FROM reports WHERE problem_id IN (SELECT id FROM problems WHERE crag_id = $1)),
			(SELECT COUNT(*) FROM (`+purgePhotoSQL+`) ph)`,
		cragID,
	).Scan(&c.Boulders, &c.Problems, &c.Sends, &c.Comments, &c.Lines, &c.Approaches, &c.Reports, &c.Photos)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// purgePhotoSQL is every Cloudinary asset reachable only through this crag.
// It exists because a database cascade runs no Go: nothing in the FK chain
// calls cloudinary.DestroyByURL, so without collecting these first the
// purge would leave assets that can never even be enumerated again, their
// URLs having gone with the rows.
const purgePhotoSQL = `
	SELECT jsonb_array_elements_text(image_urls) AS url FROM crags WHERE id = $1
	UNION ALL
	SELECT jsonb_array_elements_text(image_urls) FROM boulders WHERE crag_id = $1
	UNION ALL
	SELECT jsonb_array_elements_text(image_urls) FROM problems WHERE crag_id = $1
	UNION ALL
	SELECT photo_url FROM approach_steps WHERE approach_id IN (SELECT id FROM approaches WHERE crag_id = $1)
`

func getPurgePhotoURLs(ctx context.Context, cragID string) ([]string, error) {
	rows, err := db.Pool.Query(ctx, `SELECT url FROM (`+purgePhotoSQL+`) ph WHERE url IS NOT NULL AND url <> ''`, cragID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	urls := []string{}
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		urls = append(urls, u)
	}
	return urls, rows.Err()
}

// purgeVictim is one problem's creator and name, read before the delete so
// the purge can tell each of them what happened. Without this the cascade
// is silent: problems.DeleteProblem notifies a creator when an admin
// removes their problem, and a raw DELETE would skip that for every problem
// at once.
type purgeVictim struct {
	CreatorID   string
	ProblemName string
}

func getPurgeVictims(ctx context.Context, cragID string) ([]purgeVictim, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT created_by, name FROM problems WHERE crag_id = $1 AND created_by IS NOT NULL`, cragID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	victims := []purgeVictim{}
	for rows.Next() {
		var v purgeVictim
		if err := rows.Scan(&v.CreatorID, &v.ProblemName); err != nil {
			return nil, err
		}
		victims = append(victims, v)
	}
	return victims, rows.Err()
}

// purgeCragRows performs the destruction in one transaction, in the only
// order the schema allows. problems must go first and explicitly:
// problems.crag_id and problems.boulder_id are both NO ACTION, so a bare
// DELETE FROM crags fails on problems_crag_id_fkey while the crag still has
// any. Deleting the problems takes comments/sends/reports/topo_annotations
// with them (all CASCADE); deleting the crag then takes boulders (and their
// merge requests and objections) and approaches (and their steps).
func purgeCragRows(ctx context.Context, cragID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM problems WHERE crag_id = $1`, cragID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM crags WHERE id = $1`, cragID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
