package social

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/middleware"
)

// Routes registers the social domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	// Per-IP: 20 comments/minute (burst 5), enough for real conversation
	// while blunting spam/flood posting.
	limitComments := middleware.RateLimit(3*time.Second, 5)

	rg.GET("/problems/:id/send-status", middleware.RequireAuth, handleSendStatus)
	rg.POST("/problems/:id/send", middleware.RequireAuth, handleToggleSend)

	rg.GET("/problems/:id/comments", handleListComments)
	rg.POST("/problems/:id/comments", middleware.RequireAuth, limitComments, handleCreateComment)
	rg.DELETE("/comments/:id", middleware.RequireAuth, handleDeleteComment)

	rg.GET("/profiles/:id/reactions", handleReactionCounts)
	rg.GET("/profiles/:id/reactions/status", middleware.RequireAuth, handleReactionStatus)
	rg.POST("/profiles/:id/reactions/:type", middleware.RequireAuth, handleToggleReaction)
}

// currentUserID reads the "id" claim attached by middleware.RequireAuth,
// mirroring (req as any).user.id in the Node routes.
func currentUserID(claims map[string]interface{}) string {
	id, _ := claims["id"].(string)
	return id
}

func handleSendStatus(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	hasSent, err := HasSent(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"hasSent": hasSent})
}

func handleToggleSend(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	action, err := ToggleSend(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"action": action})
}

func handleListComments(c *gin.Context) {
	id := c.Param("id")

	comments, err := ListComments(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func handleCreateComment(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	comment, err := CreateComment(c.Request.Context(), id, userID, body.Content)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, comment)
	case errors.Is(err, ErrEmptyComment):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment cannot be empty"})
	case errors.Is(err, ErrCommentTooLong):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment is too long"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

// resolveProfileID accepts either a profile's real id or its public slug
// (see auth.ResolveUserID) — the reaction routes are mounted at
// /profiles/:id, which the frontend now addresses by slug.
func resolveProfileID(c *gin.Context, idOrSlug string) (string, bool) {
	id, err := auth.ResolveUserID(c.Request.Context(), idOrSlug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return "", false
	}
	return id, true
}

func handleReactionCounts(c *gin.Context) {
	id, ok := resolveProfileID(c, c.Param("id"))
	if !ok {
		return
	}

	counts, err := GetReactionCounts(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, counts)
}

func handleReactionStatus(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id, ok := resolveProfileID(c, c.Param("id"))
	if !ok {
		return
	}

	status, err := GetReactionStatus(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, status)
}

func handleToggleReaction(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id, ok := resolveProfileID(c, c.Param("id"))
	if !ok {
		return
	}
	reactionType := c.Param("type")

	action, err := ToggleReaction(c.Request.Context(), id, userID, reactionType)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"action": action})
	case errors.Is(err, ErrInvalidReactionType):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reaction type"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleDeleteComment(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	err := DeleteComment(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to delete this comment."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
