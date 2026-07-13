// Package social owns sends (ticks) and comments today; likes or follows
// if those get added later.
package social

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/authz"
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
	return "added", nil
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
	return createComment(ctx, problemID, userID, content)
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
	return "added", nil
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
