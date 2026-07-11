package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// AuthRoutes registers routes under /auth, mirroring palabatu-be/routes/auth.ts.
func AuthRoutes(rg *gin.RouterGroup) {
	// One shared per-IP bucket across the credential-facing endpoints
	// (account creation, sign-in, password reset) to blunt brute-force and
	// spam attempts: 5 requests per minute per IP total across all four,
	// with a burst of 5 so a legitimate user isn't punished for a couple
	// of quick retries. Built once so all four routes share one limiter
	// map/cleanup goroutine instead of each spinning up its own.
	limitCredentialEndpoints := middleware.RateLimit(12*time.Second, 5)

	rg.POST("/signup", limitCredentialEndpoints, handleSignup)
	rg.POST("/signin", limitCredentialEndpoints, handleSignin)
	rg.GET("/session", middleware.RequireAuth, handleSession)
	rg.GET("/verify-email", handleVerifyEmail)
	rg.POST("/forgot-password", limitCredentialEndpoints, handleForgotPassword)
	rg.POST("/reset-password", limitCredentialEndpoints, handleResetPassword)
}

// ProfileRoutes registers /api/profiles/:id, mirroring
// palabatu-be/routes/api.ts. Profiles live under the auth domain (see
// package doc in service.go) but are mounted on the /api group, not /auth.
func ProfileRoutes(rg *gin.RouterGroup) {
	rg.GET("/profiles/:id", handleGetProfile)
	rg.PUT("/profiles/:id", middleware.RequireAuth, handleUpsertProfile)
	rg.GET("/profiles/:id/stats", handleGetProfileStats)
}

func handleSignup(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := Signup(c.Request.Context(), body.Email, body.Password, body.Username)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Signup successful, check your email for verification"})
	case errors.Is(err, ErrEmailSendFailed):
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
	}
}

func handleSignin(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	token, user, err := Signin(c.Request.Context(), body.Email, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credentials"})
	case errors.Is(err, ErrNotVerified):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email registered but not verified"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleSession(c *gin.Context) {
	claims := middleware.UserFromContext(c)
	id, _ := claims["id"].(string)

	user, err := Session(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func handleVerifyEmail(c *gin.Context) {
	token := c.Query("token")

	err := VerifyEmail(c.Request.Context(), token)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Email verified! You can now log in."})
	case errors.Is(err, ErrInvalidToken):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired token"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	const genericMessage = "If that email exists, a reset link has been sent."

	if err := ForgotPassword(c.Request.Context(), body.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": genericMessage})
}

func handleResetPassword(c *gin.Context) {
	var body struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := ResetPassword(c.Request.Context(), body.Token, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Password reset successful"})
	case errors.Is(err, ErrInvalidToken):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset link"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleGetProfile(c *gin.Context) {
	id := c.Param("id")

	profile, err := GetProfile(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func handleGetProfileStats(c *gin.Context) {
	id := c.Param("id")

	stats, err := GetProfileStats(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func handleUpsertProfile(c *gin.Context) {
	id := c.Param("id")

	var body struct {
		Username  string          `json:"username"`
		Title     json.RawMessage `json:"title"`
		Tags      json.RawMessage `json:"tags"`
		AvatarURL string          `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	profile, err := UpsertProfile(c.Request.Context(), id, body.Username, body.Title, body.Tags, body.AvatarURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, profile)
}
