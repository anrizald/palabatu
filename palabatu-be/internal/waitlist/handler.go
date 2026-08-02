package waitlist

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// Routes registers the waitlist domain's routes. Public and unauthenticated
// by design -- visitors submit this from the pre-launch coming-soon page
// before any account exists -- so abuse is bounded with a per-IP rate limit
// instead of middleware.RequireAuth.
func Routes(rg *gin.RouterGroup) {
	limitJoin := middleware.RateLimit(5*time.Second, 3)
	rg.POST("/waitlist", limitJoin, handleJoin)
	rg.GET("/waitlist/count", handleCount)
}

func handleCount(c *gin.Context) {
	count, err := Count(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func handleJoin(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	sub, err := Join(c.Request.Context(), body.Email)
	switch {
	case err == nil:
		c.JSON(http.StatusCreated, sub)
	case errors.Is(err, ErrInvalidEmail):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
	case errors.Is(err, ErrEmailExists):
		// Treated as success, not a conflict: a repeat submission from the
		// same visitor (e.g. after clearing localStorage) should land on
		// the same confirmation state as a first-time signup, not an error.
		c.JSON(http.StatusOK, gin.H{"already_joined": true})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
