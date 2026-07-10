// Package social owns sends (ticks) and comments today; likes or follows
// if those get added later.
package social

import (
	"context"
	"strings"
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
