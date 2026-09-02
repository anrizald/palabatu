// Package report owns the moderation queue: users report a comment or a
// problem topo-image, and admins (Council/Associate) dismiss the report or
// remove the offending content. Admin policy itself lives in internal/authz;
// this package is the first to call authz.IsAdmin directly rather than
// authz.CanEditOwned, since reviewing/resolving a report isn't "owned" by
// anyone the way a problem or comment is.
package report

import (
	"context"
	"errors"
	"log"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/boulders"
	"palabatu-be/internal/notification"
	"palabatu-be/internal/problems"
	"palabatu-be/internal/social"
)

// maxReasonLength bounds the optional report reason, mirroring
// social.maxCommentLength's role for comments.
const maxReasonLength = 500

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

func reasonPtr(reason string) *string {
	if reason == "" {
		return nil
	}
	return &reason
}

func CreateCommentReport(ctx context.Context, reporterID, commentID, reason string) (*Report, error) {
	if len(reason) > maxReasonLength {
		return nil, ErrReasonTooLong
	}

	problemID, ownerID, err := social.GetCommentTarget(ctx, commentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if ownerID != nil && *ownerID == reporterID {
		return nil, ErrCannotReportOwnContent
	}

	return createReport(ctx, reporterID, problemID, "comment", &commentID, nil, reasonPtr(reason))
}

func CreateImageReport(ctx context.Context, reporterID, problemID, imageURL, reason string) (*Report, error) {
	if len(reason) > maxReasonLength {
		return nil, ErrReasonTooLong
	}

	p, err := problems.GetProblem(ctx, problemID)
	if errors.Is(err, problems.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// The photo belongs to the problem's boulder now, not the problem
	// itself (handoff.md's photo-ownership move) -- membership is checked
	// against the boulder's image_urls.
	b, err := boulders.GetBoulder(ctx, p.BoulderID)
	if err != nil {
		return nil, err
	}

	found := false
	for _, url := range b.ImageURLs {
		if url == imageURL {
			found = true
			break
		}
	}
	if !found {
		return nil, ErrInvalidTarget
	}

	return createReport(ctx, reporterID, problemID, "image", nil, &imageURL, reasonPtr(reason))
}

func ListPending(ctx context.Context, userID string) ([]Report, error) {
	if err := requireAdmin(ctx, userID); err != nil {
		return nil, err
	}
	return listPendingReports(ctx)
}

var validResolveActions = map[string]bool{"dismiss": true, "remove": true}

func Resolve(ctx context.Context, adminID, reportID, action string) error {
	if !validResolveActions[action] {
		return ErrInvalidAction
	}
	if err := requireAdmin(ctx, adminID); err != nil {
		return err
	}

	targetType, commentID, imageURL, problemID, reporterID, status, err := getReportTarget(ctx, reportID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status != "pending" {
		return ErrAlreadyResolved
	}

	// Best-effort lookup for notification text/routing only — a failure
	// here (e.g. the problem was already deleted) must never block
	// resolving the report itself. BoulderID is also captured here since an
	// "image" report's removal now needs it -- photos belong to the
	// boulder, not the problem (handoff.md's photo-ownership move).
	var problemName string
	var problemOwnerID *string
	var problemBoulderID string
	if p, err := problems.GetProblem(ctx, problemID); err == nil {
		problemName = p.Name
		problemOwnerID = p.CreatedBy
		problemBoulderID = p.BoulderID
	}

	if action == "dismiss" {
		notifyReportResolved(ctx, reporterID, problemID, problemName, false)
		return markDismissed(ctx, reportID, adminID)
	}

	// action == "remove": resolve siblings before touching the content
	// itself — see resolveSiblingReports' doc comment for why the order
	// matters.
	if err := resolveSiblingReports(ctx, reportID, adminID, targetType, commentID, imageURL, problemID); err != nil {
		return err
	}

	if targetType == "comment" {
		// commentID can already be nil here if the comment was deleted
		// through the ordinary DELETE /comments/:id path while this
		// report was still pending — nothing left to remove.
		if commentID != nil {
			_, commentOwnerID, targetErr := social.GetCommentTarget(ctx, *commentID)
			if err := social.DeleteComment(ctx, adminID, *commentID); err != nil && !errors.Is(err, social.ErrNotFound) {
				return err
			}
			if targetErr == nil {
				notifyContentRemoved(ctx, commentOwnerID, problemID, problemName, "a comment you posted")
			}
		}
	} else {
		if problemBoulderID != "" {
			if err := boulders.DeleteBoulderImage(ctx, adminID, problemBoulderID, *imageURL); err != nil &&
				!errors.Is(err, boulders.ErrNotFound) && !errors.Is(err, boulders.ErrImageNotFound) {
				return err
			}
		}
		notifyContentRemoved(ctx, problemOwnerID, problemID, problemName, "a photo you added")
	}

	notifyReportResolved(ctx, reporterID, problemID, problemName, true)

	return markResolved(ctx, reportID, adminID)
}

// notifyReportResolved and notifyContentRemoved are best-effort, mirroring
// cloudinary.DestroyByURL's precedent elsewhere in this codebase: a failed
// notification write must never fail the report resolution itself.
func notifyReportResolved(ctx context.Context, reporterID, problemID, problemName string, removed bool) {
	if err := notification.NotifyReportResolved(ctx, reporterID, problemID, problemName, removed); err != nil {
		log.Printf("failed to create report-resolved notification: %v", err)
	}
}

func notifyContentRemoved(ctx context.Context, ownerID *string, problemID, problemName, contentDescription string) {
	if err := notification.NotifyContentRemoved(ctx, ownerID, problemID, problemName, contentDescription); err != nil {
		log.Printf("failed to create content-removed notification: %v", err)
	}
}
