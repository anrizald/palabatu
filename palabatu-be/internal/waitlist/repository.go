package waitlist

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"palabatu-be/internal/db"
)

type Subscriber struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

func createSubscriber(ctx context.Context, email string) (*Subscriber, error) {
	var s Subscriber
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO waitlist_subscribers (email)
		VALUES ($1)
		RETURNING id, email, created_at
	`, email).Scan(&s.ID, &s.Email, &s.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "waitlist_subscribers_email_key" {
			return nil, ErrEmailExists
		}
		return nil, err
	}
	return &s, nil
}
