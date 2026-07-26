package problems

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

func handleListAnnotations(c *gin.Context) {
	id := c.Param("id")

	annotations, err := ListAnnotations(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, annotations)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleSaveAnnotation(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body struct {
		URL  string          `json:"url"`
		Data json.RawMessage `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	annotation, err := SaveAnnotation(c.Request.Context(), userID, id, body.URL, body.Data)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, annotation)
	case errors.Is(err, ErrInvalidAnnotation):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid annotation data"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrImageNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to edit this problem."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
