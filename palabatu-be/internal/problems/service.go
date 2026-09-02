// Package problems owns the bottom level of the crags -> boulders ->
// problems hierarchy: one way up a rock. Photos, coordinates, and topo
// annotation now live on internal/boulders (see handoff.md at the repo
// root) -- this package only reaches into boulders' table with its own
// direct SQL (getBoulderCragID, repository.go) to resolve a new problem's
// crag, never by importing internal/boulders' Go package (see that
// package's dependency-direction note). Admin-role policy itself lives in
// internal/authz, not here.
package problems

import (
	"context"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/notification"
)

func ListProblems(ctx context.Context, cragID, boulderID string) ([]ProblemListItem, error) {
	return listProblems(ctx, cragID, boulderID)
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
// problem for now. boulder_id is required; crag_id is derived from it
// rather than trusted from the client (handoff.md decision 5).
func CreateProblem(
	ctx context.Context,
	createdBy, name, grade, boulderID, firstAscensionist, discoveredBy, landingHazards, descent, notes string,
	heightM *float64,
	imageURLs []string,
) (*ProblemSummary, error) {
	if err := validateGrade(grade); err != nil {
		return nil, err
	}

	cragID, err := getBoulderCragID(ctx, boulderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBoulderNotFound
	}
	if err != nil {
		return nil, err
	}

	return createProblem(ctx, name, grade, boulderID, cragID, firstAscensionist, discoveredBy, landingHazards, descent, notes, heightM, imageURLs, createdBy)
}

// UpdateProblem also re-parents the problem to a different boulder when
// boulderID is non-empty and differs from its current one (handoff.md
// decision 13) -- the missing inverse of "not sure which rock". Doing so
// drops every annotation this problem had (reparentProblem, repository.go):
// a line drawn on the old rock's photo means nothing on the new one, and
// silently keeping it pointed at the wrong photo is worse than losing it.
func UpdateProblem(
	ctx context.Context,
	userID, problemID, boulderID, name, grade, firstAscensionist, discoveredBy, landingHazards, descent, notes string,
	heightM *float64,
) (*ProblemRow, error) {
	if err := validateGrade(grade); err != nil {
		return nil, err
	}

	createdBy, currentBoulderID, err := getProblemOwnerAndBoulder(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	if boulderID != "" && boulderID != currentBoulderID {
		if err := reparentProblem(ctx, problemID, boulderID); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.ConstraintName == "problems_boulder_id_fkey" {
				return nil, ErrBoulderNotFound
			}
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrBoulderNotFound
			}
			return nil, err
		}
	}

	row, err := updateProblemRow(ctx, problemID, name, grade, firstAscensionist, discoveredBy, landingHazards, descent, notes, heightM)
	if err != nil {
		return nil, err
	}

	notifyProblemEdited(ctx, createdBy, userID, problemID, row.Name)

	return row, nil
}

// AddProblemImages authorizes and appends already-uploaded image URLs (from
// POST /upload/topo) to a problem's image_urls array -- beta/action shots,
// never the topo base (that stays on the boulder). Gated through
// authz.CanContribute rather than authorizeProblemEdit directly (handoff.md
// decision 22: adding a photo is additive, so it's the mechanism that can
// later widen past creator-or-admin without touching this call site).
func AddProblemImages(ctx context.Context, userID, problemID string, imageURLs []string) (*ProblemRow, error) {
	if len(imageURLs) == 0 {
		return nil, ErrNoImages
	}

	createdBy, _, err := getProblemOwnerAndImages(ctx, problemID)
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

	return addProblemImages(ctx, problemID, imageURLs)
}

// DeleteProblemImage authorizes and removes a single beta/action photo from
// a problem (the problem's creator or an admin), best-effort destroying its
// Cloudinary asset -- mirrors boulders.DeleteBoulderImage minus the
// annotation cleanup (problem photos aren't annotatable, so nothing else
// can be pointing at one).
func DeleteProblemImage(ctx context.Context, userID, problemID, imageURL string) error {
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

	return removeProblemImage(ctx, problemID, imageURL)
}

// DeleteProblem authorizes and removes a problem row. Unlike before the
// photo-ownership move, this no longer destroys any Cloudinary images --
// problems don't own images anymore, and a boulder's shared photos must
// survive any single problem on it being deleted. topo_annotations rows
// for this problem cascade-delete via the FK (migrations/0005).
func DeleteProblem(ctx context.Context, userID, problemID string) error {
	createdBy, err := getProblemCreator(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return err
	}

	// Best-effort, for the deletion notification's message text only — the
	// delete itself must proceed even if this lookup fails.
	var problemName string
	if p, err := GetProblem(ctx, problemID); err == nil {
		problemName = p.Name
	}

	if err := deleteProblemRow(ctx, problemID); err != nil {
		return err
	}

	notifyProblemDeleted(ctx, createdBy, userID, problemName)

	return nil
}

// notifyProblemEdited and notifyProblemDeleted are best-effort, mirroring
// cloudinary.DestroyByURL's precedent elsewhere in this codebase: a failed
// notification write must never fail the edit/delete itself. Both are
// no-ops (checked inside the notification package) when ownerID is nil or
// equals the actor — a Founder editing/deleting their own problem shouldn't
// notify themselves; only an admin acting on someone else's problem should.
func notifyProblemEdited(ctx context.Context, ownerID *string, actorID, problemID, problemName string) {
	actor, err := auth.GetProfile(ctx, actorID)
	if err != nil {
		return
	}
	username := "Someone"
	if actor.Username != nil {
		username = *actor.Username
	}
	if err := notification.NotifyProblemEdited(ctx, ownerID, actorID, username, problemID, problemName); err != nil {
		log.Printf("failed to create problem-edited notification: %v", err)
	}
}

func notifyProblemDeleted(ctx context.Context, ownerID *string, actorID, problemName string) {
	actor, err := auth.GetProfile(ctx, actorID)
	if err != nil {
		return
	}
	username := "Someone"
	if actor.Username != nil {
		username = *actor.Username
	}
	if err := notification.NotifyProblemDeleted(ctx, ownerID, actorID, username, problemName); err != nil {
		log.Printf("failed to create problem-deleted notification: %v", err)
	}
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
