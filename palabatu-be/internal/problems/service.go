// Package problems owns the bottom level of the crags -> boulders ->
// problems hierarchy: one way up a rock. Photos, coordinates, and topo
// annotation now live on internal/boulders (see handoff.md at the repo
// root) -- this package only reaches into boulders' table with its own
// direct SQL (getBoulderCragAndType, repository.go) to resolve a new problem's
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
	"palabatu-be/internal/photocredits"
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

	// The beta/action shots this problem owns, not the boulder's topo -- that
	// photo belongs to the rock and carries the rock's credits (see
	// boulders.GetBoulder). Single-problem fetch only, never listProblems.
	credits, err := photocredits.List(ctx, photocredits.KindProblem, id)
	if err != nil {
		return nil, err
	}
	p.ImageCredits = credits

	// Always sent, empty for a single-pitch route. Whether to show it is the
	// frontend's call (a wall shows pitch detail, a boulder hides it), so this
	// returns whatever is stored.
	pitches, err := listPitches(ctx, id)
	if err != nil {
		return nil, err
	}
	p.Pitches = pitches

	return p, nil
}

// CreateProblem intentionally has no role gate: any logged-in user may add a
// problem for now. boulder_id is required; crag_id is derived from it
// rather than trusted from the client (handoff.md decision 5). Pitch detail is
// accepted only on a wall, and pitch rows only alongside a pitch count.
func CreateProblem(ctx context.Context, createdBy string, req CreateProblemRequest) (*ProblemSummary, error) {
	if err := validateName(req.Name); err != nil {
		return nil, err
	}
	if err := validateGrade(req.Grade); err != nil {
		return nil, err
	}
	if err := validatePitchCount(req.PitchCount); err != nil {
		return nil, err
	}
	if err := validateCommitmentGrade(req.CommitmentGrade); err != nil {
		return nil, err
	}
	if err := validatePitches(req.Pitches); err != nil {
		return nil, err
	}

	cragID, boulderType, err := getBoulderCragAndType(ctx, req.BoulderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBoulderNotFound
	}
	if err != nil {
		return nil, err
	}

	if req.PitchCount != nil || req.CommitmentGrade != "" || len(req.Pitches) > 0 {
		if boulderType != "wall" {
			return nil, ErrPitchesOnBoulder
		}
	}
	if len(req.Pitches) > 0 && req.PitchCount == nil {
		return nil, ErrPitchesNeedCount
	}

	return createProblem(ctx, req, cragID, createdBy)
}

// UpdateProblem also re-parents the problem to a different boulder when
// req.BoulderID is non-empty and differs from its current one (handoff.md
// decision 13) -- the missing inverse of "not sure which rock". Doing so
// drops every annotation this problem had (reparentProblem, repository.go):
// a line drawn on the old rock's photo means nothing on the new one, and
// silently keeping it pointed at the wrong photo is worse than losing it.
//
// A field the request leaves out keeps the problem's current value, so a
// client that only knows some of them (the move button sends just a
// boulder_id) cannot wipe the rest. Unlike UpdateBoulder this is done in SQL
// (updateProblemRow) rather than by reading the row back in and writing it out
// again: a read-then-write would put back, as the "kept" value, whatever was
// current when it read, which is the lost update this exists to avoid.
func UpdateProblem(ctx context.Context, userID, problemID string, req UpdateProblemRequest) (*ProblemRow, error) {
	if req.Name != nil {
		if err := validateName(*req.Name); err != nil {
			return nil, err
		}
	}
	if req.Grade != nil {
		if err := validateGrade(*req.Grade); err != nil {
			return nil, err
		}
	}
	if err := validatePitchCount(req.PitchCount); err != nil {
		return nil, err
	}
	if req.CommitmentGrade != nil {
		if err := validateCommitmentGrade(*req.CommitmentGrade); err != nil {
			return nil, err
		}
	}
	if err := validatePitches(req.Pitches); err != nil {
		return nil, err
	}

	createdBy, currentBoulderID, currentPitchCount, err := getProblemForUpdate(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	// Refuse pitch detail on a boulder, checked against the rock the route
	// will be on once this request is applied. Clearing is never refused, and
	// nothing is deleted here: a route moved onto a boulder keeps its stored
	// pitch detail hidden and gets it back if it moves to a wall again.
	targetBoulderID := currentBoulderID
	if req.BoulderID != "" {
		targetBoulderID = req.BoulderID
	}
	if req.PitchCount != nil || (req.CommitmentGrade != nil && *req.CommitmentGrade != "") || len(req.Pitches) > 0 {
		boulderType, err := getBoulderType(ctx, targetBoulderID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBoulderNotFound
		}
		if err != nil {
			return nil, err
		}
		if boulderType != "wall" {
			return nil, ErrPitchesOnBoulder
		}
	}
	if len(req.Pitches) > 0 {
		effectivePitchCount := currentPitchCount
		if req.HasPitchCount {
			effectivePitchCount = req.PitchCount
		}
		if effectivePitchCount == nil {
			return nil, ErrPitchesNeedCount
		}
	}

	if req.BoulderID != "" && req.BoulderID != currentBoulderID {
		if err := reparentProblem(ctx, problemID, req.BoulderID); err != nil {
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

	row, err := updateProblemRow(ctx, problemID, req)
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

	problem, err := addProblemImages(ctx, problemID, imageURLs)
	if err != nil {
		return nil, err
	}

	// Credit the uploader, mirroring boulders.AddBoulderImages -- see
	// internal/photocredits and handoff.md open item 11.
	if err := photocredits.Record(ctx, photocredits.KindProblem, problemID, userID, imageURLs); err != nil {
		return nil, err
	}

	return problem, nil
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

	if err := authorizeProblemImageDelete(ctx, userID, problemID, createdBy, imageURL); err != nil {
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

	if err := removeProblemImage(ctx, problemID, imageURL); err != nil {
		return err
	}

	// Best-effort, mirroring the Cloudinary destroy above.
	if err := photocredits.Remove(ctx, photocredits.KindProblem, problemID, imageURL); err != nil {
		log.Printf("failed to delete photo credit: %v", err)
	}
	return nil
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

// authorizeProblemImageDelete allows the problem's creator or an admin
// (unchanged authorizeProblemEdit), or -- handoff.md item 15 -- the
// contributor who uploaded this exact photo, to remove it. These are the
// problem's own beta/action shots, never the boulder's shared topo -- a
// topo line only ever references a boulder's image_urls, never a problem's
// own -- so unlike boulders this needs no further guard.
func authorizeProblemImageDelete(ctx context.Context, userID, problemID string, createdBy *string, imageURL string) error {
	if err := authorizeProblemEdit(ctx, userID, createdBy); err == nil {
		return nil
	}
	uploadedBy, err := photocredits.UploadedBy(ctx, photocredits.KindProblem, problemID, imageURL)
	if err != nil {
		return err
	}
	if uploadedBy != nil && *uploadedBy == userID {
		return nil
	}
	return ErrForbidden
}
