package social

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/db"
)

type Comment struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Username  string    `json:"username"`
	UserID    string    `json:"user_id"`
}

func sendExists(ctx context.Context, problemID, userID string) (bool, error) {
	var exists int
	err := db.Pool.QueryRow(ctx,
		`SELECT 1 FROM sends WHERE problem_id = $1 AND user_id = $2`,
		problemID, userID,
	).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func createSend(ctx context.Context, problemID, userID string) error {
	_, err := db.Pool.Exec(ctx, `INSERT INTO sends (problem_id, user_id) VALUES ($1, $2)`, problemID, userID)
	return err
}

func deleteSend(ctx context.Context, problemID, userID string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM sends WHERE problem_id = $1 AND user_id = $2`, problemID, userID)
	return err
}

func listComments(ctx context.Context, problemID string) ([]Comment, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT c.id, c.content, c.created_at, p.username, c.user_id
		FROM comments c
		JOIN profiles p ON c.user_id = p.id
		WHERE c.problem_id = $1
		ORDER BY c.created_at ASC
	`, problemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []Comment{}
	for rows.Next() {
		var c Comment
		if err := rows.Scan(&c.ID, &c.Content, &c.CreatedAt, &c.Username, &c.UserID); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}

func createComment(ctx context.Context, problemID, userID, content string) (*Comment, error) {
	var c Comment
	err := db.Pool.QueryRow(ctx, `
		WITH new_comment AS (
			INSERT INTO comments (problem_id, user_id, content)
			VALUES ($1, $2, $3)
			RETURNING id, content, created_at, user_id
		)
		SELECT nc.id, nc.content, nc.created_at, p.username, nc.user_id
		FROM new_comment nc
		JOIN profiles p ON nc.user_id = p.id
	`, problemID, userID, content).Scan(&c.ID, &c.Content, &c.CreatedAt, &c.Username, &c.UserID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
