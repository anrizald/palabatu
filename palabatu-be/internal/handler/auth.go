package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
	"palabatu-be/internal/service"
)

// AuthRoutes registers routes under /auth, mirroring palabatu-be/routes/auth.ts.
func AuthRoutes(rg *gin.RouterGroup) {
	rg.POST("/signup", handleSignup)
	rg.POST("/signin", handleSignin)
	rg.GET("/session", middleware.RequireAuth, handleSession)
	rg.GET("/verify-email", handleVerifyEmail)
	rg.POST("/forgot-password", handleForgotPassword)
	rg.POST("/reset-password", handleResetPassword)
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

	err := service.Signup(c.Request.Context(), body.Email, body.Password, body.Username)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Signup successful, check your email for verification"})
	case errors.Is(err, service.ErrEmailSendFailed):
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

	token, user, err := service.Signin(c.Request.Context(), body.Email, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
	case errors.Is(err, service.ErrInvalidCredentials):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credentials"})
	case errors.Is(err, service.ErrNotVerified):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email registered but not verified"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleSession(c *gin.Context) {
	claims := middleware.UserFromContext(c)
	id, _ := claims["id"].(string)

	user, err := service.Session(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func handleVerifyEmail(c *gin.Context) {
	token := c.Query("token")

	err := service.VerifyEmail(c.Request.Context(), token)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Email verified! You can now log in."})
	case errors.Is(err, service.ErrInvalidToken):
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

	if err := service.ForgotPassword(c.Request.Context(), body.Email); err != nil {
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

	err := service.ResetPassword(c.Request.Context(), body.Token, body.Password)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"message": "Password reset successful"})
	case errors.Is(err, service.ErrInvalidToken):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset link"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
