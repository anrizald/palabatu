package problems

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the problems domain's routes on the /api group. Image
// upload/attach/remove now live on internal/boulders (the photo belongs to
// the boulder, not the problem) -- only the generic Cloudinary-upload
// endpoints stay here, since they're entity-agnostic.
func Routes(rg *gin.RouterGroup) {
	// Uploads are authenticated but were otherwise unbounded -- a burst of
	// them isn't just extra DB/CPU load like other endpoints, it's billed
	// Cloudinary traffic, so this gets its own limiter beyond the blanket
	// /api one in main.go.
	limitUploads := middleware.RateLimit(5*time.Second, 3)

	rg.GET("/problems", handleListProblems)
	rg.GET("/problems/:id", handleGetProblem)
	rg.POST("/problems", middleware.RequireAuth, handleCreateProblem)
	rg.PUT("/problems/:id", middleware.RequireAuth, handleUpdateProblem)
	rg.DELETE("/problems/:id", middleware.RequireAuth, handleDeleteProblem)
	rg.GET("/problems/:id/annotations", handleListAnnotations)
	rg.PUT("/problems/:id/annotations", middleware.RequireAuth, handleSaveAnnotation)
	rg.POST("/problems/:id/images", middleware.RequireAuth, handleAddProblemImages)
	rg.DELETE("/problems/:id/images", middleware.RequireAuth, handleDeleteProblemImage)

	rg.POST("/upload/topo", middleware.RequireAuth, limitUploads, handleUploadTopo)
	rg.POST("/upload/avatar", middleware.RequireAuth, limitUploads, handleUploadAvatar)
}

// handleListProblems godoc
// @Summary      List all problems
// @Description  Optional crag_id/boulder_id query params filter to one crag or boulder.
// @Tags         problems
// @Produce      json
// @Param        crag_id     query     string  false  "Filter to one crag"
// @Param        boulder_id  query     string  false  "Filter to one boulder"
// @Success      200  {array}   problems.ProblemListItem
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems [get]
func handleListProblems(c *gin.Context) {
	cragID := c.Query("crag_id")
	boulderID := c.Query("boulder_id")

	problems, err := ListProblems(c.Request.Context(), cragID, boulderID)
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
// @Description  Any authenticated user may create a problem; no role gate. boulder_id is required -- crag_id is derived from the boulder, not supplied directly.
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

	problem, err := CreateProblem(
		c.Request.Context(), userID, body.Name, body.Grade, body.BoulderID,
		body.FirstAscensionist, body.DiscoveredBy, body.LandingHazards, body.Descent, body.Notes, body.HeightM,
		body.ImageURLs,
	)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrInvalidGrade):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid grade"})
	case errors.Is(err, ErrBoulderNotFound):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Boulder not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleUpdateProblem godoc
// @Summary      Update a problem
// @Description  Allowed for admins (Council/Associate title) on any problem, or the problem's own creator. A non-empty boulder_id re-parents the problem to a different rock, dropping any annotation it had (a line on the old rock's photo means nothing on the new one).
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

	problem, err := UpdateProblem(
		c.Request.Context(), userID, id, body.BoulderID, body.Name, body.Grade,
		body.FirstAscensionist, body.DiscoveredBy, body.LandingHazards, body.Descent, body.Notes, body.HeightM,
	)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, problem)
	case errors.Is(err, ErrInvalidGrade):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid grade"})
	case errors.Is(err, ErrBoulderNotFound):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Boulder not found"})
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
// @Description  Allowed for admins (Council/Associate title) on any problem, or the problem's own creator. Does not touch the boulder's shared photos -- only the problem row and its own annotation (cascades).
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

// handleAddProblemImages godoc
// @Summary      Add images to a problem
// @Description  Appends URLs already uploaded via POST /upload/topo to a problem's image_urls -- beta/action shots, never the topo base.
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                             true  "Problem ID"
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

// handleDeleteProblemImage godoc
// @Summary      Remove one image from a problem
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                               true  "Problem ID"
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
