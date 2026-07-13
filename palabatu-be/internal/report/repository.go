package report

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

// Report is a moderation-queue entry against either a comment or a problem
// topo-image. Images have no per-row id (problems.image_urls is a jsonb
// array of URL strings), so an image report carries ImageURL instead of a
// foreign key.
type Report struct {
	ID           string    `json:"id"`
	ReporterID   string    `json:"reporter_id"`
	ReporterName *string   `json:"reporter_name"`
	ProblemID    string    `json:"problem_id"`
	ProblemName  string    `json:"problem_name"`
	TargetType   string    `json:"target_type"`
	CommentID    *string   `json:"comment_id"`
	CommentText  *string   `json:"comment_content"`
	ImageURL     *string   `json:"image_url"`
	Reason       *string   `json:"reason"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

func createReport(ctx context.Context, reporterID, problemID, targetType string, commentID, imageURL, reason *string) (*Report, error) {
	var r Report
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO reports (reporter_id, problem_id, target_type, comment_id, image_url, reason)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, reporter_id, problem_id, target_type, comment_id, image_url, reason, status, created_at
	`, reporterID, problemID, targetType, commentID, imageURL, reason).Scan(
		&r.ID, &r.ReporterID, &r.ProblemID, &r.TargetType, &r.CommentID, &r.ImageURL, &r.Reason, &r.Status, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func listPendingReports(ctx context.Context) ([]Report, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			r.id, r.reporter_id, pr.username, r.problem_id, p.name,
			r.target_type, r.comment_id, c.content, r.image_url, r.reason,
			r.status, r.created_at
		FROM reports r
		JOIN problems p ON r.problem_id = p.id
		LEFT JOIN profiles pr ON r.reporter_id = pr.id
		LEFT JOIN comments c ON r.comment_id = c.id
		WHERE r.status = 'pending'
		ORDER BY r.created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reports := []Report{}
	for rows.Next() {
		var r Report
		if err := rows.Scan(
			&r.ID, &r.ReporterID, &r.ReporterName, &r.ProblemID, &r.ProblemName,
			&r.TargetType, &r.CommentID, &r.CommentText, &r.ImageURL, &r.Reason,
			&r.Status, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, rows.Err()
}

// getReportTarget backs Resolve's authorization/dispatch decision — which
// content to remove and whether the report is still actionable.
func getReportTarget(ctx context.Context, id string) (targetType string, commentID, imageURL *string, problemID, status string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT target_type, comment_id, image_url, problem_id, status FROM reports WHERE id = $1`, id).
		Scan(&targetType, &commentID, &imageURL, &problemID, &status)
	return
}

func markDismissed(ctx context.Context, id, adminID string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE reports SET status = 'dismissed', resolved_by = $2, resolved_at = now() WHERE id = $1`, id, adminID)
	return err
}

func markResolved(ctx context.Context, id, adminID string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE reports SET status = 'resolved', resolved_by = $2, resolved_at = now() WHERE id = $1`, id, adminID)
	return err
}

// resolveSiblingReports auto-resolves every other still-pending report
// against the same target when one of them gets acted on, so duplicate
// reports don't rot in the queue forever. Must run BEFORE the underlying
// content is deleted: comment_id is ON DELETE SET NULL, and that cascade
// nulls comment_id on every row referencing the comment (not just the one
// being resolved), so a sibling lookup by comment_id after the delete
// would already find nothing.
func resolveSiblingReports(ctx context.Context, excludeID, adminID, targetType string, commentID, imageURL *string, problemID string) error {
	if targetType == "comment" {
		_, err := db.Pool.Exec(ctx, `
			UPDATE reports SET status = 'resolved', resolved_by = $2, resolved_at = now()
			WHERE id != $1 AND target_type = 'comment' AND comment_id = $3 AND status = 'pending'
		`, excludeID, adminID, commentID)
		return err
	}

	_, err := db.Pool.Exec(ctx, `
		UPDATE reports SET status = 'resolved', resolved_by = $2, resolved_at = now()
		WHERE id != $1 AND target_type = 'image' AND problem_id = $3 AND image_url = $4 AND status = 'pending'
	`, excludeID, adminID, problemID, imageURL)
	return err
}
