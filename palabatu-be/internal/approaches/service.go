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
	"log"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/cloudinary"
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
//
// The step photos are destroyed in Cloudinary first. An approach is
// nothing but photographs -- decision 21's "each a photo plus one line" --
// so deleting one without this orphaned every image it was made of, which
// is the largest per-row leak in the app rather than a stray avatar. This
// is the only path that reaches it: crags.DeleteCrag refuses outright
// while a crag still has approaches, precisely so approaches_crag_id_fkey's
// ON DELETE CASCADE can never silently take a jalan masuk (and its photos)
// with it.
func DeleteApproach(ctx context.Context, userID, approachID string) error {
	createdBy, stepPhotoURLs, err := getApproachOwnerAndStepPhotos(ctx, approachID)
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

	// Best-effort, matching crags.DeleteCrag and boulders.DeleteBoulderImage:
	// a Cloudinary failure is logged, never fatal. The row going away is the
	// operation; an orphaned asset is a cost, not a reason to refuse someone
	// the removal of their own contribution.
	for _, url := range stepPhotoURLs {
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("failed to delete approach step photo from Cloudinary: %v", err)
		}
	}

	return deleteApproachRow(ctx, approachID)
}
