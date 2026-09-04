package feedback

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/db"
)

// Feedback is a single submission from the global feedback / bug report
// form. UserID is nullable -- the form is open to logged-out visitors, see
// migrations/0012_feedback -- and Username is only populated by listOpen's
// join, never by createFeedback. Type is one of the values enforced by
// migrations/0018_feedback_type's check constraint -- see validFeedbackTypes
// in service.go for the same set on the Go side.
type Feedback struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"user_id"`
	Username  *string   `json:"username"`
	Email     *string   `json:"email"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	PageURL   *string   `json:"page_url"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func createFeedback(ctx context.Context, userID *string, feedbackType string, email *string, message string, pageURL *string) (*Feedback, error) {
	var f Feedback
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO feedback (user_id, type, email, message, page_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, type, email, message, page_url, status, created_at
	`, userID, feedbackType, email, message, pageURL).Scan(
		&f.ID, &f.UserID, &f.Type, &f.Email, &f.Message, &f.PageURL, &f.Status, &f.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// listOpenFeedback backs the Developer page's review list -- only 'open'
// submissions, oldest first, mirroring report.listPendingReports' precedent
// (a reviewed item drops off the list rather than staying visible dimmed).
func listOpenFeedback(ctx context.Context) ([]Feedback, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT f.id, f.user_id, pr.username, f.email, f.type, f.message, f.page_url, f.status, f.created_at
		FROM feedback f
		LEFT JOIN profiles pr ON f.user_id = pr.id
		WHERE f.status = 'open'
		ORDER BY f.created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []Feedback{}
	for rows.Next() {
		var f Feedback
		if err := rows.Scan(&f.ID, &f.UserID, &f.Username, &f.Email, &f.Type, &f.Message, &f.PageURL, &f.Status, &f.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, f)
	}
	return items, rows.Err()
}

func markReviewed(ctx context.Context, id string) error {
	var scanned string
	err := db.Pool.QueryRow(ctx, `UPDATE feedback SET status = 'reviewed' WHERE id = $1 RETURNING id`, id).Scan(&scanned)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
