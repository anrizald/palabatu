package auth

import "encoding/json"

// SignupRequest is handleSignup's request body.
type SignupRequest struct {
	Email              string `json:"email"`
	Password           string `json:"password"`
	Username           string `json:"username"`
	TermsAccepted      bool   `json:"terms_accepted"`
	GuidelinesAccepted bool   `json:"guidelines_accepted"`
}

// SigninRequest is handleSignin's request body.
type SigninRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// SigninResponse is handleSignin's success body.
type SigninResponse struct {
	User  *User  `json:"user"`
	Token string `json:"token"`
}

// SessionResponse is handleSession's success body.
type SessionResponse struct {
	User *User `json:"user"`
}

// ForgotPasswordRequest is handleForgotPassword's request body.
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ResetPasswordRequest is handleResetPassword's request body.
type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// UpsertProfileRequest is handleUpsertProfile's request body. Every field is
// optional, and one the body leaves out keeps the profile's current value.
// The text fields are pointers so that an omitted key (nil, keep) stays
// distinct from an empty string (write an empty value, which is how a field
// is cleared). Title and Tags are raw JSON, where an omitted key is a nil
// slice and an explicit null decodes to the bytes "null", so the two are
// already distinguishable and a client can still clear either on purpose.
type UpsertProfileRequest struct {
	Username  *string         `json:"username"`
	Title     json.RawMessage `json:"title"`
	Tags      json.RawMessage `json:"tags"`
	AvatarURL *string         `json:"avatar_url"`
	Bio       *string         `json:"bio"`
	Location  *string         `json:"location"`
}

// ChangePasswordRequest is handleChangePassword's request body.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// DeleteAccountRequest is handleDeleteAccount's request body.
type DeleteAccountRequest struct {
	Password string `json:"password"`
}
