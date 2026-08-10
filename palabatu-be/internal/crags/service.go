// Package crags owns the top level of the crags -> boulders -> problems
// hierarchy: the place you drive to and park at. Admin-role policy itself
// lives in internal/authz, not here.
package crags

import (
	"context"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/cloudinary"
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
func CreateCrag(ctx context.Context, createdBy, name string, lat, lng float64, directions, accessNotes string, imageURLs []string) (*Crag, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}
	return createCrag(ctx, name, lat, lng, directions, accessNotes, imageURLs, createdBy)
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

// AddCragImages authorizes and appends already-uploaded image URLs (from
// POST /upload/topo) to a crag's image_urls array -- the approach shot,
// mirroring boulders.AddBoulderImages. Gated through authz.CanContribute
// rather than authorizeCragEdit directly (handoff.md decision 22: adding a
// photo is additive, so it's the mechanism that can later widen past
// creator-or-admin without touching this call site).
func AddCragImages(ctx context.Context, userID, cragID string, imageURLs []string) (*Crag, error) {
	if len(imageURLs) == 0 {
		return nil, ErrNoImages
	}

	createdBy, err := getCragCreator(ctx, cragID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !authz.CanContribute(userID, authz.KindAddPhoto, createdBy, titles) {
		return nil, ErrForbidden
	}

	return addCragImages(ctx, cragID, imageURLs)
}

// DeleteCragImage authorizes and removes a single image from a crag's
// image_urls array (the crag's creator or an admin), best-effort
// destroying its Cloudinary asset -- mirrors boulders.DeleteBoulderImage
// minus the annotation cleanup (crag photos aren't annotatable).
func DeleteCragImage(ctx context.Context, userID, cragID, imageURL string) error {
	createdBy, imageURLs, err := getCragOwnerAndImages(ctx, cragID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if err := authorizeCragEdit(ctx, userID, createdBy); err != nil {
		return err
	}

	found := false
	for _, url := range imageURLs {
		if url == imageURL {
			found = true
			break
		}
	}
	if !found {
		return ErrImageNotFound
	}

	if err := cloudinary.DestroyByURL(ctx, imageURL); err != nil {
		log.Printf("failed to delete image from Cloudinary: %v", err)
	}

	return removeCragImage(ctx, cragID, imageURL)
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
