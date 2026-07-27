package waitlist

import "errors"

var (
	ErrInvalidEmail = errors.New("invalid email")
	ErrEmailExists  = errors.New("email already on waitlist")
)
