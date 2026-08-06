package problems

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the problems domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/problems", handleListProblems)
	rg.GET("/problems/:id", handleGetProblem)
	rg.POST("/problems", middleware.RequireAuth, handleCreateProblem)
	rg.PUT("/problems/:id", middleware.RequireAuth, handleUpdateProblem)
	rg.DELETE("/problems/:id", middleware.RequireAuth, handleDeleteProblem)
	rg.POST("/problems/:id/images", middleware.RequireAuth, handleAddProblemImages)
	rg.DELETE("/problems/:id/images", middleware.RequireAuth, handleDeleteProblemImage)
	rg.GET("/problems/:id/annotations", handleListAnnotations)
	rg.PUT("/problems/:id/annotations", middleware.RequireAuth, handleSaveAnnotation)

	rg.POST("/upload/topo", middleware.RequireAuth, handleUploadTopo)
	rg.POST("/upload/avatar", middleware.RequireAuth, handleUploadAvatar)
}

// handleListProblems godoc
// @Summary      List all problems
// @Tags         problems
// @Produce      json
// @Success      200  {array}   problems.ProblemListItem
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems [get]
func handleListProblems(c *gin.Context) {
	problems, err := ListProblems(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, problems)
}

// handleGetProblem godoc
// @Summary      Get a problem
// @Tags         problems
// @Produce      json
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {object}  problems.ProblemDetail
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id} [get]
func handleGetProblem(c *gin.Context) {
	id := c.Param("id")

	problem, err := GetProblem(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleCreateProblem godoc
// @Summary      Create a problem
// @Description  Any authenticated user may create a problem; no role gate.
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      problems.CreateProblemRequest  true  "New problem"
// @Success      200   {object}  problems.ProblemSummary
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems [post]
func handleCreateProblem(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body CreateProblemRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	problem, err := CreateProblem(c.Request.Context(), userID, body.Name, body.Grade, body.Location, body.Lat, body.Lng, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrInvalidGrade):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid grade"})
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location must be within Indonesia"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleUpdateProblem godoc
// @Summary      Update a problem
// @Description  Allowed for admins (Council/Associate title) on any problem, or the problem's own creator.
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                        true  "Problem ID"
// @Param        body  body      problems.UpdateProblemRequest  true  "Updated fields"
// @Success      200   {object}  problems.ProblemRow
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse  "not the creator and not an admin"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id} [put]
func handleUpdateProblem(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body UpdateProblemRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	problem, err := UpdateProblem(c.Request.Context(), userID, id, body.Name, body.Grade, body.LocationName, body.Lat, body.Lng)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrInvalidGrade):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid grade"})
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location must be within Indonesia"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this problem."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteProblem godoc
// @Summary      Delete a problem
// @Description  Allowed for admins (Council/Associate title) on any problem, or the problem's own creator. Also best-effort destroys its Cloudinary images.
// @Tags         problems
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      403  {object}  apitypes.ErrorResponse
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id} [delete]
func handleDeleteProblem(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	err := DeleteProblem(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to delete this problem."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteProblemImage godoc
// @Summary      Remove one image from a problem
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                            true  "Problem ID"
// @Param        body  body      problems.DeleteProblemImageRequest  true  "Image URL to remove"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse  "problem or image not found"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/images [delete]
func handleDeleteProblemImage(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body DeleteProblemImageRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := DeleteProblemImage(c.Request.Context(), userID, id, body.URL)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this problem."})
	case errors.Is(err, ErrImageNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Image not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleAddProblemImages godoc
// @Summary      Add images to a problem
// @Description  Appends URLs already uploaded via POST /upload/topo to a problem's image_urls.
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                      true  "Problem ID"
// @Param        body  body      problems.AddProblemImagesRequest  true  "Uploaded image URLs to attach"
// @Success      200   {object}  problems.ProblemRow
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/images [post]
func handleAddProblemImages(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body AddProblemImagesRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	problem, err := AddProblemImages(c.Request.Context(), userID, id, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrNoImages):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "No images provided"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this problem."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
