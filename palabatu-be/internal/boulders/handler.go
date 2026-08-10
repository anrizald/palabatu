package boulders

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the boulders domain's routes -- core boulder CRUD/images
// here, the boulder-merge sub-flow in merge_handler.go -- on the /api
// group.
func Routes(rg *gin.RouterGroup) {
	// Uses :id, not :cragId, for the crag path param -- gin's router
	// requires the same wildcard name wherever two route trees share a
	// path segment, and internal/crags already registered /crags/:id.
	rg.GET("/crags/:id/boulders", handleListBoulders)
	rg.GET("/boulders/:id", handleGetBoulder)
	rg.POST("/boulders", middleware.RequireAuth, handleCreateBoulder)
	rg.PUT("/boulders/:id", middleware.RequireAuth, handleUpdateBoulder)
	rg.POST("/boulders/:id/images", middleware.RequireAuth, handleAddBoulderImages)
	rg.DELETE("/boulders/:id/images", middleware.RequireAuth, handleDeleteBoulderImage)
	rg.GET("/boulders/:id/annotations", handleListBoulderAnnotations)

	registerMergeRoutes(rg)
}

// handleListBoulders godoc
// @Summary      List a crag's boulders
// @Tags         boulders
// @Produce      json
// @Param        id  path      string  true  "Crag ID"
// @Success      200  {array}   boulders.BoulderListItem
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id}/boulders [get]
func handleListBoulders(c *gin.Context) {
	cragID := c.Param("id")

	list, err := ListBoulders(c.Request.Context(), cragID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// handleGetBoulder godoc
// @Summary      Get a boulder
// @Tags         boulders
// @Produce      json
// @Param        id   path      string  true  "Boulder ID"
// @Success      200  {object}  boulders.BoulderListItem
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/boulders/{id} [get]
func handleGetBoulder(c *gin.Context) {
	id := c.Param("id")

	boulder, err := GetBoulder(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, boulder)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleCreateBoulder godoc
// @Summary      Create a boulder
// @Description  Any authenticated user may add a boulder to any crag, including someone else's; no role gate.
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      boulders.CreateBoulderRequest  true  "New boulder"
// @Success      200   {object}  boulders.Boulder
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders [post]
func handleCreateBoulder(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body CreateBoulderRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	boulder, err := CreateBoulder(c.Request.Context(), userID, body.CragID, body.Name, body.Type, body.RockType, body.Lat, body.Lng, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, boulder)
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location must be within Indonesia"})
	case errors.Is(err, ErrInvalidType):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Type must be boulder or wall"})
	case errors.Is(err, ErrCragNotFound):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Crag not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleUpdateBoulder godoc
// @Summary      Update a boulder
// @Description  Allowed for admins (Council/Associate title) on any boulder, or the boulder's own creator. A non-empty crag_id re-parents the boulder to a different spot, cascading its problems' denormalized crag_id along with it.
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                     true  "Boulder ID"
// @Param        body  body      boulders.UpdateBoulderRequest  true  "Updated fields"
// @Success      200   {object}  boulders.Boulder
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse  "not the creator and not an admin"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders/{id} [put]
func handleUpdateBoulder(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body UpdateBoulderRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	boulder, err := UpdateBoulder(c.Request.Context(), userID, id, body.CragID, body.Name, body.Type, body.RockType, body.Lat, body.Lng)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, boulder)
	case errors.Is(err, ErrInvalidLocation):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Location must be within Indonesia"})
	case errors.Is(err, ErrInvalidType):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Type must be boulder or wall"})
	case errors.Is(err, ErrCragNotFound):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Crag not found"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this boulder."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleAddBoulderImages godoc
// @Summary      Add images to a boulder
// @Description  Appends URLs already uploaded via POST /upload/topo to a boulder's image_urls.
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                          true  "Boulder ID"
// @Param        body  body      boulders.AddBoulderImagesRequest  true  "Uploaded image URLs to attach"
// @Success      200   {object}  boulders.Boulder
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders/{id}/images [post]
func handleAddBoulderImages(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body AddBoulderImagesRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	boulder, err := AddBoulderImages(c.Request.Context(), userID, id, body.ImageURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, boulder)
	case errors.Is(err, ErrNoImages):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "No images provided"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this boulder."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteBoulderImage godoc
// @Summary      Remove one image from a boulder
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                            true  "Boulder ID"
// @Param        body  body      boulders.DeleteBoulderImageRequest  true  "Image URL to remove"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse  "boulder or image not found"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders/{id}/images [delete]
func handleDeleteBoulderImage(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body DeleteBoulderImageRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := DeleteBoulderImage(c.Request.Context(), userID, id, body.URL)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to edit this boulder."})
	case errors.Is(err, ErrImageNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Image not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleListBoulderAnnotations godoc
// @Summary      List every line drawn on a boulder's photos
// @Description  Every problem-on-this-boulder's annotation together -- one photo, many lines.
// @Tags         boulders
// @Produce      json
// @Param        id   path      string  true  "Boulder ID"
// @Success      200  {array}   boulders.BoulderAnnotation
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/boulders/{id}/annotations [get]
func handleListBoulderAnnotations(c *gin.Context) {
	id := c.Param("id")

	annotations, err := ListAnnotationsForBoulder(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, annotations)
}
