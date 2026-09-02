package boulders

import (
	"context"
	"encoding/json"
	"time"

	"palabatu-be/internal/db"
)

// MergeRequest is a pending, merged, or rejected "these are the same rock"
// suggestion. See handoff.md's merge-flow section for the full design:
// anyone signed in may suggest, only an admin executes, the two boulders'
// creators may object, a 48h hold guarantees they get the chance.
type MergeRequest struct {
	ID              string     `json:"id"`
	SourceBoulderID string     `json:"source_boulder_id"`
	TargetBoulderID string     `json:"target_boulder_id"`
	SuggestedBy     *string    `json:"suggested_by"`
	Reason          *string    `json:"reason"`
	Status          string     `json:"status"`
	ResolvedBy      *string    `json:"resolved_by"`
	ResolvedAt      *time.Time `json:"resolved_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

// MergeObjection is one boulder creator's "this is not the same rock".
type MergeObjection struct {
	ID             string    `json:"id"`
	MergeRequestID string    `json:"merge_request_id"`
	UserID         *string   `json:"user_id"`
	Username       *string   `json:"username"`
	Body           string    `json:"body"`
	CreatedAt      time.Time `json:"created_at"`
}

// MergeRequestListItem is the shape returned by GET /boulders/merge-requests
// -- a pending request with its boulders/suggester named and every
// objection filed against it embedded, so the admin review queue is one
// round-trip.
type MergeRequestListItem struct {
	ID                string           `json:"id"`
	SourceBoulderID   string           `json:"source_boulder_id"`
	SourceBoulderName *string          `json:"source_boulder_name"`
	TargetBoulderID   string           `json:"target_boulder_id"`
	TargetBoulderName *string          `json:"target_boulder_name"`
	SuggestedBy       *string          `json:"suggested_by"`
	SuggesterName     *string          `json:"suggester_name"`
	Reason            *string          `json:"reason"`
	Status            string           `json:"status"`
	CreatedAt         time.Time        `json:"created_at"`
	Objections        []MergeObjection `json:"objections"`
}

func createMergeRequest(ctx context.Context, sourceID, targetID, suggestedBy, reason string) (*MergeRequest, error) {
	var r MergeRequest
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO boulder_merge_requests (source_boulder_id, target_boulder_id, suggested_by, reason)
		VALUES ($1, $2, $3, $4)
		RETURNING id, source_boulder_id, target_boulder_id, suggested_by, reason, status, resolved_by, resolved_at, created_at
	`, sourceID, targetID, suggestedBy, reason).Scan(
		&r.ID, &r.SourceBoulderID, &r.TargetBoulderID, &r.SuggestedBy, &r.Reason, &r.Status, &r.ResolvedBy, &r.ResolvedAt, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// getMergeRequestTarget backs ObjectToMerge/ResolveMergeRequest's
// authorization/dispatch decisions.
func getMergeRequestTarget(ctx context.Context, id string) (sourceBoulderID, targetBoulderID string, suggestedBy *string, status string, createdAt time.Time, err error) {
	err = db.Pool.QueryRow(ctx,
		`SELECT source_boulder_id, target_boulder_id, suggested_by, status, created_at FROM boulder_merge_requests WHERE id = $1`,
		id,
	).Scan(&sourceBoulderID, &targetBoulderID, &suggestedBy, &status, &createdAt)
	return
}

func createObjection(ctx context.Context, requestID, userID, body string) (*MergeObjection, error) {
	var o MergeObjection
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO boulder_merge_objections (merge_request_id, user_id, body)
		VALUES ($1, $2, $3)
		RETURNING id, merge_request_id, user_id, body, created_at
	`, requestID, userID, body).Scan(&o.ID, &o.MergeRequestID, &o.UserID, &o.Body, &o.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

const mergeRequestListSelect = `
	SELECT
		mr.id, mr.source_boulder_id, sb.name, mr.target_boulder_id, tb.name,
		mr.suggested_by, sp.username, mr.reason, mr.status, mr.created_at,
		COALESCE(
			(SELECT jsonb_agg(jsonb_build_object(
				'id', o.id, 'merge_request_id', o.merge_request_id, 'user_id', o.user_id,
				'username', op.username, 'body', o.body, 'created_at', o.created_at
			) ORDER BY o.created_at)
			FROM boulder_merge_objections o
			LEFT JOIN profiles op ON o.user_id = op.id
			WHERE o.merge_request_id = mr.id),
			'[]'::jsonb
		) AS objections
	FROM boulder_merge_requests mr
	LEFT JOIN boulders sb ON mr.source_boulder_id = sb.id
	LEFT JOIN boulders tb ON mr.target_boulder_id = tb.id
	LEFT JOIN profiles sp ON mr.suggested_by = sp.id
`

// queryMergeRequestList runs mergeRequestListSelect with the given WHERE
// clause/args and scans the result -- shared by the admin-wide pending
// listing and the boulder-scoped one below, which differ only in scope.
func queryMergeRequestList(ctx context.Context, whereClause string, args ...any) ([]MergeRequestListItem, error) {
	rows, err := db.Pool.Query(ctx, mergeRequestListSelect+whereClause, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := []MergeRequestListItem{}
	for rows.Next() {
		var r MergeRequestListItem
		var objectionsJSON []byte
		if err := rows.Scan(
			&r.ID, &r.SourceBoulderID, &r.SourceBoulderName, &r.TargetBoulderID, &r.TargetBoulderName,
			&r.SuggestedBy, &r.SuggesterName, &r.Reason, &r.Status, &r.CreatedAt, &objectionsJSON,
		); err != nil {
			return nil, err
		}
		r.Objections = []MergeObjection{}
		if err := json.Unmarshal(objectionsJSON, &r.Objections); err != nil {
			return nil, err
		}
		requests = append(requests, r)
	}
	return requests, rows.Err()
}

func listPendingMergeRequests(ctx context.Context) ([]MergeRequestListItem, error) {
	return queryMergeRequestList(ctx, " WHERE mr.status = 'pending' ORDER BY mr.created_at ASC")
}

// listPendingMergeRequestsForBoulder backs ListPendingMergeRequestsForBoulder
// (merge.go) -- the boulder-creator-visible counterpart to the admin-wide
// listing above, scoped to requests where the given boulder is either side.
func listPendingMergeRequestsForBoulder(ctx context.Context, boulderID string) ([]MergeRequestListItem, error) {
	return queryMergeRequestList(ctx,
		" WHERE mr.status = 'pending' AND (mr.source_boulder_id = $1 OR mr.target_boulder_id = $1) ORDER BY mr.created_at ASC",
		boulderID,
	)
}

func markMergeRequestStatus(ctx context.Context, id, status, adminID string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE boulder_merge_requests SET status = $1, resolved_by = $2, resolved_at = now() WHERE id = $3`,
		status, adminID, id,
	)
	return err
}

// repointProblemsToSurvivor moves every problem off the losing boulder onto
// the survivor, keeping crag_id in sync with wherever the survivor actually
// lives. Sends/comments/reports/annotations all hang off problems.id, which
// doesn't change, so they follow automatically (handoff.md merge design
// note 2).
func repointProblemsToSurvivor(ctx context.Context, loserID, survivorID string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE problems SET boulder_id = $1, crag_id = (SELECT crag_id FROM boulders WHERE id = $1)
		WHERE boulder_id = $2
	`, survivorID, loserID)
	return err
}

// unionBoulderImages merges the loser's photos into the survivor's set
// (deduplicated) and marks the loser merged_into the survivor -- soft, not
// destructive, so a mistaken merge is an undo rather than data loss
// (handoff.md merge design note 1).
func unionBoulderImages(ctx context.Context, loserID, survivorID string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE boulders SET image_urls = (
			SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
			FROM jsonb_array_elements(
				(SELECT image_urls FROM boulders WHERE id = $1) ||
				(SELECT image_urls FROM boulders WHERE id = $2)
			)
		)
		WHERE id = $1
	`, survivorID, loserID)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(ctx, `UPDATE boulders SET merged_into = $1 WHERE id = $2`, survivorID, loserID)
	return err
}
