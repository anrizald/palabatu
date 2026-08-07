// Package crags owns the top level of the crags -> boulders -> problems
// hierarchy: the place you drive to and park at. Admin-role policy itself
// lives in internal/authz, not here.
package crags

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
)

func ListCrags(ctx context.Context) ([]CragListItem, error) {
	return listCrags(ctx)
}

func GetCrag(ctx context.Context, id string) (*CragListItem, error) {
	c, err := getCrag(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

// CreateCrag has no role gate: any signed-in user may add a crag
// (handoff.md decision 6) -- adding is open, editing an existing crag stays
// with its creator or an admin.
func CreateCrag(ctx context.Context, createdBy, name string, lat, lng float64, directions, accessNotes string) (*Crag, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}
	return createCrag(ctx, name, lat, lng, directions, accessNotes, createdBy)
}

func UpdateCrag(ctx context.Context, userID, cragID, name string, lat, lng float64, directions, accessNotes string) (*Crag, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}

	createdBy, err := getCragCreator(ctx, cragID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeCragEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	return updateCragRow(ctx, cragID, name, lat, lng, directions, accessNotes)
}

// authorizeCragEdit mirrors problems.authorizeProblemEdit exactly -- same
// creator-or-admin policy, applied per domain rather than shared, matching
// this codebase's existing convention.
func authorizeCragEdit(ctx context.Context, userID string, createdBy *string) error {
	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}
	if authz.CanEditOwned(userID, createdBy, titles) {
		return nil
	}
	return ErrForbidden
}
