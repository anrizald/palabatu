package waitlist

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// JoinRequest is handleJoin's request body.
type JoinRequest struct {
	Email string `json:"email"`
}

// AlreadyJoinedResponse is handleJoin's response when the email is already
// on the waitlist -- treated as a success, not a conflict, so a repeat
// submission (e.g. after clearing localStorage) lands on the same
// confirmation state as a first-time signup.
type AlreadyJoinedResponse struct {
	AlreadyJoined bool `json:"already_joined"`
}

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

// handleJoin godoc
// @Summary      Join the waitlist
// @Description  Adds an email to the pre-launch waitlist. A repeat submission of an already-registered email is treated as a success (already_joined: true), not an error.
// @Tags         waitlist
// @Accept       json
// @Produce      json
// @Param        body  body      waitlist.JoinRequest  true  "Email to add"
// @Success      201   {object}  waitlist.Subscriber
// @Success      200   {object}  waitlist.AlreadyJoinedResponse  "email was already on the waitlist"
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/waitlist [post]
func handleJoin(c *gin.Context) {
	var body JoinRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	sub, err := Join(c.Request.Context(), body.Email)
	switch {
	case err == nil:
		c.JSON(http.StatusCreated, sub)
	case errors.Is(err, ErrInvalidEmail):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Enter a valid email address."})
	case errors.Is(err, ErrEmailExists):
		// Treated as success, not a conflict: a repeat submission from the
		// same visitor (e.g. after clearing localStorage) should land on
		// the same confirmation state as a first-time signup, not an error.
		c.JSON(http.StatusOK, AlreadyJoinedResponse{AlreadyJoined: true})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
