package auth

import "errors"

var (
	ErrEmailExists           = errors.New("email already exists")
	ErrUsernameExists        = errors.New("username already exists")
	ErrEmailSendFailed       = errors.New("failed to send verification email")
	ErrInvalidCredentials    = errors.New("invalid credentials")
	ErrNotVerified           = errors.New("email registered but not verified")
	ErrInvalidToken          = errors.New("invalid or expired token")
	ErrForbidden             = errors.New("forbidden")
	ErrNotFound              = errors.New("not found")
	ErrBioTooLong            = errors.New("bio is too long")
	ErrLocationTooLong       = errors.New("location is too long")
	ErrTermsNotAccepted      = errors.New("terms of service must be accepted")
	ErrGuidelinesNotAccepted = errors.New("community guidelines must be accepted")
	ErrMissingFields         = errors.New("email, username, and password are required")
)
