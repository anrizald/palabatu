package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/service"
)

func handleGetProfile(c *gin.Context) {
	id := c.Param("id")

	profile, err := service.GetProfile(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func handleUpsertProfile(c *gin.Context) {
	id := c.Param("id")

	var body struct {
		Username  string          `json:"username"`
		Title     json.RawMessage `json:"title"`
		Tags      json.RawMessage `json:"tags"`
		AvatarURL string          `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	profile, err := service.UpsertProfile(c.Request.Context(), id, body.Username, body.Title, body.Tags, body.AvatarURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, profile)
}
