package problems

import "errors"

var (
	ErrNotFound          = errors.New("not found")
	ErrForbidden         = errors.New("forbidden")
	ErrInvalidGrade      = errors.New("invalid grade")
	ErrBoulderNotFound   = errors.New("boulder not found")
	// ErrImageNotFound is SaveAnnotation's "that URL isn't one of this
	// problem's boulder's photos" error -- distinct from boulders'
	// identically-named error for its own image-removal endpoint.
	ErrImageNotFound     = errors.New("image not found")
	ErrInvalidAnnotation = errors.New("invalid annotation data")
	ErrNoImages          = errors.New("no images provided")
)
