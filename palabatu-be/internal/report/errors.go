package report

import "errors"

var (
	ErrNotFound               = errors.New("not found")
	ErrForbidden              = errors.New("forbidden")
	ErrInvalidTarget          = errors.New("invalid report target")
	ErrReasonTooLong          = errors.New("reason is too long")
	ErrCannotReportOwnContent = errors.New("cannot report your own content")
	ErrAlreadyResolved        = errors.New("report already resolved")
	ErrInvalidAction          = errors.New("invalid resolution action")
)
