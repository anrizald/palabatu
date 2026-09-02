// Package boulders owns the middle level of the crags -> boulders ->
// problems hierarchy: one rock, the thing a climber actually touches, and
// the photo(s) problems on it draw their lines on. It also owns the
// boulder-merge sub-flow (merge.go/merge_repository.go/merge_handler.go) --
// duplicate rocks are expected (see those files), not a separate domain.
// Admin-role policy itself lives in internal/authz, not here.
package boulders

import (
	"context"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/cloudinary"
)

func ListBoulders(ctx context.Context, cragID string) ([]BoulderListItem, error) {
	return listBoulders(ctx, cragID)
}

func GetBoulder(ctx context.Context, id string) (*BoulderListItem, error) {
	b, err := getBoulder(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

// validBoulderTypes are the only values boulders.type accepts (handoff.md
// decision 1: the middle level is a rock *or* a wall). Empty defaults to
// "boulder" so every pre-existing caller (and every migrated row) keeps
// working unchanged.
var validBoulderTypes = map[string]bool{"boulder": true, "wall": true}

func normalizeBoulderType(t string) (string, error) {
	if t == "" {
		return "boulder", nil
	}
	if !validBoulderTypes[t] {
		return "", ErrInvalidType
	}
	return t, nil
}

// CreateBoulder has no role gate: any signed-in user may add a boulder to
// any crag, including someone else's (handoff.md decision 6).
func CreateBoulder(ctx context.Context, createdBy, cragID, name, boulderType, rockType string, lat, lng *float64, imageURLs []string) (*Boulder, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}
	normalizedType, err := normalizeBoulderType(boulderType)
	if err != nil {
		return nil, err
	}

	b, err := createBoulder(ctx, cragID, name, normalizedType, rockType, lat, lng, imageURLs, createdBy)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "boulders_crag_id_fkey" {
			return nil, ErrCragNotFound
		}
		return nil, err
	}
	return b, nil
}

// UpdateBoulder also re-parents the boulder to a different crag when cragID
// is non-empty and differs from its current one (handoff.md decision 13) --
// the missing inverse of "not sure which rock", now real. Re-parenting
// cascades the denormalized crag_id onto every problem already on this
// boulder (reparentBoulder, repository.go).
func UpdateBoulder(ctx context.Context, userID, boulderID, cragID, name, boulderType, rockType string, lat, lng *float64) (*Boulder, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}
	normalizedType, err := normalizeBoulderType(boulderType)
	if err != nil {
		return nil, err
	}

	current, err := getBoulder(ctx, boulderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeBoulderEdit(ctx, userID, current.CreatedBy); err != nil {
		return nil, err
	}

	if cragID != "" && cragID != current.CragID {
		if err := reparentBoulder(ctx, boulderID, cragID); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.ConstraintName == "boulders_crag_id_fkey" {
				return nil, ErrCragNotFound
			}
			return nil, err
		}
	}

	return updateBoulderRow(ctx, boulderID, name, normalizedType, rockType, lat, lng)
}

// AddBoulderImages authorizes and appends already-uploaded image URLs (from
// POST /upload/topo) to a boulder's image_urls array -- moved here
// verbatim from problems.AddProblemImages now that the photo belongs to
// the boulder, not the problem. Gated through authz.CanContribute rather
// than authorizeBoulderEdit directly (handoff.md decision 22: adding a
// photo is additive, so it's the mechanism that can later widen past
// creator-or-admin without touching this call site).
func AddBoulderImages(ctx context.Context, userID, boulderID string, imageURLs []string) (*Boulder, error) {
	if len(imageURLs) == 0 {
		return nil, ErrNoImages
	}

	createdBy, err := getBoulderCreator(ctx, boulderID)
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

	return addBoulderImages(ctx, boulderID, imageURLs)
}

// DeleteBoulderImage authorizes and removes a single image from a
// boulder's image_urls array (the boulder's creator or an admin),
// best-effort destroying its Cloudinary asset and every problem-on-this-
// boulder's annotation on that image.
func DeleteBoulderImage(ctx context.Context, userID, boulderID, imageURL string) error {
	createdBy, imageURLs, err := getBoulderOwnerAndImages(ctx, boulderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if err := authorizeBoulderEdit(ctx, userID, createdBy); err != nil {
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

	if err := removeBoulderImage(ctx, boulderID, imageURL); err != nil {
		return err
	}

	// Best-effort, mirroring the Cloudinary destroy above: every problem on
	// this boulder that had a line drawn on the now-removed photo loses
	// that annotation row too, since nothing can render it against without
	// the image.
	if err := deleteAnnotationsForImage(ctx, boulderID, imageURL); err != nil {
		log.Printf("failed to delete annotations for image: %v", err)
	}
	return nil
}

// ListAnnotationsForBoulder returns every problem-on-this-boulder's
// annotation rows together -- the concrete payoff of the photo now living
// on the boulder: one photo, every problem's line drawn on it at once.
func ListAnnotationsForBoulder(ctx context.Context, boulderID string) ([]BoulderAnnotation, error) {
	return listAnnotationsForBoulder(ctx, boulderID)
}

// authorizeBoulderEdit mirrors problems.authorizeProblemEdit exactly --
// same creator-or-admin policy, applied per domain rather than shared,
// matching this codebase's existing convention.
func authorizeBoulderEdit(ctx context.Context, userID string, createdBy *string) error {
	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}
	if authz.CanEditOwned(userID, createdBy, titles) {
		return nil
	}
	return ErrForbidden
}
