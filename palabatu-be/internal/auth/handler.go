package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
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

// handleSignup godoc
// @Summary      Sign up
// @Description  Creates the user + profile rows in one transaction and sends a verification email; the whole signup is rolled back if the email fails to send.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      auth.SignupRequest  true  "New account details"
// @Success      200   {object}  apitypes.MessageResponse
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /auth/signup [post]
func handleSignup(c *gin.Context) {
	var body SignupRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := Signup(c.Request.Context(), body.Email, body.Password, body.Username, body.TermsAccepted, body.GuidelinesAccepted)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.MessageResponse{Message: "Signup successful, check your email for verification"})
	case errors.Is(err, ErrEmailSendFailed):
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Failed to send verification email"})
	case errors.Is(err, ErrMissingFields):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Email, username, and password are required"})
	case errors.Is(err, ErrTermsNotAccepted):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "You must accept the Terms of Service and Privacy Policy"})
	case errors.Is(err, ErrGuidelinesNotAccepted):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "You must accept the Community Guidelines"})
	case errors.Is(err, ErrUsernameExists):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Username already taken"})
	case errors.Is(err, ErrEmailExists):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Email already exists"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleSignin godoc
// @Summary      Sign in
// @Description  Authenticates a user by email and password, returns a JWT and the user record.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      auth.SigninRequest  true  "Credentials"
// @Success      200   {object}  auth.SigninResponse
// @Failure      400   {object}  apitypes.ErrorResponse  "invalid body, bad credentials, or unverified email"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /auth/signin [post]
func handleSignin(c *gin.Context) {
	var body SigninRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	token, user, err := Signin(c.Request.Context(), body.Email, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, SigninResponse{User: user, Token: token})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid credentials"})
	case errors.Is(err, ErrNotVerified):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Email registered but not verified"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleSession godoc
// @Summary      Get the current session
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  auth.SessionResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /auth/session [get]
func handleSession(c *gin.Context) {
	id := middleware.UserFromContext(c).ID

	user, err := Session(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}

	c.JSON(http.StatusOK, SessionResponse{User: user})
}

// handleUserCount godoc
// @Summary      Total registered user count
// @Description  Backs the landing page's climber-count stat. Unauthenticated, same trust level as GET /problems.
// @Tags         auth
// @Produce      json
// @Success      200  {object}  apitypes.CountResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /auth/users/count [get]
func handleUserCount(c *gin.Context) {
	count, err := CountUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, apitypes.CountResponse{Count: count})
}

// handleVerifyEmail godoc
// @Summary      Verify an email address
// @Tags         auth
// @Produce      json
// @Param        token  query     string  true  "Verification token"
// @Success      200    {object}  apitypes.MessageResponse
// @Failure      400    {object}  apitypes.ErrorResponse  "invalid or expired token"
// @Failure      500    {object}  apitypes.ErrorResponse
// @Router       /auth/verify-email [get]
func handleVerifyEmail(c *gin.Context) {
	token := c.Query("token")

	err := VerifyEmail(c.Request.Context(), token)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.MessageResponse{Message: "Email verified! You can now log in."})
	case errors.Is(err, ErrInvalidToken):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid or expired token"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleForgotPassword godoc
// @Summary      Request a password reset
// @Description  Always returns the same generic success message regardless of whether the email exists, to avoid leaking account existence.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      auth.ForgotPasswordRequest  true  "Account email"
// @Success      200   {object}  apitypes.MessageResponse
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /auth/forgot-password [post]
func handleForgotPassword(c *gin.Context) {
	var body ForgotPasswordRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	const genericMessage = "If that email exists, a reset link has been sent."

	if err := ForgotPassword(c.Request.Context(), body.Email); err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}

	c.JSON(http.StatusOK, apitypes.MessageResponse{Message: genericMessage})
}

// handleResetPassword godoc
// @Summary      Reset a password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      auth.ResetPasswordRequest  true  "Reset token and new password"
// @Success      200   {object}  apitypes.MessageResponse
// @Failure      400   {object}  apitypes.ErrorResponse  "invalid or expired reset link"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /auth/reset-password [post]
func handleResetPassword(c *gin.Context) {
	var body ResetPasswordRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := ResetPassword(c.Request.Context(), body.Token, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.MessageResponse{Message: "Password reset successful"})
	case errors.Is(err, ErrInvalidToken):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid or expired reset link"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleGetProfile godoc
// @Summary      Get a profile
// @Tags         auth
// @Produce      json
// @Param        id   path      string  true  "Profile ID or slug"
// @Success      200  {object}  auth.Profile
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id} [get]
func handleGetProfile(c *gin.Context) {
	id := c.Param("id")

	profile, err := GetProfile(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, profile)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "User not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleGetProfileStats godoc
// @Summary      Get a profile's aggregate stats
// @Tags         auth
// @Produce      json
// @Param        id   path      string  true  "Profile ID or slug"
// @Success      200  {object}  auth.ProfileStats
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id}/stats [get]
func handleGetProfileStats(c *gin.Context) {
	id := c.Param("id")

	stats, err := GetProfileStats(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// handleGetRecentActivity godoc
// @Summary      Get a profile's recent sends and problems
// @Tags         auth
// @Produce      json
// @Param        id   path      string  true  "Profile ID or slug"
// @Success      200  {object}  auth.RecentActivity
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id}/activity [get]
func handleGetRecentActivity(c *gin.Context) {
	id := c.Param("id")

	activity, err := GetRecentActivity(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, activity)
}

// handleUpsertProfile godoc
// @Summary      Update a profile
// @Tags         auth
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                      true  "Profile ID"
// @Param        body  body      auth.UpsertProfileRequest  true  "Profile fields"
// @Success      200   {object}  auth.Profile
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id} [put]
func handleUpsertProfile(c *gin.Context) {
	callerID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body UpsertProfileRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	profile, err := UpsertProfile(c.Request.Context(), callerID, id, body.Username, body.Title, body.Tags, body.AvatarURL, body.Bio, body.Location)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, profile)
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this profile."})
	case errors.Is(err, ErrBioTooLong):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Bio is too long"})
	case errors.Is(err, ErrLocationTooLong):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location is too long"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleChangePassword godoc
// @Summary      Change the authenticated user's password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      auth.ChangePasswordRequest  true  "Current and new password"
// @Success      200   {object}  apitypes.MessageResponse
// @Failure      400   {object}  apitypes.ErrorResponse  "invalid body, too-short new password, or wrong current password"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /auth/password [put]
func handleChangePassword(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body ChangePasswordRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}
	if len(body.NewPassword) < minPasswordLength {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "New password must be at least 6 characters"})
		return
	}

	err := ChangePassword(c.Request.Context(), userID, body.CurrentPassword, body.NewPassword)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.MessageResponse{Message: "Password changed successfully"})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Current password is incorrect"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteAccount godoc
// @Summary      Delete the authenticated user's account
// @Tags         auth
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      auth.DeleteAccountRequest  true  "Password confirmation"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      400   {object}  apitypes.ErrorResponse  "invalid body or wrong password"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /auth/account [delete]
func handleDeleteAccount(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body DeleteAccountRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := DeleteAccount(c.Request.Context(), userID, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid credentials"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
