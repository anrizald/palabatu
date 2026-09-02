package notification

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

type Type string

const (
	TypeComment        Type = "comment"
	TypeSend           Type = "send"
	TypeReportResolved Type = "report_resolved"
	TypeContentRemoved Type = "content_removed"
	TypeReaction       Type = "reaction"
	TypeProblemEdited  Type = "problem_edited"
	TypeProblemDeleted Type = "problem_deleted"
	TypeMention        Type = "mention"
	TypeMergeSuggested Type = "merge_suggested"
	TypeMergeObjected  Type = "merge_objected"
	TypeMergeResolved  Type = "merge_resolved"
)

type Notification struct {
	ID          string    `json:"id"`
	Type        Type      `json:"type"`
	ProblemID   *string   `json:"problem_id"`
	ProblemName *string   `json:"problem_name"`
	ActorName   *string   `json:"actor_name"`
	Message     string    `json:"message"`
	Read        bool      `json:"read"`
	CreatedAt   time.Time `json:"created_at"`
}

func create(ctx context.Context, userID string, t Type, problemID, problemName, actorName *string, message string) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO notifications (user_id, type, problem_id, problem_name, actor_name, message)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, userID, t, problemID, problemName, actorName, message)
	return err
}

func list(ctx context.Context, userID string) ([]Notification, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, type, problem_id, problem_name, actor_name, message, read, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []Notification{}
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Type, &n.ProblemID, &n.ProblemName, &n.ActorName, &n.Message, &n.Read, &n.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	return items, rows.Err()
}

func unreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`, userID).Scan(&count)
	return count, err
}

func markRead(ctx context.Context, userID, id string) (bool, error) {
	tag, err := db.Pool.Exec(ctx, `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func markAllRead(ctx context.Context, userID string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`, userID)
	return err
}
