package notification

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// Routes registers the notification domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/notifications", middleware.RequireAuth, handleList)
	rg.GET("/notifications/unread-count", middleware.RequireAuth, handleUnreadCount)
	rg.POST("/notifications/:id/read", middleware.RequireAuth, handleMarkRead)
	rg.POST("/notifications/read-all", middleware.RequireAuth, handleMarkAllRead)
}

func currentUserID(claims map[string]interface{}) string {
	id, _ := claims["id"].(string)
	return id
}

func handleList(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))

	items, err := List(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func handleUnreadCount(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))

	count, err := UnreadCount(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func handleMarkRead(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	err := MarkRead(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleMarkAllRead(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))

	if err := MarkAllRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
