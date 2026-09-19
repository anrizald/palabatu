package crags

import "errors"

var (
	ErrNameTooLong     = errors.New("name too long")
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
	ErrInvalidLocation = errors.New("invalid location")
	ErrNoImages        = errors.New("no images provided")
	ErrImageNotFound   = errors.New("image not found")
	ErrCragNotEmpty    = errors.New("crag not empty")
	ErrCountMismatch   = errors.New("purge confirmation does not match")
)
