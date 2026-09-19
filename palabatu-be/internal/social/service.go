// Package social owns sends (ticks) and comments today; likes or follows
// if those get added later.
package social

import (
	"context"
	"errors"
	"log"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
	"palabatu-be/internal/notification"
	"palabatu-be/internal/problems"
)

func HasSent(ctx context.Context, problemID, userID string) (bool, error) {
	return sendExists(ctx, problemID, userID)
}

// ToggleSend adds a send if one doesn't exist yet, or removes it if it does,
// mirroring the toggle behavior in POST /problems/:id/send.
func ToggleSend(ctx context.Context, problemID, userID string) (action string, err error) {
	exists, err := sendExists(ctx, problemID, userID)
	if err != nil {
		return "", err
	}

	if exists {
		if err := deleteSend(ctx, problemID, userID); err != nil {
			return "", err
		}
		return "removed", nil
	}

	if err := createSend(ctx, problemID, userID); err != nil {
		return "", err
	}
	// Topping out clears a turned-back record: a route never holds both a send
	// and a high point for one climber. Best-effort like the notification,
	// because the send itself has already succeeded and the page treats a send
	// as winning over a stale high point. The one-tick contract is untouched.
	if err := deleteHighPoint(ctx, problemID, userID); err != nil {
		log.Printf("failed to clear high point after send: %v", err)
	}
	notifySend(ctx, problemID, userID)
	return "added", nil
}

// GetHighPoint is the caller's own high point on a route, or nil.
func GetHighPoint(ctx context.Context, problemID, userID string) (*int, error) {
	return getHighPoint(ctx, problemID, userID)
}

// SetHighPoint records how far up a multi-pitch route the caller got before
// turning back (handoff.md open item 14). It is private to them, sends no
// notification, and is never counted as a send. Only a multi-pitch route on a
// wall has one, the pitch has to be within the route's own pitch count, and a
// climber who has already topped the route out has no high point to record.
func SetHighPoint(ctx context.Context, problemID, userID string, pitch int) error {
	p, err := problems.GetProblem(ctx, problemID)
	if errors.Is(err, problems.ErrNotFound) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if p.BoulderType != "wall" || p.PitchCount == nil {
		return ErrNotMultiPitch
	}
	if pitch < 1 || pitch > *p.PitchCount {
		return ErrInvalidHighPoint
	}
	sent, err := sendExists(ctx, problemID, userID)
	if err != nil {
		return err
	}
	if sent {
		return ErrAlreadySent
	}
	return upsertHighPoint(ctx, problemID, userID, pitch)
}

// ClearHighPoint removes the caller's high point on a route. Deleting one that
// is not there is not an error.
func ClearHighPoint(ctx context.Context, problemID, userID string) error {
	return deleteHighPoint(ctx, problemID, userID)
}

// notifySend is best-effort, mirroring cloudinary.DestroyByURL's precedent
// elsewhere in this codebase: a failure to look up the problem/actor or
// write the notification row must never fail the send itself.
func notifySend(ctx context.Context, problemID, userID string) {
	p, err := problems.GetProblem(ctx, problemID)
	if err != nil {
		return
	}
	actor, err := auth.GetProfile(ctx, userID)
	if err != nil {
		return
	}
	username := "Someone"
	if actor.Username != nil {
		username = *actor.Username
	}
	if err := notification.NotifySend(ctx, p.CreatedBy, userID, username, problemID, p.Name); err != nil {
		log.Printf("failed to create send notification: %v", err)
	}
}

// ListSentProblemIDs returns every problem ID a user has sent, so a client
// can filter a whole listing by "sent by me" / "not yet sent by me" without
// an N+1 per-problem HasSent call (see palabatu-fe's ProblemList.tsx).
func ListSentProblemIDs(ctx context.Context, userID string) ([]string, error) {
	return listSentProblemIDs(ctx, userID)
}

func ListComments(ctx context.Context, problemID string) ([]Comment, error) {
	return listComments(ctx, problemID)
}

// maxCommentLength bounds comment content to keep a single post from
// dominating a problem's Beta & Comments section.
const maxCommentLength = 1000

func CreateComment(ctx context.Context, problemID, userID, content string) (*Comment, error) {
	if strings.TrimSpace(content) == "" {
		return nil, ErrEmptyComment
	}
	if len(content) > maxCommentLength {
		return nil, ErrCommentTooLong
	}

	comment, err := createComment(ctx, problemID, userID, content)
	if err != nil {
		return nil, err
	}

	if p, err := problems.GetProblem(ctx, problemID); err == nil {
		if err := notification.NotifyComment(ctx, p.CreatedBy, userID, comment.Username, problemID, p.Name); err != nil {
			log.Printf("failed to create comment notification: %v", err)
		}
		notifyMentions(ctx, problemID, userID, comment.Username, p.Name, content)
	}

	return comment, nil
}

// mentionPattern matches "@username" tokens in comment text. Dots are
// allowed mid-token (real usernames in this app use them, e.g. "bagas.k")
// but not trailing, so "@bagas.k." at the end of a sentence doesn't pull
// the sentence-ending period into the username.
var mentionPattern = regexp.MustCompile(`@([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)`)

// notifyMentions is best-effort, same rationale as notifySend: a lookup or
// notification-write failure must never fail the comment itself. Each
// distinct @username in content is resolved and notified at most once,
// skipping the comment's own author.
func notifyMentions(ctx context.Context, problemID, authorID, authorUsername, problemName, content string) {
	notified := map[string]bool{}
	for _, match := range mentionPattern.FindAllStringSubmatch(content, -1) {
		username := strings.ToLower(match[1])
		if notified[username] {
			continue
		}
		notified[username] = true

		mentionedID, err := auth.GetUserIDByUsername(ctx, match[1])
		if err != nil || mentionedID == authorID {
			continue
		}
		if err := notification.NotifyMention(ctx, mentionedID, authorID, authorUsername, problemID, problemName); err != nil {
			log.Printf("failed to create mention notification: %v", err)
		}
	}
}

var validReactionTypes = map[string]bool{"like": true, "fire": true, "heart": true}

// ToggleReaction adds a reaction if the user hasn't given a profile this
// reaction type yet, or removes it if they have, mirroring ToggleSend's
// toggle behavior.
func ToggleReaction(ctx context.Context, profileID, userID, reactionType string) (action string, err error) {
	if !validReactionTypes[reactionType] {
		return "", ErrInvalidReactionType
	}

	exists, err := reactionExists(ctx, profileID, userID, reactionType)
	if err != nil {
		return "", err
	}

	if exists {
		if err := deleteReaction(ctx, profileID, userID, reactionType); err != nil {
			return "", err
		}
		return "removed", nil
	}

	if err := createReaction(ctx, profileID, userID, reactionType); err != nil {
		return "", err
	}
	notifyReaction(ctx, profileID, userID, reactionType)
	return "added", nil
}

// notifyReaction is best-effort, same rationale as notifySend. profileID is
// the reacted-to profile's own id (profiles are 1:1 with users), so it
// doubles directly as the recipient — no separate owner lookup needed.
func notifyReaction(ctx context.Context, profileID, userID, reactionType string) {
	actor, err := auth.GetProfile(ctx, userID)
	if err != nil {
		return
	}
	username := "Someone"
	if actor.Username != nil {
		username = *actor.Username
	}
	if err := notification.NotifyReaction(ctx, profileID, userID, username, reactionType); err != nil {
		log.Printf("failed to create reaction notification: %v", err)
	}
}

func GetReactionCounts(ctx context.Context, profileID string) (ReactionCounts, error) {
	return countReactions(ctx, profileID)
}

func GetReactionStatus(ctx context.Context, profileID, userID string) (ReactionStatus, error) {
	return userReactionStatus(ctx, profileID, userID)
}

// DeleteComment authorizes and removes a comment, allowed for the comment's
// own author or an admin (Council/Associate), mirroring the Founder/admin
// check problems.DeleteProblem applies via the same authz.CanEditOwned.
func DeleteComment(ctx context.Context, userID, commentID string) error {
	ownerID, err := getCommentOwner(ctx, commentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	titles, err := auth.GetUserTitles(ctx, userID)
	if err != nil {
		return err
	}
	if !authz.CanEditOwned(userID, ownerID, titles) {
		return ErrForbidden
	}

	return deleteCommentRow(ctx, commentID)
}

// GetCommentTarget exposes a comment's parent problem and owner so
// internal/report can validate a report against it without reaching into
// this package's repository tier directly.
func GetCommentTarget(ctx context.Context, commentID string) (string, *string, error) {
	return getCommentTarget(ctx, commentID)
}
