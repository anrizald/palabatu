package social

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// Routes registers the social domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/problems/:id/send-status", middleware.RequireAuth, handleSendStatus)
	rg.POST("/problems/:id/send", middleware.RequireAuth, handleToggleSend)

	rg.GET("/problems/:id/comments", handleListComments)
	rg.POST("/problems/:id/comments", middleware.RequireAuth, handleCreateComment)
	rg.DELETE("/comments/:id", middleware.RequireAuth, handleDeleteComment)
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
