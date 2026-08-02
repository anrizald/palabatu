package problems

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// handleListAnnotations godoc
// @Summary      List a problem's topo annotations
// @Tags         problems
// @Produce      json
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {array}   problems.AnnotationRecord
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/annotations [get]
func handleListAnnotations(c *gin.Context) {
	id := c.Param("id")

	annotations, err := ListAnnotations(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, annotations)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleSaveAnnotation godoc
// @Summary      Save a topo image's annotation
// @Description  One vector-shape overlay per (problem, image_url). Allowed for admins or the problem's own creator.
// @Tags         problems
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                         true  "Problem ID"
// @Param        body  body      problems.SaveAnnotationRequest  true  "Image URL and shape data"
// @Success      200   {object}  problems.AnnotationRecord
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse  "problem or image not found"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/annotations [put]
func handleSaveAnnotation(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body SaveAnnotationRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	annotation, err := SaveAnnotation(c.Request.Context(), userID, id, body.URL, body.Data)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, annotation)
	case errors.Is(err, ErrInvalidAnnotation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid annotation data"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrImageNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Image not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this problem."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
