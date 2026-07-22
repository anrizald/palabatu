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
	rg.PUT("/password", middleware.RequireAuth, limitCredentialEndpoints, handleChangePassword)
	rg.DELETE("/account", middleware.RequireAuth, limitCredentialEndpoints, handleDeleteAccount)
	rg.GET("/users/count", handleUserCount)
}

// minPasswordLength applies to change-password (and, going forward, any
// other place a plaintext password is accepted); signup/reset-password
// predate this and are left as they are rather than retrofitted here.
const minPasswordLength = 6

// ProfileRoutes registers /api/profiles/:id, mirroring
// palabatu-be/routes/api.ts. Profiles live under the auth domain (see
// package doc in service.go) but are mounted on the /api group, not /auth.
func ProfileRoutes(rg *gin.RouterGroup) {
	rg.GET("/profiles/:id", handleGetProfile)
	rg.PUT("/profiles/:id", middleware.RequireAuth, handleUpsertProfile)
	rg.GET("/profiles/:id/stats", handleGetProfileStats)
	rg.GET("/profiles/:id/activity", handleGetRecentActivity)
}

func handleSignup(c *gin.Context) {
	var body struct {
		Email         string `json:"email"`
		Password      string `json:"password"`
		Username      string `json:"username"`
		TermsAccepted bool   `json:"terms_accepted"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := Signup(c.Request.Context(), body.Email, body.Password, body.Username, body.TermsAccepted)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Signup successful, check your email for verification"})
	case errors.Is(err, ErrEmailSendFailed):
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
	case errors.Is(err, ErrMissingFields):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email, username, and password are required"})
	case errors.Is(err, ErrTermsNotAccepted):
		c.JSON(http.StatusBadRequest, gin.H{"error": "You must accept the Terms of Service and Privacy Policy"})
	case errors.Is(err, ErrUsernameExists):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username already taken"})
	case errors.Is(err, ErrEmailExists):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
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

// handleUserCount backs the landing page's climber-count stat. It's
// unauthenticated, same trust level as GET /problems.
func handleUserCount(c *gin.Context) {
	count, err := CountUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
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
	switch {
	case err == nil:
		c.JSON(http.StatusOK, profile)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
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

func handleGetRecentActivity(c *gin.Context) {
	id := c.Param("id")

	activity, err := GetRecentActivity(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, activity)
}

func handleUpsertProfile(c *gin.Context) {
	claims := middleware.UserFromContext(c)
	callerID, _ := claims["id"].(string)
	id := c.Param("id")

	var body struct {
		Username  string          `json:"username"`
		Title     json.RawMessage `json:"title"`
		Tags      json.RawMessage `json:"tags"`
		AvatarURL string          `json:"avatar_url"`
		Bio       string          `json:"bio"`
		Location  string          `json:"location"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	profile, err := UpsertProfile(c.Request.Context(), callerID, id, body.Username, body.Title, body.Tags, body.AvatarURL, body.Bio, body.Location)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, profile)
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to edit this profile."})
	case errors.Is(err, ErrBioTooLong):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bio is too long"})
	case errors.Is(err, ErrLocationTooLong):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Location is too long"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleChangePassword(c *gin.Context) {
	claims := middleware.UserFromContext(c)
	userID, _ := claims["id"].(string)

	var body struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if len(body.NewPassword) < minPasswordLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be at least 6 characters"})
		return
	}

	err := ChangePassword(c.Request.Context(), userID, body.CurrentPassword, body.NewPassword)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleDeleteAccount(c *gin.Context) {
	claims := middleware.UserFromContext(c)
	userID, _ := claims["id"].(string)

	var body struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := DeleteAccount(c.Request.Context(), userID, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credentials"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
