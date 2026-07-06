package service

import (
	"context"
	"strings"

	"palabatu-be/internal/repository"
)

func ListComments(ctx context.Context, problemID string) ([]repository.Comment, error) {
	return repository.ListComments(ctx, problemID)
}

func CreateComment(ctx context.Context, problemID, userID, content string) (*repository.Comment, error) {
	if strings.TrimSpace(content) == "" {
		return nil, ErrEmptyComment
	}
	return repository.CreateComment(ctx, problemID, userID, content)
}
