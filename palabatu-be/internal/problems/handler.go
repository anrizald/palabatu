package problems

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// Routes registers the problems domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/problems", handleListProblems)
	rg.GET("/problems/:id", handleGetProblem)
	rg.POST("/problems", middleware.RequireAuth, handleCreateProblem)
	rg.PUT("/problems/:id", middleware.RequireAuth, handleUpdateProblem)
	rg.DELETE("/problems/:id", middleware.RequireAuth, handleDeleteProblem)
	rg.DELETE("/problems/:id/images", middleware.RequireAuth, handleDeleteProblemImage)
	rg.GET("/problems/:id/annotations", handleListAnnotations)
	rg.PUT("/problems/:id/annotations", middleware.RequireAuth, handleSaveAnnotation)

	rg.POST("/upload/topo", middleware.RequireAuth, handleUploadTopo)
	rg.POST("/upload/avatar", middleware.RequireAuth, handleUploadAvatar)
}

// currentUserID reads the "id" claim attached by middleware.RequireAuth,
// mirroring (req as any).user.id in the Node routes.
func currentUserID(claims map[string]interface{}) string {
	id, _ := claims["id"].(string)
	return id
}

func handleListProblems(c *gin.Context) {
	problems, err := ListProblems(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, problems)
}

func handleGetProblem(c *gin.Context) {
	id := c.Param("id")

	problem, err := GetProblem(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
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

	problem, err := CreateProblem(c.Request.Context(), userID, body.Name, body.Grade, body.Location, body.Lat, body.Lng, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrInvalidGrade):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid grade"})
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Location must be within Indonesia"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleUpdateProblem(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		Name         string  `json:"name"`
		Grade        string  `json:"grade"`
		LocationName string  `json:"location_name"`
		Lat          float64 `json:"lat"`
		Lng          float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	problem, err := UpdateProblem(c.Request.Context(), userID, id, body.Name, body.Grade, body.LocationName, body.Lat, body.Lng)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrInvalidGrade):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid grade"})
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Location must be within Indonesia"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to edit this problem."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleDeleteProblem(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	err := DeleteProblem(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to delete this problem."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleDeleteProblemImage(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		URL string `json:"url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := DeleteProblemImage(c.Request.Context(), userID, id, body.URL)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to edit this problem."})
	case errors.Is(err, ErrImageNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
