package social

import "errors"

var ErrEmptyComment = errors.New("comment cannot be empty")
var ErrCommentTooLong = errors.New("comment is too long")
var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")
