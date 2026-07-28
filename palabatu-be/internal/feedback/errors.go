package feedback

import "errors"

var (
	ErrEmptyMessage   = errors.New("message is required")
	ErrMessageTooLong = errors.New("message is too long")
	ErrNotFound       = errors.New("not found")
)
