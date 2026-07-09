package repository

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

// User.ID is a Postgres uuid (see migrations/0001_init_schema.sql), not a
// numeric id.
type User struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Password   string `json:"-"`
	Username   string `json:"username"`
	IsVerified bool   `json:"-"`
}

func CreateUser(ctx context.Context, email, hashedPassword, username, verificationToken string) (string, error) {
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password, username, verification_token, is_verified)
		 VALUES ($1, $2, $3, $4, false)
		 RETURNING id`,
		email, hashedPassword, username, verificationToken,
	).Scan(&id)
	return id, err
}

func DeleteUser(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, password, username, is_verified FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Password, &u.Username, &u.IsVerified)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func GetUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, username FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Username)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// VerifyEmailByToken clears verification_token and marks the user verified,
// returning the matched row so callers can tell "no such token" apart from
// a real DB error.
func VerifyEmailByToken(ctx context.Context, token string) (id string, email string, err error) {
	err = db.Pool.QueryRow(ctx,
		`UPDATE users SET is_verified = TRUE, verification_token = NULL
		 WHERE verification_token = $1
		 RETURNING id, email`,
		token,
	).Scan(&id, &email)
	return id, email, err
}

func SetResetToken(ctx context.Context, email, token string, expiry time.Time) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3`,
		token, expiry, email,
	)
	return err
}

func GetUserByResetToken(ctx context.Context, token string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, username FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
		token,
	).Scan(&u.ID, &u.Email, &u.Username)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UpdatePassword(ctx context.Context, id string, hashedPassword string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2`,
		hashedPassword, id,
	)
	return err
}
