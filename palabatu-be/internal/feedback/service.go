// Package feedback owns the global feedback / bug report form: a public,
// rate-limited submission endpoint open to logged-out visitors as well as
// signed-in users (see middleware.OptionalAuth), plus an owner-only review
// list surfaced as a tab on the Developer page. Deliberately its own table
// and domain rather than folding into internal/report -- that package is
// comment/image moderation with an admin (Council/Associate) resolve flow;
// this is free-text feedback with a single owner-only reviewed toggle.
package feedback

import (
	"context"
	"log"
	"os"
	"strings"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/mailer"
)

// maxMessageLength bounds a submission, mirroring social.maxCommentLength
// (1000) / report.maxReasonLength (500)'s role for their own free-text
// fields -- set higher since a bug report is likely to run longer than a
// comment or a one-line report reason.
const maxMessageLength = 5000

func Submit(ctx context.Context, userID *string, message, email, pageURL string) (*Feedback, error) {
	message = strings.TrimSpace(message)
	if message == "" {
		return nil, ErrEmptyMessage
	}
	if len(message) > maxMessageLength {
		return nil, ErrMessageTooLong
	}

	f, err := createFeedback(ctx, userID, optionalString(email), message, optionalString(pageURL))
	if err != nil {
		return nil, err
	}

	notifyOwner(ctx, f)
	return f, nil
}

func optionalString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// notifyOwner is best-effort, mirroring report's notifyReportResolved
// precedent: a failed notification email must never fail the submission
// itself. Resolves OWNER_USER_ID to an inbox via auth.GetUserEmail rather
// than a second owner-email env var, so there's one source of truth for
// "who is the owner" alongside middleware.RequireOwner.
func notifyOwner(ctx context.Context, f *Feedback) {
	ownerID := os.Getenv("OWNER_USER_ID")
	if ownerID == "" {
		return
	}
	to, err := auth.GetUserEmail(ctx, ownerID)
	if err != nil {
		log.Printf("feedback: failed to resolve owner email: %v", err)
		return
	}
	if err := mailer.SendFeedbackNotification(to, f.Message, f.Email, f.PageURL); err != nil {
		log.Printf("feedback: failed to send notification email: %v", err)
	}
}

func ListOpen(ctx context.Context) ([]Feedback, error) {
	return listOpenFeedback(ctx)
}

func MarkReviewed(ctx context.Context, id string) error {
	return markReviewed(ctx, id)
}
