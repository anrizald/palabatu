package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"palabatu-be/internal/httpx"
	"palabatu-be/internal/middleware"
	"palabatu-be/internal/service"
)

// AuthRouter mounts at /auth, mirroring palabatu-be/routes/auth.ts.
func AuthRouter() chi.Router {
	r := chi.NewRouter()

	r.Post("/signup", handleSignup)
	r.Post("/signin", handleSignin)
	r.With(middleware.RequireAuth).Get("/session", handleSession)
	r.Get("/verify-email", handleVerifyEmail)
	r.Post("/forgot-password", handleForgotPassword)
	r.Post("/reset-password", handleResetPassword)

	return r
}

func handleSignup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Username string `json:"username"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	err := service.Signup(r.Context(), body.Email, body.Password, body.Username)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"message": "Signup successful, check your email for verification"})
	case errors.Is(err, service.ErrEmailSendFailed):
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to send verification email"})
	default:
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Email already exists"})
	}
}

func handleSignin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	token, user, err := service.Signin(r.Context(), body.Email, body.Password)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"user": user, "token": token})
	case errors.Is(err, service.ErrInvalidCredentials):
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid credentials"})
	case errors.Is(err, service.ErrNotVerified):
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Email registered but not verified"})
	default:
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
	}
}

func handleSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.UserFromContext(r)
	id, _ := claims["id"].(string)

	user, err := service.Session(r.Context(), id)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]interface{}{"user": user})
}

func handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")

	err := service.VerifyEmail(r.Context(), token)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"message": "Email verified! You can now log in."})
	case errors.Is(err, service.ErrInvalidToken):
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid or expired token"})
	default:
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
	}
}

func handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	const genericMessage = "If that email exists, a reset link has been sent."

	if err := service.ForgotPassword(r.Context(), body.Email); err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"message": genericMessage})
}

func handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	err := service.ResetPassword(r.Context(), body.Token, body.Password)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"message": "Password reset successful"})
	case errors.Is(err, service.ErrInvalidToken):
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid or expired reset link"})
	default:
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
	}
}
