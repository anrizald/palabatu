package boulders

import "errors"

var (
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
	ErrCragNotFound    = errors.New("crag not found")
	ErrInvalidLocation = errors.New("invalid location")
	ErrImageNotFound   = errors.New("image not found")
	ErrNoImages        = errors.New("no images provided")
	ErrCannotMergeSelf = errors.New("cannot merge a boulder with itself")
	ErrNotMergeCreator = errors.New("only the boulder's creator may object")
	ErrAlreadyResolved = errors.New("merge request already resolved")
	ErrHoldNotExpired  = errors.New("merge hold has not expired")
	ErrInvalidAction   = errors.New("invalid action")
	ErrInvalidSurvivor = errors.New("survivor must be the source or target boulder")
)
