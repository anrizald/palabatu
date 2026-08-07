package boulders

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// registerMergeRoutes mounts the boulder-merge sub-flow onto the same
// router group handler.go's Routes uses. Kept separate for readability,
// same split as problems' annotation_handler.go alongside handler.go.
func registerMergeRoutes(rg *gin.RouterGroup) {
	rg.POST("/boulders/:id/merge-suggestions", middleware.RequireAuth, handleSuggestMerge)
	rg.POST("/boulders/merge-requests/:id/object", middleware.RequireAuth, handleObjectToMerge)
	rg.GET("/boulders/merge-requests", middleware.RequireAuth, handleListPendingMergeRequests)
	rg.POST("/boulders/merge-requests/:id/resolve", middleware.RequireAuth, handleResolveMergeRequest)
}

// handleSuggestMerge godoc
// @Summary      Suggest that two boulders are the same rock
// @Description  Any authenticated user may suggest a merge; executing one is admin-only (see resolve).
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                       true  "Boulder ID (the suggested duplicate)"
// @Param        body  body      boulders.SuggestMergeRequest  true  "The other boulder, and why"
// @Success      200   {object}  boulders.MergeRequest
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders/{id}/merge-suggestions [post]
func handleSuggestMerge(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body SuggestMergeRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	request, err := SuggestMerge(c.Request.Context(), userID, id, body.TargetBoulderID, body.Reason)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, request)
	case errors.Is(err, ErrCannotMergeSelf):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Cannot suggest a boulder is the same as itself"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleObjectToMerge godoc
// @Summary      Object to a suggested merge ("this is not the same rock")
// @Description  Only the source or target boulder's own creator may object. Informs the admin's decision, does not block it.
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                        true  "Merge request ID"
// @Param        body  body      boulders.ObjectToMergeRequest  true  "Why this isn't the same rock"
// @Success      200   {object}  boulders.MergeObjection
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      409   {object}  apitypes.ErrorResponse  "request already resolved"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders/merge-requests/{id}/object [post]
func handleObjectToMerge(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body ObjectToMergeRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	objection, err := ObjectToMerge(c.Request.Context(), userID, id, body.Body)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, objection)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrNotMergeCreator):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Only the boulder's creator may object."})
	case errors.Is(err, ErrAlreadyResolved):
		c.JSON(http.StatusConflict, apitypes.ErrorResponse{Error: "This merge request was already resolved"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleListPendingMergeRequests godoc
// @Summary      List pending boulder merge requests
// @Description  Admin-only (Council/Associate title) review queue, with every objection filed against each request embedded.
// @Tags         boulders
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   boulders.MergeRequestListItem
// @Failure      403  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/boulders/merge-requests [get]
func handleListPendingMergeRequests(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	requests, err := ListPendingMergeRequests(c.Request.Context(), userID)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, requests)
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Admin only."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleResolveMergeRequest godoc
// @Summary      Resolve a boulder merge request
// @Description  Admin-only. action="merge" requires survivor_id (the admin's pick of which boulder survives) and is blocked by a 48h objection hold unless override_hold is set. action="reject" needs no wait.
// @Tags         boulders
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                              true  "Merge request ID"
// @Param        body  body      boulders.ResolveMergeRequestRequest  true  "Decision"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      409   {object}  apitypes.ErrorResponse  "already resolved, or the 48h hold hasn't expired"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/boulders/merge-requests/{id}/resolve [post]
func handleResolveMergeRequest(c *gin.Context) {
	adminID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body ResolveMergeRequestRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := ResolveMergeRequest(c.Request.Context(), adminID, id, body.Action, body.SurvivorID, body.OverrideHold)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrInvalidAction):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid action"})
	case errors.Is(err, ErrInvalidSurvivor):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "survivor_id must be the source or target boulder"})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Admin only."})
	case errors.Is(err, ErrAlreadyResolved):
		c.JSON(http.StatusConflict, apitypes.ErrorResponse{Error: "This merge request was already resolved"})
	case errors.Is(err, ErrHoldNotExpired):
		c.JSON(http.StatusConflict, apitypes.ErrorResponse{Error: "The 48-hour objection window hasn't closed yet"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
