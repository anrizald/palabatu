// Package devtools backs the owner-only Developer page: fixed data exports,
// aggregate analytics, and tester-flag management. Every route it registers
// is chained behind middleware.RequireAuth + middleware.RequireOwner, so
// unlike internal/report's admin (Council/Associate) gate, there is no
// authz policy involved here -- ownership is a single fixed account, not a
// role anyone else can hold.
package devtools

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
)

// Export returns the full row set for one of the five fixed tables this
// tool supports. The concrete return type varies by table (ExportedUser,
// ExportedProblem, ...); handler.go serializes it as JSON directly or, via
// writeCSV's use of reflection over each type's json tags, as CSV.
func Export(ctx context.Context, table string) (any, error) {
	switch table {
	case "users":
		return listUsersForExport(ctx)
	case "problems":
		return listProblemsForExport(ctx)
	case "sends":
		return listSendsForExport(ctx)
	case "comments":
		return listCommentsForExport(ctx)
	case "reports":
		return listReportsForExport(ctx)
	default:
		return nil, ErrInvalidTable
	}
}

// Analytics is the Developer page's dashboard: trailing analyticsWindowDays
// per-day breakdowns, a verified/unverified split, and the top problems/
// users by activity. Deliberately runs direct Postgres aggregate queries
// rather than reusing internal/metrics -- nothing scrapes GET /metrics
// today, so a second scrape-dependent path would ship dead.
type Analytics struct {
	SignupsPerDay  []DailyCount       `json:"signups_per_day"`
	ProblemsPerDay []DailyCount       `json:"problems_per_day"`
	SendsPerDay    []DailyCount       `json:"sends_per_day"`
	Verification   VerificationCounts `json:"verification"`
	TopProblems    []TopProblem       `json:"top_problems"`
	ActiveUsers    []ActiveUser       `json:"active_users"`
}

func GetAnalytics(ctx context.Context) (Analytics, error) {
	var a Analytics
	var err error

	if a.SignupsPerDay, err = signupsPerDay(ctx); err != nil {
		return Analytics{}, err
	}
	if a.ProblemsPerDay, err = problemsPerDay(ctx); err != nil {
		return Analytics{}, err
	}
	if a.SendsPerDay, err = sendsPerDay(ctx); err != nil {
		return Analytics{}, err
	}
	if a.Verification, err = verificationCounts(ctx); err != nil {
		return Analytics{}, err
	}
	if a.TopProblems, err = topSentProblems(ctx); err != nil {
		return Analytics{}, err
	}
	if a.ActiveUsers, err = mostActiveUsers(ctx); err != nil {
		return Analytics{}, err
	}
	return a, nil
}

// SearchTesterCandidates looks up users by email/username substring for the
// tester-toggle UI. An empty query returns no results rather than the
// entire user table.
func SearchTesterCandidates(ctx context.Context, query string) ([]TesterCandidate, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []TesterCandidate{}, nil
	}
	return searchTesterCandidates(ctx, query)
}

// ToggleTester accepts either a user's real id or their public profile slug
// (mirroring social.resolveProfileID's precedent) and flips their
// profiles.is_tester flag.
func ToggleTester(ctx context.Context, idOrSlug string) (bool, error) {
	id, err := auth.ResolveUserID(ctx, idOrSlug)
	if err != nil {
		return false, ErrNotFound
	}

	isTester, err := toggleTesterRow(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	return isTester, err
}
