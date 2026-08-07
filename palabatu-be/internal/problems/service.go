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

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
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

	return createProblem(ctx, name, grade, boulderID, cragID, firstAscensionist, discoveredBy, landingHazards, descent, notes, heightM, createdBy)
}

func UpdateProblem(
	ctx context.Context,
	userID, problemID, name, grade, firstAscensionist, discoveredBy, landingHazards, descent, notes string,
	heightM *float64,
) (*ProblemRow, error) {
	if err := validateGrade(grade); err != nil {
		return nil, err
	}

	createdBy, err := getProblemCreator(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := authorizeProblemEdit(ctx, userID, createdBy); err != nil {
		return nil, err
	}

	row, err := updateProblemRow(ctx, problemID, name, grade, firstAscensionist, discoveredBy, landingHazards, descent, notes, heightM)
	if err != nil {
		return nil, err
	}

	notifyProblemEdited(ctx, createdBy, userID, problemID, row.Name)

	return row, nil
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
