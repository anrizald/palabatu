package drafts

import "errors"

var (
	ErrNotFound      = errors.New("not found")
	ErrInvalidIntent = errors.New("invalid intent")
)
