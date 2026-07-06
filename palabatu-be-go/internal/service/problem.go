package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/repository"
)

func ListProblems(ctx context.Context) ([]repository.ProblemListItem, error) {
	return repository.ListProblems(ctx)
}

// CreateProblem mirrors POST /problems in palabatu-be/routes/api.ts. That
// route's Council/Founder title check is commented out in the Node source
// (left disabled, not removed) — preserved here as a no-op for behavior
// parity; see CLAUDE.md's "Go backend rewrite" notes.
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

// DeleteProblem authorizes and removes a problem row. It does not yet
// destroy the associated Cloudinary images (unlike the Node route) — that
// requires the Cloudinary Go SDK, which lands with the image-upload port.
func DeleteProblem(ctx context.Context, userID, problemID string) error {
	createdBy, _, err := repository.GetProblemOwnerAndImages(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return err
	}

	return repository.DeleteProblem(ctx, problemID)
}

// authorizeProblemEdit implements the isCreator || isCouncil check shared by
// PUT and DELETE /problems/:id in the Node route.
func authorizeProblemEdit(ctx context.Context, userID string, createdBy *string) error {
	titles, err := repository.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}

	isCreator := createdBy != nil && *createdBy == userID
	isCouncil := false
	for _, t := range titles {
		if t == "Council" {
			isCouncil = true
			break
		}
	}

	if !isCreator && !isCouncil {
		return ErrForbidden
	}
	return nil
}
