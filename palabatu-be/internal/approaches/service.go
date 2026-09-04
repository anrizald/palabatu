// Package approaches owns "jalan masuk" -- approach guides: the walk in
// from wherever you arrive, photographed step by step (see handoff.md
// decision 21 at the repo root). Deliberately not a field on
// crags/boulders/problems: a crag may have several genuinely different
// approaches, and a second contributor adds their own alongside an
// existing one rather than editing it. Admin-role policy itself lives in
// internal/authz, not here.
package approaches

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
)

func ListApproaches(ctx context.Context, cragID string) ([]ApproachListItem, error) {
	return listApproaches(ctx, cragID)
}

func GetApproach(ctx context.Context, id string) (*Approach, error) {
	a, err := getApproach(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}

// CreateApproach requires at least one step, each with a photo and a
// caption (handoff.md decision 21: "each a photo plus one line").
//
// Gated through authz.CanContribute rather than a flat creator-or-admin
// check: adding a *second* approach alongside whatever a crag already has
// is exactly the additive contribution decision 22 built the mechanism
// for. It ships creator-or-admin today, same as every other CanContribute
// call site, so nothing changes on day one -- widening it later (the
// tenth visitor who actually knows the directions are bad, not the crag's
// original creator) is a one-line change in authz, not here.
func CreateApproach(ctx context.Context, userID, cragID, name, startType string, durationMinutes *int, steps []CreateApproachStepInput) (*Approach, error) {
	if err := validateStartType(startType); err != nil {
		return nil, err
	}
	if err := validateSteps(steps); err != nil {
		return nil, err
	}

	cragCreatedBy, err := getCragCreator(ctx, cragID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCragNotFound
	}
	if err != nil {
		return nil, err
	}

	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !authz.CanContribute(userID, authz.KindAddApproach, cragCreatedBy, titles) {
		return nil, ErrForbidden
	}

	return createApproach(ctx, cragID, name, startType, durationMinutes, steps, userID)
}

// DeleteApproach is the removal path handoff.md decision 22 requires
// alongside every additive mechanism: the approach's own creator, or an
// admin -- ordinary ownership, not the widen-later CanContribute mechanism
// (removing your own contribution isn't "adding to someone else's").
func DeleteApproach(ctx context.Context, userID, approachID string) error {
	createdBy, err := getApproachCreator(ctx, approachID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}
	if !authz.CanEditOwned(userID, createdBy, titles) {
		return ErrForbidden
	}

	return deleteApproachRow(ctx, approachID)
}
