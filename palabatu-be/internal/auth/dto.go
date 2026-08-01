package auth

import "encoding/json"

// SignupRequest is handleSignup's request body.
type SignupRequest struct {
	Email         string `json:"email"`
	Password      string `json:"password"`
	Username      string `json:"username"`
	TermsAccepted bool   `json:"terms_accepted"`
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

// UpsertProfileRequest is handleUpsertProfile's request body.
type UpsertProfileRequest struct {
	Username  string          `json:"username"`
	Title     json.RawMessage `json:"title"`
	Tags      json.RawMessage `json:"tags"`
	AvatarURL string          `json:"avatar_url"`
	Bio       string          `json:"bio"`
	Location  string          `json:"location"`
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
