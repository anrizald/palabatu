// Package problems owns map spots/routes, problem CRUD, image uploads, and
// the "Founder" (creator) authorization check. Admin-role policy itself
// (Council/Associate) lives in internal/authz, not here.
package problems

import (
	"context"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/cloudinary"
)

func ListProblems(ctx context.Context) ([]ProblemListItem, error) {
	return listProblems(ctx)
}

func GetProblem(ctx context.Context, id string) (*ProblemDetail, error) {
	p, err := getProblem(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

// CreateProblem intentionally has no role gate: any logged-in user may add a
// problem for now. (The Node route's commented-out Council/Founder check on
// POST /problems predates the role model below and is superseded by it, not
// just left disabled for parity.)
func CreateProblem(ctx context.Context, createdBy, name, grade, location string, lat, lng float64, imageURLs []string) (*ProblemSummary, error) {
	if err := validateGrade(grade); err != nil {
		return nil, err
	}
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}

	return createProblem(ctx, name, grade, location, lat, lng, createdBy, imageURLs)
}

func UpdateProblem(ctx context.Context, userID, problemID, name, grade, locationName string, lat, lng float64) (*ProblemRow, error) {
	if err := validateGrade(grade); err != nil {
		return nil, err
	}
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}

	createdBy, err := getProblemCreator(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	return updateProblemRow(ctx, problemID, name, grade, locationName, lat, lng)
}

// DeleteProblem authorizes and removes a problem row, best-effort destroying
// its Cloudinary images first. A destroy failure is logged but doesn't block
// the deletion, matching the try/catch-per-image loop in the Node route.
func DeleteProblem(ctx context.Context, userID, problemID string) error {
	createdBy, imageURLs, err := getProblemOwnerAndImages(ctx, problemID)
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

	return deleteProblemRow(ctx, problemID)
}

// authorizeProblemEdit fetches the acting user's profile titles and defers
// the actual admin/Founder policy decision to authz.CanEditOwned, which
// takes that already-fetched data as an argument rather than reaching into
// auth's repository itself.
func authorizeProblemEdit(ctx context.Context, userID string, createdBy *string) error {
	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}

	if authz.CanEditOwned(userID, createdBy, titles) {
		return nil
	}
	return ErrForbidden
}
