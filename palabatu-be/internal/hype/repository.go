package hype

import (
	"context"

	"palabatu-be/internal/db"
)

func getCount(ctx context.Context) (int, error) {
	var count int
	err := db.Pool.QueryRow(ctx, `SELECT count FROM hype_counter WHERE id = 1`).Scan(&count)
	return count, err
}

func incrementCount(ctx context.Context) (int, error) {
	var count int
	err := db.Pool.QueryRow(ctx, `UPDATE hype_counter SET count = count + 1 WHERE id = 1 RETURNING count`).Scan(&count)
	return count, err
}
