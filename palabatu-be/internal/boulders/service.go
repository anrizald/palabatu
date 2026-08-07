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

// CreateBoulder has no role gate: any signed-in user may add a boulder to
// any crag, including someone else's (handoff.md decision 6).
func CreateBoulder(ctx context.Context, createdBy, cragID, name, rockType string, lat, lng *float64, imageURLs []string) (*Boulder, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}

	b, err := createBoulder(ctx, cragID, name, rockType, lat, lng, imageURLs, createdBy)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.ConstraintName == "boulders_crag_id_fkey" {
			return nil, ErrCragNotFound
		}
		return nil, err
	}
	return b, nil
}

func UpdateBoulder(ctx context.Context, userID, boulderID, name, rockType string, lat, lng *float64) (*Boulder, error) {
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}

	createdBy, err := getBoulderCreator(ctx, boulderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeBoulderEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	return updateBoulderRow(ctx, boulderID, name, rockType, lat, lng)
}

// AddBoulderImages authorizes and appends already-uploaded image URLs (from
// POST /upload/topo) to a boulder's image_urls array -- moved here
// verbatim from problems.AddProblemImages now that the photo belongs to
// the boulder, not the problem.
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

	if err := authorizeBoulderEdit(ctx, userID, createdBy); err != nil {
		return nil, err
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
