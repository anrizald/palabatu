package problems

import "errors"

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
)
