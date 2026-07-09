package service

import (
	"context"

	"palabatu-be/internal/repository"
)

func HasSent(ctx context.Context, problemID, userID string) (bool, error) {
	return repository.SendExists(ctx, problemID, userID)
}

// ToggleSend adds a send if one doesn't exist yet, or removes it if it does,
// mirroring the toggle behavior in POST /problems/:id/send.
func ToggleSend(ctx context.Context, problemID, userID string) (action string, err error) {
	exists, err := repository.SendExists(ctx, problemID, userID)
	if err != nil {
		return "", err
	}

	if exists {
		if err := repository.DeleteSend(ctx, problemID, userID); err != nil {
			return "", err
		}
		return "removed", nil
	}

	if err := repository.CreateSend(ctx, problemID, userID); err != nil {
		return "", err
	}
	return "added", nil
}
