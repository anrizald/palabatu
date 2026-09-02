package approaches

import "errors"

var (
	ErrNotFound         = errors.New("not found")
	ErrForbidden        = errors.New("forbidden")
	ErrCragNotFound     = errors.New("crag not found")
	ErrInvalidStartType = errors.New("invalid start type")
	ErrNoSteps          = errors.New("at least one step is required")
	ErrInvalidStep      = errors.New("every step needs a photo and a caption")
)
