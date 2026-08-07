package boulders

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/notification"
)

// mergeHoldDuration guarantees the two boulder creators actually get a
// chance to object before a merge can execute -- an admin resolving
// instantly would make that window theoretical (handoff.md merge design
// note 5). Admins can bypass it via ResolveMergeRequest's overrideHold for
// obvious cases; rejecting a bad suggestion needs no wait at all.
const mergeHoldDuration = 48 * time.Hour

var validMergeActions = map[string]bool{"merge": true, "reject": true}

// requireAdmin mirrors report.requireAdmin exactly -- this package is the
// second to call authz.IsAdmin directly rather than authz.CanEditOwned,
// since reviewing/resolving a merge request isn't "owned" by anyone.
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

// SuggestMerge is "these are the same rock" -- open to any signed-in user.
// Executing a merge is the separate, admin-only step in
// ResolveMergeRequest.
func SuggestMerge(ctx context.Context, userID, sourceBoulderID, targetBoulderID, reason string) (*MergeRequest, error) {
	if sourceBoulderID == targetBoulderID {
		return nil, ErrCannotMergeSelf
	}

	request, err := createMergeRequest(ctx, sourceBoulderID, targetBoulderID, userID, reason)
	if err != nil {
		return nil, err
	}

	notifyMergeSuggested(ctx, sourceBoulderID, targetBoulderID, userID)

	return request, nil
}

// ObjectToMerge is "this is not the same rock" -- only the source or
// target boulder's own creator may file one (handoff.md merge design note
// 3); it informs the admin's decision without vetoing it.
func ObjectToMerge(ctx context.Context, userID, requestID, body string) (*MergeObjection, error) {
	sourceBoulderID, targetBoulderID, _, status, _, err := getMergeRequestTarget(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status != "pending" {
		return nil, ErrAlreadyResolved
	}

	sourceCreator, err := getBoulderCreator(ctx, sourceBoulderID)
	if err != nil {
		return nil, err
	}
	targetCreator, err := getBoulderCreator(ctx, targetBoulderID)
	if err != nil {
		return nil, err
	}
	isSourceCreator := sourceCreator != nil && *sourceCreator == userID
	isTargetCreator := targetCreator != nil && *targetCreator == userID
	if !isSourceCreator && !isTargetCreator {
		return nil, ErrNotMergeCreator
	}

	objection, err := createObjection(ctx, requestID, userID, body)
	if err != nil {
		return nil, err
	}

	notifyMergeObjected(ctx, userID)

	return objection, nil
}

func ListPendingMergeRequests(ctx context.Context, userID string) ([]MergeRequestListItem, error) {
	if err := requireAdmin(ctx, userID); err != nil {
		return nil, err
	}
	return listPendingMergeRequests(ctx)
}

// ListPendingMergeRequestsForBoulder is the boulder-creator-visible
// counterpart to ListPendingMergeRequests above: the admin-wide listing is
// deliberately admin-only, which left a boulder's own creator with no way
// to ever see a request filed against their rock -- and therefore no way
// to exercise the objection right handoff.md's merge design describes.
// Scoped to one boulder, gated the same creator-or-admin way as every other
// per-boulder action (authorizeBoulderEdit, service.go).
func ListPendingMergeRequestsForBoulder(ctx context.Context, userID, boulderID string) ([]MergeRequestListItem, error) {
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
	return listPendingMergeRequestsForBoulder(ctx, boulderID)
}

// ResolveMergeRequest is the admin-only step that actually executes (or
// rejects) a suggested merge. Rejecting needs no wait; merging is blocked
// until the 48h objection window closes, unless overrideHold is set for an
// obvious case. Which boulder survives is always the admin's explicit
// pick, never automatic (handoff.md merge design note 5) -- the
// already-resolved guard mirrors report.Resolve's identical pattern.
func ResolveMergeRequest(ctx context.Context, adminID, requestID, action, survivorID string, overrideHold bool) error {
	if !validMergeActions[action] {
		return ErrInvalidAction
	}
	if err := requireAdmin(ctx, adminID); err != nil {
		return err
	}

	sourceBoulderID, targetBoulderID, suggestedBy, status, createdAt, err := getMergeRequestTarget(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status != "pending" {
		return ErrAlreadyResolved
	}

	if action == "reject" {
		if err := markMergeRequestStatus(ctx, requestID, "rejected", adminID); err != nil {
			return err
		}
		notifyMergeResolved(ctx, suggestedBy, sourceBoulderID, targetBoulderID, false)
		return nil
	}

	// action == "merge"
	if survivorID != sourceBoulderID && survivorID != targetBoulderID {
		return ErrInvalidSurvivor
	}
	if !overrideHold && time.Since(createdAt) < mergeHoldDuration {
		return ErrHoldNotExpired
	}

	loserID := sourceBoulderID
	if survivorID == sourceBoulderID {
		loserID = targetBoulderID
	}

	if err := repointProblemsToSurvivor(ctx, loserID, survivorID); err != nil {
		return err
	}
	if err := unionBoulderImages(ctx, loserID, survivorID); err != nil {
		return err
	}
	if err := markMergeRequestStatus(ctx, requestID, "merged", adminID); err != nil {
		return err
	}

	notifyMergeResolved(ctx, suggestedBy, sourceBoulderID, targetBoulderID, true)
	return nil
}

// notifyMergeSuggested fans out to every admin, both boulders' creators,
// and every problem's creator on both boulders -- best-effort, mirroring
// every other Notify* call site in this codebase (a failed notification
// write must never fail the underlying action). No new batch-insert
// primitive: this is a plain loop over notification.NotifyMergeSuggested,
// same one-recipient-per-call shape as everything else in that package.
func notifyMergeSuggested(ctx context.Context, sourceBoulderID, targetBoulderID, actorID string) {
	actor, err := auth.GetProfile(ctx, actorID)
	if err != nil {
		return
	}
	actorUsername := "Someone"
	if actor.Username != nil {
		actorUsername = *actor.Username
	}

	recipients := map[string]bool{}
	if admins, err := auth.GetAdminUserIDs(ctx); err == nil {
		for _, id := range admins {
			recipients[id] = true
		}
	} else {
		log.Printf("failed to list admins for merge-suggested notification: %v", err)
	}
	for _, boulderID := range []string{sourceBoulderID, targetBoulderID} {
		if createdBy, err := getBoulderCreator(ctx, boulderID); err == nil && createdBy != nil {
			recipients[*createdBy] = true
		}
		if ids, err := problemCreatorsOnBoulder(ctx, boulderID); err == nil {
			for _, id := range ids {
				recipients[id] = true
			}
		}
	}
	delete(recipients, actorID)

	for recipientID := range recipients {
		if err := notification.NotifyMergeSuggested(ctx, recipientID, actorID, actorUsername); err != nil {
			log.Printf("failed to create merge-suggested notification: %v", err)
		}
	}
}

// notifyMergeObjected tells every admin an objection was filed, so it's
// visible on the request before anyone resolves it.
func notifyMergeObjected(ctx context.Context, actorID string) {
	actor, err := auth.GetProfile(ctx, actorID)
	if err != nil {
		return
	}
	actorUsername := "Someone"
	if actor.Username != nil {
		actorUsername = *actor.Username
	}

	admins, err := auth.GetAdminUserIDs(ctx)
	if err != nil {
		log.Printf("failed to list admins for merge-objected notification: %v", err)
		return
	}
	for _, adminID := range admins {
		if err := notification.NotifyMergeObjected(ctx, adminID, actorID, actorUsername); err != nil {
			log.Printf("failed to create merge-objected notification: %v", err)
		}
	}
}

// notifyMergeResolved tells the suggester and both boulders' creators the
// outcome, either way (handoff.md merge-flow section).
func notifyMergeResolved(ctx context.Context, suggestedBy *string, sourceBoulderID, targetBoulderID string, merged bool) {
	recipients := map[string]bool{}
	if suggestedBy != nil {
		recipients[*suggestedBy] = true
	}
	for _, boulderID := range []string{sourceBoulderID, targetBoulderID} {
		if createdBy, err := getBoulderCreator(ctx, boulderID); err == nil && createdBy != nil {
			recipients[*createdBy] = true
		}
	}

	for recipientID := range recipients {
		if err := notification.NotifyMergeResolved(ctx, recipientID, merged); err != nil {
			log.Printf("failed to create merge-resolved notification: %v", err)
		}
	}
}
