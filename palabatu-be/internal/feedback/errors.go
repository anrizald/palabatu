package feedback

import "errors"

var (
	ErrEmptyMessage   = errors.New("message is required")
	ErrMessageTooLong = errors.New("message is too long")
	ErrInvalidType    = errors.New("invalid feedback type")
	ErrNotFound       = errors.New("not found")
)
