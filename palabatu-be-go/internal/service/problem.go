package service

import (
	"context"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/repository"
)

func ListProblems(ctx context.Context) ([]repository.ProblemListItem, error) {
	return repository.ListProblems(ctx)
}

// CreateProblem intentionally has no role gate: any logged-in user may add a
// problem for now. (The Node route's commented-out Council/Founder check on
// POST /problems predates the role model below and is superseded by it, not
// just left disabled for parity.)
func CreateProblem(ctx context.Context, createdBy, name, grade, location string, lat, lng float64, imageURLs []string) (*repository.ProblemSummary, error) {
	return repository.CreateProblem(ctx, name, grade, location, lat, lng, createdBy, imageURLs)
}

func UpdateProblem(ctx context.Context, userID, problemID, name, grade string) (*repository.ProblemRow, error) {
	createdBy, err := repository.GetProblemCreator(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	return repository.UpdateProblem(ctx, problemID, name, grade)
}

// DeleteProblem authorizes and removes a problem row, best-effort destroying
// its Cloudinary images first. A destroy failure is logged but doesn't block
// the deletion, matching the try/catch-per-image loop in the Node route.
func DeleteProblem(ctx context.Context, userID, problemID string) error {
	createdBy, imageURLs, err := repository.GetProblemOwnerAndImages(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return err
	}

	for _, url := range imageURLs {
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("failed to delete image from Cloudinary: %v", err)
		}
	}

	return repository.DeleteProblem(ctx, problemID)
}

// adminTitles are the profiles.title values that grant CRUD privileges on
// any problem, not just ones the holder created themselves.
var adminTitles = map[string]bool{"Council": true, "Associate": true}

// authorizeProblemEdit grants CRUD on a problem to two groups: admins (title
// includes "Council" or "Associate") and that problem's own creator — its
// "Founder" — who may only edit/delete the problem(s) they added. This
// supersedes the Node route's isCreator||isCouncil check, which only
// recognized "Council" as an elevated role.
func authorizeProblemEdit(ctx context.Context, userID string, createdBy *string) error {
	titles, err := repository.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}

	isFounder := createdBy != nil && *createdBy == userID
	if isFounder || hasAdminRole(titles) {
		return nil
	}
	return ErrForbidden
}

func hasAdminRole(titles []string) bool {
	for _, t := range titles {
		if adminTitles[t] {
			return true
		}
	}
	return false
}
