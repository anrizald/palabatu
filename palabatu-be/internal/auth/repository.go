package auth

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

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

// Profile.Title and .Tags are passed through as opaque JSON: title is a
// JSON array of role strings (e.g. ["Council"]) and tags is a
// frontend-defined object ({ level, styles }), mirroring how
// palabatu-be/routes/api.ts just re-serializes whatever was stored rather
// than asserting a shape. CreatedAt is the underlying user's signup date
// (from users.created_at, not stored on profiles itself) and is only
// populated by GetProfile, not getProfileByID.
type Profile struct {
	ID        string          `json:"id"`
	Username  *string         `json:"username"`
	Title     json.RawMessage `json:"title"`
	Tags      json.RawMessage `json:"tags"`
	AvatarURL *string         `json:"avatar_url"`
	Bio       *string         `json:"bio"`
	Location  *string         `json:"location"`
	CreatedAt time.Time       `json:"created_at"`
}

func createUser(ctx context.Context, email, hashedPassword, username, verificationToken string) (string, error) {
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password, username, verification_token, is_verified)
		 VALUES ($1, $2, $3, $4, false)
		 RETURNING id`,
		email, hashedPassword, username, verificationToken,
	).Scan(&id)
	return id, err
}

func deleteUser(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func getUserByEmail(ctx context.Context, email string) (*User, error) {
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

// getUserByID also selects password (unlike getUserByEmail's other typical
// caller, Signin, most callers only need id/email/username) so
// ChangePassword and DeleteAccount can verify the caller's current password
// without a second query. User.Password is json:"-" so this never leaks.
func getUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, password, username FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Password, &u.Username)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func getUserCreatedAt(ctx context.Context, id string) (time.Time, error) {
	var t time.Time
	err := db.Pool.QueryRow(ctx, `SELECT created_at FROM users WHERE id = $1`, id).Scan(&t)
	return t, err
}

// verifyEmailByToken clears verification_token and marks the user verified,
// returning the matched row so callers can tell "no such token" apart from
// a real DB error.
func verifyEmailByToken(ctx context.Context, token string) (id string, email string, err error) {
	err = db.Pool.QueryRow(ctx,
		`UPDATE users SET is_verified = TRUE, verification_token = NULL
		 WHERE verification_token = $1
		 RETURNING id, email`,
		token,
	).Scan(&id, &email)
	return id, email, err
}

func setResetToken(ctx context.Context, email, token string, expiry time.Time) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3`,
		token, expiry, email,
	)
	return err
}

func getUserByResetToken(ctx context.Context, token string) (*User, error) {
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

func updatePassword(ctx context.Context, id string, hashedPassword string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2`,
		hashedPassword, id,
	)
	return err
}

func getProfileByID(ctx context.Context, id string) (*Profile, error) {
	var p Profile
	err := db.Pool.QueryRow(ctx,
		`SELECT id, username, title, tags, avatar_url, bio, location FROM profiles WHERE id = $1`,
		id,
	).Scan(&p.ID, &p.Username, &p.Title, &p.Tags, &p.AvatarURL, &p.Bio, &p.Location)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ProfileStats are read-only counts displayed on a profile page: how many
// problems a climber has sent and how many they've added to the map.
type ProfileStats struct {
	SendsCount    int `json:"sends_count"`
	ProblemsCount int `json:"problems_count"`
}

// getProfileStats reads directly from the sends and problems tables rather
// than importing internal/social or internal/problems for it, mirroring how
// listComments already JOINs into profiles directly rather than importing
// internal/auth for a single read.
func getProfileStats(ctx context.Context, userID string) (ProfileStats, error) {
	var s ProfileStats
	err := db.Pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM sends WHERE user_id = $1),
			(SELECT COUNT(*) FROM problems WHERE created_by = $1)
	`, userID).Scan(&s.SendsCount, &s.ProblemsCount)
	return s, err
}

// recentActivityLimit caps how many rows each half of the activity feed
// returns — a profile page shows a glance, not a full history.
const recentActivityLimit = 5

// RecentSend and RecentProblem back the profile page's activity feed: the
// climber's most recent sends and most recently added problems.
type RecentSend struct {
	ProblemID   string    `json:"problem_id"`
	ProblemName string    `json:"problem_name"`
	Grade       *string   `json:"grade"`
	CreatedAt   time.Time `json:"created_at"`
}

type RecentProblem struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Grade     *string   `json:"grade"`
	CreatedAt time.Time `json:"created_at"`
}

func getRecentSends(ctx context.Context, userID string) ([]RecentSend, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT p.id, p.name, p.grade, s.created_at
		FROM sends s
		JOIN problems p ON p.id = s.problem_id
		WHERE s.user_id = $1
		ORDER BY s.created_at DESC
		LIMIT $2
	`, userID, recentActivityLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sends := []RecentSend{}
	for rows.Next() {
		var s RecentSend
		if err := rows.Scan(&s.ProblemID, &s.ProblemName, &s.Grade, &s.CreatedAt); err != nil {
			return nil, err
		}
		sends = append(sends, s)
	}
	return sends, rows.Err()
}

func getRecentlyAddedProblems(ctx context.Context, userID string) ([]RecentProblem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, name, grade, created_at
		FROM problems
		WHERE created_by = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, recentActivityLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	problems := []RecentProblem{}
	for rows.Next() {
		var p RecentProblem
		if err := rows.Scan(&p.ID, &p.Name, &p.Grade, &p.CreatedAt); err != nil {
			return nil, err
		}
		problems = append(problems, p)
	}
	return problems, rows.Err()
}

func upsertProfileRow(ctx context.Context, id, username string, title, tags json.RawMessage, avatarURL, bio, location string) (*Profile, error) {
	var p Profile
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO profiles (id, username, title, tags, avatar_url, bio, location)
		 VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
		 ON CONFLICT (id) DO UPDATE SET username = $2, title = $3::jsonb, tags = $4::jsonb, avatar_url = $5, bio = $6, location = $7
		 RETURNING id, username, title, tags, avatar_url, bio, location`,
		id, username, string(title), string(tags), avatarURL, bio, location,
	).Scan(&p.ID, &p.Username, &p.Title, &p.Tags, &p.AvatarURL, &p.Bio, &p.Location)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// GetUserTitles reads profiles.title for authorization checks (the
// Council/Associate role gate on problem and comment edit/delete, applied
// via internal/authz), mirroring palabatu-be/routes/api.ts's
// getUserTitles(). A missing profile, null title, or legacy non-array value
// all yield an empty slice rather than an error, matching that helper's
// try/catch fallback. Exported because internal/problems and internal/social
// call it to build the already-fetched titles that authz.CanEditOwned takes
// as an argument.
func GetUserTitles(ctx context.Context, userID string) ([]string, error) {
	var raw json.RawMessage
	err := db.Pool.QueryRow(ctx, `SELECT title FROM profiles WHERE id = $1`, userID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return []string{}, nil
	}

	var titles []string
	if err := json.Unmarshal(raw, &titles); err != nil {
		return []string{}, nil
	}
	return titles, nil
}
