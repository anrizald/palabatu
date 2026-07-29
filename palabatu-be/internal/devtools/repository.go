package devtools

import (
	"context"
	"time"

	"palabatu-be/internal/db"
)

// Exported* types back the five fixed data-export endpoints. Each has an
// explicit column list rather than SELECT * -- most visibly on
// ExportedUser, which deliberately excludes users.password/
// verification_token/reset_token/reset_token_expiry.

type ExportedUser struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	Username        string     `json:"username"`
	Slug            string     `json:"slug"`
	IsVerified      bool       `json:"is_verified"`
	TermsAcceptedAt *time.Time `json:"terms_accepted_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

type ExportedProblem struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Grade     *string   `json:"grade"`
	Location  *string   `json:"location"`
	Lat       *float64  `json:"lat"`
	Lng       *float64  `json:"lng"`
	CreatedBy *string   `json:"created_by"`
	ImageURLs []string  `json:"image_urls"`
	CreatedAt time.Time `json:"created_at"`
}

type ExportedSend struct {
	ID        string    `json:"id"`
	ProblemID string    `json:"problem_id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type ExportedComment struct {
	ID        string    `json:"id"`
	ProblemID string    `json:"problem_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type ExportedReport struct {
	ID         string     `json:"id"`
	ReporterID string     `json:"reporter_id"`
	ProblemID  string     `json:"problem_id"`
	TargetType string     `json:"target_type"`
	CommentID  *string    `json:"comment_id"`
	ImageURL   *string    `json:"image_url"`
	Reason     *string    `json:"reason"`
	Status     string     `json:"status"`
	ResolvedBy *string    `json:"resolved_by"`
	ResolvedAt *time.Time `json:"resolved_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

func listUsersForExport(ctx context.Context) ([]ExportedUser, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, email, username, slug, is_verified, terms_accepted_at, created_at
		FROM users ORDER BY created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ExportedUser{}
	for rows.Next() {
		var u ExportedUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Slug, &u.IsVerified, &u.TermsAcceptedAt, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func listProblemsForExport(ctx context.Context) ([]ExportedProblem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, name, grade, location, lat, lng, created_by, image_urls, created_at
		FROM problems ORDER BY created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ExportedProblem{}
	for rows.Next() {
		var p ExportedProblem
		if err := rows.Scan(&p.ID, &p.Name, &p.Grade, &p.Location, &p.Lat, &p.Lng, &p.CreatedBy, &p.ImageURLs, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func listSendsForExport(ctx context.Context) ([]ExportedSend, error) {
	rows, err := db.Pool.Query(ctx, `SELECT id, problem_id, user_id, created_at FROM sends ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ExportedSend{}
	for rows.Next() {
		var s ExportedSend
		if err := rows.Scan(&s.ID, &s.ProblemID, &s.UserID, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func listCommentsForExport(ctx context.Context) ([]ExportedComment, error) {
	rows, err := db.Pool.Query(ctx, `SELECT id, problem_id, user_id, content, created_at FROM comments ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ExportedComment{}
	for rows.Next() {
		var c ExportedComment
		if err := rows.Scan(&c.ID, &c.ProblemID, &c.UserID, &c.Content, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func listReportsForExport(ctx context.Context) ([]ExportedReport, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, reporter_id, problem_id, target_type, comment_id, image_url, reason, status, resolved_by, resolved_at, created_at
		FROM reports ORDER BY created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ExportedReport{}
	for rows.Next() {
		var r ExportedReport
		if err := rows.Scan(
			&r.ID, &r.ReporterID, &r.ProblemID, &r.TargetType, &r.CommentID, &r.ImageURL,
			&r.Reason, &r.Status, &r.ResolvedBy, &r.ResolvedAt, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// analyticsWindowDays bounds the per-day breakdowns to a trailing window --
// a dashboard glance, not a full history export (that's what /export is for).
const analyticsWindowDays = 30

// topLimit caps the top-sent-problems and most-active-users lists.
const topLimit = 10

type DailyCount struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

type VerificationCounts struct {
	Verified   int `json:"verified"`
	Unverified int `json:"unverified"`
}

type TopProblem struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Sends int    `json:"sends"`
}

type ActiveUser struct {
	UserID   string  `json:"user_id"`
	Username *string `json:"username"`
	Sends    int     `json:"sends"`
	Comments int     `json:"comments"`
	Problems int     `json:"problems"`
}

func dailyCounts(ctx context.Context, table, dateColumn string) ([]DailyCount, error) {
	// table/dateColumn are always one of this function's own hardcoded
	// call sites below, never request input, so building the query with
	// them isn't a SQL-injection risk.
	rows, err := db.Pool.Query(ctx, `
		SELECT to_char(`+dateColumn+`, 'YYYY-MM-DD') AS day, COUNT(*)
		FROM `+table+`
		WHERE `+dateColumn+` >= now() - ($1 * interval '1 day')
		GROUP BY day
		ORDER BY day
	`, analyticsWindowDays)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []DailyCount{}
	for rows.Next() {
		var d DailyCount
		if err := rows.Scan(&d.Day, &d.Count); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func signupsPerDay(ctx context.Context) ([]DailyCount, error) {
	return dailyCounts(ctx, "users", "created_at")
}

func problemsPerDay(ctx context.Context) ([]DailyCount, error) {
	return dailyCounts(ctx, "problems", "created_at")
}

func sendsPerDay(ctx context.Context) ([]DailyCount, error) {
	return dailyCounts(ctx, "sends", "created_at")
}

func verificationCounts(ctx context.Context) (VerificationCounts, error) {
	var v VerificationCounts
	err := db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE is_verified),
			COUNT(*) FILTER (WHERE NOT is_verified)
		FROM users
	`).Scan(&v.Verified, &v.Unverified)
	return v, err
}

func topSentProblems(ctx context.Context) ([]TopProblem, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT p.id, p.name, COUNT(s.id) AS sends
		FROM problems p
		JOIN sends s ON s.problem_id = p.id
		GROUP BY p.id, p.name
		ORDER BY sends DESC
		LIMIT $1
	`, topLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []TopProblem{}
	for rows.Next() {
		var p TopProblem
		if err := rows.Scan(&p.ID, &p.Name, &p.Sends); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func mostActiveUsers(ctx context.Context) ([]ActiveUser, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			u.id, p.username,
			COALESCE(s.cnt, 0) AS sends,
			COALESCE(c.cnt, 0) AS comments,
			COALESCE(pr.cnt, 0) AS problems
		FROM users u
		LEFT JOIN profiles p ON p.id = u.id
		LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM sends GROUP BY user_id) s ON s.user_id = u.id
		LEFT JOIN (SELECT user_id, COUNT(*) cnt FROM comments GROUP BY user_id) c ON c.user_id = u.id
		LEFT JOIN (SELECT created_by, COUNT(*) cnt FROM problems WHERE created_by IS NOT NULL GROUP BY created_by) pr ON pr.created_by = u.id
		WHERE COALESCE(s.cnt, 0) + COALESCE(c.cnt, 0) + COALESCE(pr.cnt, 0) > 0
		ORDER BY (COALESCE(s.cnt, 0) + COALESCE(c.cnt, 0) + COALESCE(pr.cnt, 0)) DESC
		LIMIT $1
	`, topLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ActiveUser{}
	for rows.Next() {
		var a ActiveUser
		if err := rows.Scan(&a.UserID, &a.Username, &a.Sends, &a.Comments, &a.Problems); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// TesterCandidate is one search result row for the tester-management
// search-by-username/email UI.
type TesterCandidate struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Slug     string `json:"slug"`
	IsTester bool   `json:"is_tester"`
}

func searchTesterCandidates(ctx context.Context, query string) ([]TesterCandidate, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT u.id, u.email, u.username, u.slug, COALESCE(p.is_tester, false)
		FROM users u
		LEFT JOIN profiles p ON p.id = u.id
		WHERE u.email ILIKE $1 OR u.username ILIKE $1
		ORDER BY u.username
		LIMIT 20
	`, "%"+query+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []TesterCandidate{}
	for rows.Next() {
		var t TesterCandidate
		if err := rows.Scan(&t.ID, &t.Email, &t.Username, &t.Slug, &t.IsTester); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// toggleTesterRow flips is_tester atomically (NOT COALESCE(is_tester,
// false) rather than a read-then-write) so two overlapping toggle requests
// can't race each other to a stale value. Returns ErrNotFound if the user
// has no profiles row yet -- see auth.GetProfile's doc comment for the
// pre-profile-at-signup accounts this can still happen for.
func toggleTesterRow(ctx context.Context, userID string) (bool, error) {
	var isTester bool
	err := db.Pool.QueryRow(ctx, `
		UPDATE profiles SET is_tester = NOT COALESCE(is_tester, false)
		WHERE id = $1
		RETURNING is_tester
	`, userID).Scan(&isTester)
	return isTester, err
}
