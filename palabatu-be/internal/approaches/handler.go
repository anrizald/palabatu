package approaches

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the approaches domain's routes on the /api group.
// GET /crags/:id/approaches uses ":id", not ":cragId", for the same reason
// boulders.Routes does -- gin's router requires the same wildcard name
// wherever two route trees share a path segment, and internal/crags already
// registered /crags/:id.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/crags/:id/approaches", handleListApproaches)
	rg.GET("/approaches/:id", handleGetApproach)
	rg.POST("/approaches", middleware.RequireAuth, handleCreateApproach)
	rg.DELETE("/approaches/:id", middleware.RequireAuth, handleDeleteApproach)
}

// handleListApproaches godoc
// @Summary      List a crag's approach guides
// @Description  "Jalan masuk" -- the walk in, photographed step by step. A crag may have several; each is a genuinely different walk.
// @Tags         approaches
// @Produce      json
// @Param        id  path      string  true  "Crag ID"
// @Success      200  {array}   approaches.ApproachListItem
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id}/approaches [get]
func handleListApproaches(c *gin.Context) {
	cragID := c.Param("id")

	list, err := ListApproaches(c.Request.Context(), cragID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// handleGetApproach godoc
// @Summary      Get an approach guide, with its ordered steps
// @Description  The reading view's one call -- every step, in order, ready for offline caching.
// @Tags         approaches
// @Produce      json
// @Param        id   path      string  true  "Approach ID"
// @Success      200  {object}  approaches.Approach
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/approaches/{id} [get]
func handleGetApproach(c *gin.Context) {
	id := c.Param("id")

	approach, err := GetApproach(c.Request.Context(), id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, approach)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleCreateApproach godoc
// @Summary      Create an approach guide
// @Description  Creates the approach and every step in one call. Requires at least one step, each with a photo and a caption. Gated by authz.CanContribute (creator-or-admin today, see handoff.md decision 22).
// @Tags         approaches
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      approaches.CreateApproachRequest  true  "New approach"
// @Success      200   {object}  approaches.Approach
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/approaches [post]
func handleCreateApproach(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body CreateApproachRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	approach, err := CreateApproach(c.Request.Context(), userID, body.CragID, body.Name, body.StartType, body.DurationMinutes, body.Steps)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, approach)
	case errors.Is(err, ErrInvalidStartType):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid start type"})
	case errors.Is(err, ErrNoSteps):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "At least one step is required"})
	case errors.Is(err, ErrInvalidStep):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Every step needs a photo and a caption"})
	case errors.Is(err, ErrCragNotFound):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Spot not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to add a way in here."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteApproach godoc
// @Summary      Delete an approach guide
// @Description  Allowed for admins (Council/Associate title), or the approach's own creator.
// @Tags         approaches
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Approach ID"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      403  {object}  apitypes.ErrorResponse
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/approaches/{id} [delete]
func handleDeleteApproach(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	err := DeleteApproach(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to remove this."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
