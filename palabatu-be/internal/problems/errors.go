package problems

import "errors"

var (
	ErrNotFound          = errors.New("not found")
	ErrForbidden         = errors.New("forbidden")
	ErrInvalidGrade      = errors.New("invalid grade")
	ErrInvalidLocation   = errors.New("location outside of Indonesia")
	ErrImageNotFound     = errors.New("image not found")
	ErrNoImages          = errors.New("no images provided")
	ErrInvalidAnnotation = errors.New("invalid annotation data")
)
