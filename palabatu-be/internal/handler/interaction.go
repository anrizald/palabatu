package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
	"palabatu-be/internal/service"
)

func handleSendStatus(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	hasSent, err := service.HasSent(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"hasSent": hasSent})
}

func handleToggleSend(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	action, err := service.ToggleSend(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"action": action})
}

func handleListComments(c *gin.Context) {
	id := c.Param("id")

	comments, err := service.ListComments(c.Request.Context(), id)
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

	comment, err := service.CreateComment(c.Request.Context(), id, userID, body.Content)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, comment)
	case errors.Is(err, service.ErrEmptyComment):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment cannot be empty"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
