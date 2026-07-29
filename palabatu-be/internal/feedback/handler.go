package feedback

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// Routes registers the feedback domain's routes on the /api group. The
// submit route is public and per-IP rate-limited (mirroring
// internal/waitlist's pattern) rather than behind middleware.RequireAuth,
// since the form is deliberately open to logged-out visitors; it still runs
// middleware.OptionalAuth so a logged-in submitter's user_id gets attached
// when possible. The review-list routes reuse the same RequireAuth+
// RequireOwner gate internal/devtools already established, kept here
// instead of in internal/devtools so the table-owning package stays in
// charge of its own data.
func Routes(rg *gin.RouterGroup) {
	limitSubmit := middleware.RateLimit(5*time.Second, 3)
	rg.POST("/feedback", limitSubmit, middleware.OptionalAuth, handleSubmit)

	dev := rg.Group("/feedback", middleware.RequireAuth, middleware.RequireOwner)
	dev.GET("", handleList)
	dev.POST("/:id/reviewed", handleMarkReviewed)
}

func handleSubmit(c *gin.Context) {
	var body struct {
		Message string `json:"message"`
		Email   string `json:"email"`
		PageURL string `json:"page_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var userID *string
	if id := middleware.UserFromContext(c).ID; id != "" {
		userID = &id
	}

	f, err := Submit(c.Request.Context(), userID, body.Message, body.Email, body.PageURL)
	switch {
	case err == nil:
		c.JSON(http.StatusCreated, f)
	case errors.Is(err, ErrEmptyMessage):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
	case errors.Is(err, ErrMessageTooLong):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is too long"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleList(c *gin.Context) {
	items, err := ListOpen(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func handleMarkReviewed(c *gin.Context) {
	err := MarkReviewed(c.Request.Context(), c.Param("id"))
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
