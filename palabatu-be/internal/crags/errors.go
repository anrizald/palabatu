package crags

import "errors"

var (
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
	ErrInvalidLocation = errors.New("invalid location")
	ErrNoImages        = errors.New("no images provided")
	ErrImageNotFound   = errors.New("image not found")
)
