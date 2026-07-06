package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/db"
)

func SendExists(ctx context.Context, problemID, userID string) (bool, error) {
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

func CreateSend(ctx context.Context, problemID, userID string) error {
	_, err := db.Pool.Exec(ctx, `INSERT INTO sends (problem_id, user_id) VALUES ($1, $2)`, problemID, userID)
	return err
}

func DeleteSend(ctx context.Context, problemID, userID string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM sends WHERE problem_id = $1 AND user_id = $2`, problemID, userID)
	return err
}
