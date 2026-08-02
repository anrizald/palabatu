package auth

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"palabatu-be/internal/db"
)

// slugAlphabet excludes no characters for readability's sake — a slug is
// never meant to be read aloud or hand-typed, just short and URL-safe.
const slugAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
const slugLength = 8

// generateSlug produces a short, opaque, URL-safe public identifier. It's
// not a secret (it's a public profile URL segment, not a token), so the
// minor modulo bias from byte%len(alphabet) doesn't matter here — the only
// property that matters is that collisions stay rare, which ~41 bits of
// entropy already gives at this app's scale.
func generateSlug() (string, error) {
	b := make([]byte, slugLength)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	out := make([]byte, slugLength)
	for i, v := range b {
		out[i] = slugAlphabet[int(v)%len(slugAlphabet)]
	}
	return string(out), nil
}

// User.ID is a Postgres uuid (see migrations/0001_init_schema.sql), not a
// numeric id. Slug is a short, opaque, system-generated public identifier
// (migrations/0008_user_slug.up.sql) used in profile URLs instead of ID or
// Username: Username defaults to the email's local part and is editable
// with no uniqueness guarantee once copied onto profiles.username, so it
// isn't safe to expose as a lookup key.
type User struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Password   string `json:"-"`
	Username   string `json:"username"`
	Slug       string `json:"slug"`
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
	Slug      string          `json:"slug"`
	Username  *string         `json:"username"`
	Title     json.RawMessage `json:"title"`
	Tags      json.RawMessage `json:"tags"`
	AvatarURL *string         `json:"avatar_url"`
	Bio       *string         `json:"bio"`
	Location  *string         `json:"location"`
	CreatedAt time.Time       `json:"created_at"`
}

// createUser retries slug generation on a rare collision (the slug's
// uniqueness constraint is the only one that's safe to retry past). Email
// and username collisions surface to the caller as distinct sentinel
// errors instead — username became a user-typed signup field, not just an
// email-derived one, so conflating the two into one generic error would be
// a real UX bug (a brand-new email getting told it's "already registered"
// because someone else happened to have picked the same username).
//
// The users row and its profiles row are inserted together in one
// transaction, so a profile always exists from the moment of signup rather
// than being created lazily on first edit (see GetProfile).
func createUser(ctx context.Context, email, hashedPassword, username, verificationToken string, termsAcceptedAt time.Time) (string, error) {
	const maxSlugAttempts = 5
	for attempt := 0; attempt < maxSlugAttempts; attempt++ {
		slug, err := generateSlug()
		if err != nil {
			return "", err
		}

		id, err := insertUserAndProfile(ctx, email, hashedPassword, username, slug, verificationToken, termsAcceptedAt)
		if err == nil {
			return id, nil
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.ConstraintName {
			case "users_slug_key":
				continue
			case "users_username_key":
				return "", ErrUsernameExists
			case "users_email_key":
				return "", ErrEmailExists
			}
		}
		return "", err
	}
	return "", errors.New("failed to generate a unique profile slug")
}

func insertUserAndProfile(ctx context.Context, email, hashedPassword, username, slug, verificationToken string, termsAcceptedAt time.Time) (string, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password, username, slug, verification_token, is_verified, terms_accepted_at)
		 VALUES ($1, $2, $3, $4, $5, false, $6)
		 RETURNING id`,
		email, hashedPassword, username, slug, verificationToken, termsAcceptedAt,
	).Scan(&id)
	if err != nil {
		return "", err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO profiles (id, username) VALUES ($1, $2)`,
		id, username,
	); err != nil {
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

func deleteUser(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func getUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, password, username, slug, is_verified FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Password, &u.Username, &u.Slug, &u.IsVerified)
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
		`SELECT id, email, password, username, slug FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Password, &u.Username, &u.Slug)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// GetUserEmail resolves a user id to their email. Exported for
// internal/feedback, which resolves OWNER_USER_ID to an inbox to notify on
// each submission rather than duplicating a users-table query or requiring
// a second owner-email env var alongside OWNER_USER_ID.
func GetUserEmail(ctx context.Context, id string) (string, error) {
	var email string
	err := db.Pool.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, id).Scan(&email)
	return email, err
}

// getUserIDBySlug resolves a profile URL slug to the underlying user id.
func getUserIDBySlug(ctx context.Context, slug string) (string, error) {
	var id string
	err := db.Pool.QueryRow(ctx, `SELECT id FROM users WHERE slug = $1`, slug).Scan(&id)
	return id, err
}

func countUsers(ctx context.Context) (int, error) {
	var count int
	err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count, err
}

// getUserMeta reads the two users-table fields GetProfile needs that don't
// live on profiles: CreatedAt (profiles has no signup date of its own) and
// Slug (profiles rows are created lazily and may not exist yet).
func getUserMeta(ctx context.Context, id string) (createdAt time.Time, slug string, err error) {
	err = db.Pool.QueryRow(ctx, `SELECT created_at, slug FROM users WHERE id = $1`, id).Scan(&createdAt, &slug)
	return createdAt, slug, err
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

// markVerified is verifyEmailByToken's SKIP_EMAIL_VERIFICATION counterpart
// (see Signup) - same effect, keyed by id instead of a mailed token since
// there's no email round-trip to match one against.
func markVerified(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1`,
		id,
	)
	return err
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

// getProfileIDByUsername resolves a username to a user id case-insensitively
// — used for @mention notifications, where free-text comment content won't
// necessarily match a profile's saved casing.
func getProfileIDByUsername(ctx context.Context, username string) (string, error) {
	var id string
	err := db.Pool.QueryRow(ctx, `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1)`, username).Scan(&id)
	return id, err
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
