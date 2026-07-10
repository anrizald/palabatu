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
