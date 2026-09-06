package crags

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// registerPurgeRoutes mounts the purge pair onto the same /api group
// crags.Routes uses, mirroring how boulders.registerMergeRoutes keeps its
// sub-flow's routes next to their own handlers rather than in the domain's
// main route list.
func registerPurgeRoutes(rg *gin.RouterGroup) {
	rg.GET("/crags/:id/purge-preview", middleware.RequireAuth, handlePurgePreview)
	rg.POST("/crags/:id/purge", middleware.RequireAuth, handlePurgeCrag)
}

// handlePurgePreview godoc
// @Summary      Preview what purging a crag would destroy
// @Description  Admin-only. Returns the counts a purge would remove and the full snapshot of every row involved, so an admin can save the record before committing. Read-only -- nothing is deleted.
// @Tags         crags
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Crag ID"
// @Success      200  {object}  crags.CragPurgePreview
// @Failure      403  {object}  apitypes.ErrorResponse  "not an admin"
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id}/purge-preview [get]
func handlePurgePreview(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	preview, err := PreviewPurge(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, preview)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Only an admin can do this."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handlePurgeCrag godoc
// @Summary      Purge a crag and everything under it
// @Description  Admin-only, irreversible. Deletes the crag, its rocks, its problems, and every send, comment, drawn line, report and approach guide beneath them, destroys the associated Cloudinary assets, and notifies each affected problem creator. The request must carry the exact counts returned by the preview: if the crag has changed since, the purge is refused rather than silently taking the difference with it. The response body holds the only surviving record of what was deleted.
// @Tags         crags
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                  true  "Crag ID"
// @Param        body  body      crags.CragPurgeRequest  true  "Counts confirmed from the preview"
// @Success      200   {object}  crags.CragPurgeResult
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse  "not an admin"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      409   {object}  apitypes.ErrorResponse  "confirmation does not match what is there now"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/crags/{id}/purge [post]
func handlePurgeCrag(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body CragPurgeRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	result, err := PurgeCrag(c.Request.Context(), userID, id, body.Expected)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, result)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Only an admin can do this."})
	case errors.Is(err, ErrCountMismatch):
		c.JSON(http.StatusConflict, apitypes.ErrorResponse{Error: "This spot changed since you checked it. Look again before purging."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
