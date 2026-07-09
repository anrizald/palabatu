package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
	"palabatu-be/internal/service"
)

func handleListProblems(c *gin.Context) {
	problems, err := service.ListProblems(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, problems)
}

func handleCreateProblem(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))

	var body struct {
		Name      string   `json:"name"`
		Grade     string   `json:"grade"`
		Location  string   `json:"location"`
		Lat       float64  `json:"lat"`
		Lng       float64  `json:"lng"`
		ImageURLs []string `json:"image_urls"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	problem, err := service.CreateProblem(c.Request.Context(), userID, body.Name, body.Grade, body.Location, body.Lat, body.Lng, body.ImageURLs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, problem)
}

func handleUpdateProblem(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		Name  string `json:"name"`
		Grade string `json:"grade"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	problem, err := service.UpdateProblem(c.Request.Context(), userID, id, body.Name, body.Grade)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, service.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to edit this problem."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleDeleteProblem(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	err := service.DeleteProblem(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, service.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to delete this problem."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
