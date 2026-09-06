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
	"palabatu-be/internal/photocredits"
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

	// Single-spot fetch only, never listCrags -- see boulders.GetBoulder.
	credits, err := photocredits.List(ctx, photocredits.KindCrag, id)
	if err != nil {
		return nil, err
	}
	c.ImageCredits = credits

	return c, nil
}

// CreateCrag has no role gate: any signed-in user may add a crag
// (handoff.md decision 6) -- adding is open, editing an existing crag stays
// with its creator or an admin.
func CreateCrag(ctx context.Context, createdBy, name string, lat, lng float64, directions, accessNotes string, imageURLs []string) (*Crag, error) {
	if err := validateName(name); err != nil {
		return nil, err
	}
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}
	return createCrag(ctx, name, lat, lng, directions, accessNotes, imageURLs, createdBy)
}

func UpdateCrag(ctx context.Context, userID, cragID, name string, lat, lng float64, directions, accessNotes string) (*Crag, error) {
	if err := validateName(name); err != nil {
		return nil, err
	}
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

	crag, err := addCragImages(ctx, cragID, imageURLs)
	if err != nil {
		return nil, err
	}

	// Credit the uploader, mirroring boulders.AddBoulderImages -- see
	// internal/photocredits and handoff.md open item 11.
	if err := photocredits.Record(ctx, photocredits.KindCrag, cragID, userID, imageURLs); err != nil {
		return nil, err
	}

	return crag, nil
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

	if err := authorizeCragImageDelete(ctx, userID, cragID, createdBy, imageURL); err != nil {
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

	if err := removeCragImage(ctx, cragID, imageURL); err != nil {
		return err
	}

	// Best-effort, mirroring the Cloudinary destroy above.
	if err := photocredits.Remove(ctx, photocredits.KindCrag, cragID, imageURL); err != nil {
		log.Printf("failed to delete photo credit: %v", err)
	}
	return nil
}

// DeleteCrag removes an empty crag outright, admin-only. This is the cure
// half of handoff.md open item 8: duplicate spots have no merge flow, so
// the resolution is that an admin re-parents every rock off the duplicate
// (decision 13's UpdateBoulder crag_id) and then deletes the emptied husk.
// Deliberately not a merge: nothing is moved or rewritten here, and the
// item's own narrowed recommendation is "the cheap half rather than a full
// merge flow" -- no new tables, no notification types, no objection hold.
//
// Admin-only rather than creator-or-admin, because this is a cleanup
// operation on somebody else's mess rather than an edit of your own row --
// same reasoning (and the same authz.IsAdmin call) as resolving a boulder
// merge, which is not "owned" by anyone either. A creator who wants their
// own empty spot gone can ask an admin; the alternative is handing every
// user a button that permanently removes a map pin other people may have
// started using.
//
// "Empty" means no rocks, no problems, and no approach guides. See
// getCragDeleteCheck for why all three are checked and why an approach
// counts as content worth blocking on -- the admin's path forward there is
// DELETE /approaches/:id, which already exists and which admins can call.
func DeleteCrag(ctx context.Context, userID, cragID string) error {
	if err := requireAdmin(ctx, userID); err != nil {
		return err
	}

	check, err := getCragDeleteCheck(ctx, cragID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if check.boulderCount > 0 || check.problemCount > 0 || check.approachCount > 0 {
		return ErrCragNotEmpty
	}

	// Best-effort, matching DeleteCragImage and boulders.DeleteBoulderImage:
	// a Cloudinary failure is logged, never fatal. The row going away is the
	// operation; an orphaned asset is a cost, not a reason to leave a
	// duplicate spot on the map.
	for _, url := range check.imageURLs {
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("failed to delete crag image from Cloudinary: %v", err)
		}
	}
	if err := photocredits.RemoveEntity(ctx, photocredits.KindCrag, cragID); err != nil {
		log.Printf("failed to delete crag photo credits: %v", err)
	}

	return deleteCragRow(ctx, cragID)
}

// requireAdmin mirrors report.requireAdmin and boulders.requireAdmin --
// the third package to call authz.IsAdmin directly rather than
// authz.CanEditOwned, for the same reason both of those do: deleting
// somebody else's duplicate spot isn't an act of ownership.
func requireAdmin(ctx context.Context, userID string) error {
	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}
	if !authz.IsAdmin(titles) {
		return ErrForbidden
	}
	return nil
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

// authorizeCragImageDelete allows the crag's creator or an admin (unchanged
// authorizeCragEdit), or -- handoff.md item 15 -- the contributor who
// uploaded this exact photo, to remove it. Crag photos are never annotated
// (a topo line only ever references a boulder's image_urls, never a crag's),
// so unlike boulders this needs no further guard.
func authorizeCragImageDelete(ctx context.Context, userID, cragID string, createdBy *string, imageURL string) error {
	if err := authorizeCragEdit(ctx, userID, createdBy); err == nil {
		return nil
	}
	uploadedBy, err := photocredits.UploadedBy(ctx, photocredits.KindCrag, cragID, imageURL)
	if err != nil {
		return err
	}
	if uploadedBy != nil && *uploadedBy == userID {
		return nil
	}
	return ErrForbidden
}
