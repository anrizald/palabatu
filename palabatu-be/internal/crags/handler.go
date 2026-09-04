package crags

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the crags domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/crags", handleListCrags)
	rg.GET("/crags/:id", handleGetCrag)
	rg.POST("/crags", middleware.RequireAuth, handleCreateCrag)
	rg.PUT("/crags/:id", middleware.RequireAuth, handleUpdateCrag)
	rg.POST("/crags/:id/images", middleware.RequireAuth, handleAddCragImages)
	rg.DELETE("/crags/:id/images", middleware.RequireAuth, handleDeleteCragImage)
}

// handleListCrags godoc
// @Summary      List all crags
// @Tags         crags
// @Produce      json
// @Success      200  {array}   crags.CragListItem
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/crags [get]
func handleListCrags(c *gin.Context) {
	list, err := ListCrags(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// handleGetCrag godoc
// @Summary      Get a crag
// @Tags         crags
// @Produce      json
// @Param        id   path      string  true  "Crag ID"
// @Success      200  {object}  crags.CragListItem
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id} [get]
func handleGetCrag(c *gin.Context) {
	id := c.Param("id")

	crag, err := GetCrag(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, crag)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleCreateCrag godoc
// @Summary      Create a crag
// @Description  Any authenticated user may create a crag; no role gate.
// @Tags         crags
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      crags.CreateCragRequest  true  "New crag"
// @Success      200   {object}  crags.Crag
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/crags [post]
func handleCreateCrag(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body CreateCragRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	crag, err := CreateCrag(c.Request.Context(), userID, body.Name, body.Lat, body.Lng, body.Directions, body.AccessNotes, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, crag)
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location must be within Indonesia"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleUpdateCrag godoc
// @Summary      Update a crag
// @Description  Allowed for admins (Council/Associate title) on any crag, or the crag's own creator.
// @Tags         crags
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                  true  "Crag ID"
// @Param        body  body      crags.UpdateCragRequest  true  "Updated fields"
// @Success      200   {object}  crags.Crag
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse  "not the creator and not an admin"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id} [put]
func handleUpdateCrag(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body UpdateCragRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	crag, err := UpdateCrag(c.Request.Context(), userID, id, body.Name, body.Lat, body.Lng, body.Directions, body.AccessNotes)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, crag)
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location must be within Indonesia"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this crag."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleAddCragImages godoc
// @Summary      Add images to a crag
// @Description  Appends URLs already uploaded via POST /upload/topo to a crag's image_urls -- the approach shot.
// @Tags         crags
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                       true  "Crag ID"
// @Param        body  body      crags.AddCragImagesRequest  true  "Uploaded image URLs to attach"
// @Success      200   {object}  crags.Crag
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id}/images [post]
func handleAddCragImages(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body AddCragImagesRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	crag, err := AddCragImages(c.Request.Context(), userID, id, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, crag)
	case errors.Is(err, ErrNoImages):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "No images provided"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this crag."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteCragImage godoc
// @Summary      Remove one image from a crag
// @Tags         crags
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                          true  "Crag ID"
// @Param        body  body      crags.DeleteCragImageRequest  true  "Image URL to remove"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse  "crag or image not found"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id}/images [delete]
func handleDeleteCragImage(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body DeleteCragImageRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := DeleteCragImage(c.Request.Context(), userID, id, body.URL)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this crag."})
	case errors.Is(err, ErrImageNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Image not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
