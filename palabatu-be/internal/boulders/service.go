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
	"palabatu-be/internal/photocredits"
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

	// Credits are attached on the single-rock fetch only, never on
	// ListBoulders -- a photo-grid of rocks would pay one extra query per
	// tile for a line nobody reads at that size.
	credits, err := photocredits.List(ctx, photocredits.KindBoulder, id)
	if err != nil {
		return nil, err
	}
	b.ImageCredits = credits

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
func CreateBoulder(ctx context.Context, createdBy, cragID, name, boulderType, rockType string, lat, lng *float64, imageURLs []string, filedUncertain *bool) (*Boulder, error) {
	if err := validateName(name); err != nil {
		return nil, err
	}
	if err := validateLatLng(lat, lng); err != nil {
		return nil, err
	}
	normalizedType, err := normalizeBoulderType(boulderType)
	if err != nil {
		return nil, err
	}

	b, err := createBoulder(ctx, cragID, name, normalizedType, rockType, lat, lng, imageURLs, createdBy, filedUncertain)
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
//
// A field the request leaves out keeps the rock's current value, so a client
// that only knows some of them cannot wipe the rest. updateBoulderRow writes
// every column, which is why the keeping is done here, once, by reading the
// current row back in.
func UpdateBoulder(ctx context.Context, userID, boulderID string, req UpdateBoulderRequest) (*Boulder, error) {
	if req.Name != nil {
		if err := validateName(*req.Name); err != nil {
			return nil, err
		}
	}
	if err := validateLatLng(req.Lat, req.Lng); err != nil {
		return nil, err
	}
	// An empty type means "leave as is" here, unlike creation, where it
	// defaults to a boulder: a blank field must not demote a wall.
	newType := ""
	if req.Type != nil && *req.Type != "" {
		var err error
		if newType, err = normalizeBoulderType(*req.Type); err != nil {
			return nil, err
		}
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

	if req.CragID != "" && req.CragID != current.CragID {
		if err := reparentBoulder(ctx, boulderID, req.CragID); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.ConstraintName == "boulders_crag_id_fkey" {
				return nil, ErrCragNotFound
			}
			return nil, err
		}
	}

	name, rockType, boulderType := current.Name, current.RockType, current.Type
	lat, lng := current.Lat, current.Lng
	if req.Name != nil {
		name = req.Name
	}
	if req.RockType != nil {
		rockType = req.RockType
	}
	if newType != "" {
		boulderType = newType
	}
	if req.HasCoords {
		lat, lng = req.Lat, req.Lng
	}

	return updateBoulderRow(ctx, boulderID, name, boulderType, rockType, lat, lng)
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

	boulder, err := addBoulderImages(ctx, boulderID, imageURLs)
	if err != nil {
		return nil, err
	}

	// Credit the uploader (handoff.md decision 22 / open item 11). Recorded
	// even while the policy is still creator-or-admin, so the window where a
	// photo's origin has to be inferred stays historical rather than growing.
	if err := photocredits.Record(ctx, photocredits.KindBoulder, boulderID, userID, imageURLs); err != nil {
		return nil, err
	}

	return boulder, nil
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

	if err := authorizeBoulderImageDelete(ctx, userID, boulderID, createdBy, imageURL); err != nil {
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

	// Same best-effort treatment: the credit describes a photo that no longer
	// exists, and nothing else would ever clean it up (no FK can point at an
	// element inside a jsonb array).
	if err := photocredits.Remove(ctx, photocredits.KindBoulder, boulderID, imageURL); err != nil {
		log.Printf("failed to delete photo credit: %v", err)
	}
	return nil
}

// ListAnnotationsForBoulder returns every problem-on-this-boulder's
// annotation rows together -- the concrete payoff of the photo now living
// on the boulder: one photo, every problem's line drawn on it at once.
func ListAnnotationsForBoulder(ctx context.Context, boulderID string) ([]BoulderAnnotation, error) {
	return listAnnotationsForBoulder(ctx, boulderID)
}

// DeleteBoulder removes a rock that has no problems on it, creator-or-
// admin -- the same policy as editing it, and as problems.DeleteProblem
// applies one level down.
//
// Until this existed the middle level of the hierarchy had no delete at
// all: a junk rock could be created by anyone (handoff.md decision 6) and
// nothing could remove it. The merge flow was the only corrective
// operation, and merging is the wrong tool for junk -- it needs a plausible
// target rock to fold into, and "these are the same rock" is a claim about
// two real rocks, not a way to dispose of one bad row.
//
// Empty-only for the same reason crags.DeleteCrag is: problems.boulder_id
// is NO ACTION, so a rock with problems on it cannot be deleted without
// destroying them, and destroying somebody's documented lines is a purge,
// not a delete. The way out for a rock that does have problems is
// decision 13's re-parenting -- move them to the right rock first -- or, if
// the whole spot is junk, crags.PurgeCrag.
func DeleteBoulder(ctx context.Context, userID, boulderID string) error {
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

	count, err := countProblemsOnBoulder(ctx, boulderID)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrHasProblems
	}

	if err := deleteBoulderRow(ctx, boulderID); err != nil {
		return err
	}

	// After the row is gone, and best-effort, matching DeleteBoulderImage:
	// nothing else will ever clean these up, since a database cascade runs
	// no Go and the URLs live only on the row just deleted.
	for _, url := range imageURLs {
		if err := cloudinary.DestroyByURL(ctx, url); err != nil {
			log.Printf("failed to delete boulder image from Cloudinary: %v", err)
		}
	}
	if err := photocredits.RemoveEntity(ctx, photocredits.KindBoulder, boulderID); err != nil {
		log.Printf("failed to delete boulder photo credits: %v", err)
	}

	return nil
}

// ListNeedsAttention backs the admin tidy-up queue (handoff.md open item 9).
// Admin-only via the same requireAdmin the merge resolution uses: this is a
// moderation surface over everybody's rocks, not something anyone owns.
func ListNeedsAttention(ctx context.Context, userID string) ([]NeedsAttentionItem, error) {
	if err := requireAdmin(ctx, userID); err != nil {
		return nil, err
	}
	return listNeedsAttention(ctx)
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

// authorizeBoulderImageDelete allows the rock's creator, or -- handoff.md
// item 15 -- the contributor who uploaded this exact photo, to remove it,
// and an admin always. Unlike crags and problems, this needs a second
// guard: a rock's photo is the shared topo canvas every problem on it draws
// its line against (item 16), so deleting it could take down annotations
// belonging to problems the deleter has no relationship to. Creator and
// uploader alike are refused whenever some problem they don't own has a
// line on this exact photo; only an admin can force it through then
// (item 18, mirroring the merge hold's admin override).
func authorizeBoulderImageDelete(ctx context.Context, userID, boulderID string, createdBy *string, imageURL string) error {
	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}
	if authz.IsAdmin(titles) {
		return nil
	}
	if !authz.CanEditOwned(userID, createdBy, titles) {
		uploadedBy, err := photocredits.UploadedBy(ctx, photocredits.KindBoulder, boulderID, imageURL)
		if err != nil {
			return err
		}
		if uploadedBy == nil || *uploadedBy != userID {
			return ErrForbidden
		}
	}
	foreign, err := hasForeignAnnotation(ctx, boulderID, imageURL, userID)
	if err != nil {
		return err
	}
	if foreign {
		return ErrForbidden
	}
	return nil
}
