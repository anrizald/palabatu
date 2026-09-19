package social

import "errors"

var ErrEmptyComment = errors.New("comment cannot be empty")
var ErrCommentTooLong = errors.New("comment is too long")
var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")
var ErrInvalidReactionType = errors.New("invalid reaction type")

// High points (handoff.md open item 14): ErrNotMultiPitch is a route that is
// not a multi-pitch one on a wall, ErrInvalidHighPoint a pitch outside 1 to
// its pitch count, and ErrAlreadySent a high point on a route the caller has
// already topped out.
var ErrNotMultiPitch = errors.New("route is not multi-pitch")
var ErrInvalidHighPoint = errors.New("invalid high point")
var ErrAlreadySent = errors.New("already sent")
