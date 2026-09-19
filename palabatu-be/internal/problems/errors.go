package problems

import "errors"

var (
	ErrNameTooLong     = errors.New("name too long")
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
	ErrInvalidGrade    = errors.New("invalid grade")
	ErrBoulderNotFound = errors.New("boulder not found")
	// ErrImageNotFound is SaveAnnotation's "that URL isn't one of this
	// problem's boulder's photos" error -- distinct from boulders'
	// identically-named error for its own image-removal endpoint.
	ErrImageNotFound     = errors.New("image not found")
	ErrInvalidAnnotation = errors.New("invalid annotation data")
	ErrNoImages          = errors.New("no images provided")

	// Multi-pitch detail (handoff.md open item 14). ErrPitchesOnBoulder is the
	// backend half of "a boulder hides pitch detail": the UI already hides the
	// fields there, but the API is public, so a write is refused instead.
	ErrInvalidPitchCount      = errors.New("invalid pitch count")
	ErrInvalidCommitmentGrade = errors.New("invalid commitment grade")
	ErrInvalidPitches         = errors.New("invalid pitches")
	ErrPitchesNeedCount       = errors.New("pitches need a pitch count")
	ErrPitchesOnBoulder       = errors.New("pitch detail is only for walls")
)
