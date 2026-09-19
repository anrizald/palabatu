package drafts

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the drafts domain's routes on the /api group. Every
// route requires auth and is scoped to the caller -- there is no public or
// admin surface here (handoff-drafts.md decision 7: private to the owner).
func Routes(rg *gin.RouterGroup) {
	rg.GET("/drafts", middleware.RequireAuth, handleListDrafts)
	rg.POST("/drafts", middleware.RequireAuth, handleCreateDraft)
	rg.GET("/drafts/:id", middleware.RequireAuth, handleGetDraft)
	rg.PUT("/drafts/:id", middleware.RequireAuth, handleUpdateDraft)
	rg.DELETE("/drafts/:id", middleware.RequireAuth, handleDeleteDraft)
}

// handleListDrafts godoc
// @Summary      List the caller's own add-sheet drafts
// @Description  Newest-updated first. List items omit payload -- the drafts overlay only needs id/intent/label/updated_at to render its rows.
// @Tags         drafts
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   drafts.DraftListItem
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/drafts [get]
func handleListDrafts(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	list, err := ListDrafts(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// handleGetDraft godoc
// @Summary      Get one draft's full payload
// @Description  Fetched when resuming a draft from the drafts overlay.
// @Tags         drafts
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Draft ID"
// @Success      200  {object}  drafts.Draft
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/drafts/{id} [get]
func handleGetDraft(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	d, err := GetDraft(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, d)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleCreateDraft godoc
// @Summary      Create a draft
// @Description  The first autosave of an add-sheet session (handoff-drafts.md decision 3) -- created lazily, on the first real edit, not on opening the sheet.
// @Tags         drafts
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      drafts.CreateDraftRequest  true  "New draft"
// @Success      200   {object}  drafts.Draft
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/drafts [post]
func handleCreateDraft(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	var body CreateDraftRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	d, err := CreateDraft(c.Request.Context(), userID, body.Intent, body.Label, body.Payload, body.PhotoURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, d)
	case errors.Is(err, ErrInvalidIntent):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid intent"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleUpdateDraft godoc
// @Summary      Update a draft
// @Description  Every autosave after the first. Any photo URL the previous version carried that this one doesn't is a provisional upload this write orphaned, and is best-effort destroyed in Cloudinary (handoff-drafts.md decision 10).
// @Tags         drafts
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                     true  "Draft ID"
// @Param        body  body      drafts.UpdateDraftRequest  true  "Updated draft"
// @Success      200   {object}  drafts.Draft
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/drafts/{id} [put]
func handleUpdateDraft(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body UpdateDraftRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	d, err := UpdateDraft(c.Request.Context(), userID, id, body.Label, body.Payload, body.PhotoURLs)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, d)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteDraft godoc
// @Summary      Delete a draft
// @Description  Explicit removal from the drafts overlay, or the client's own best-effort cleanup after the draft was submitted for real (handoff-drafts.md decision 5). Destroys every photo the draft ever staged, unless keep_photos=true -- the post-submit case, where those URLs are now the real problem/boulder/crag's own photo.
// @Tags         drafts
// @Produce      json
// @Security     BearerAuth
// @Param        id            path      string  true   "Draft ID"
// @Param        keep_photos   query     bool    false  "Skip Cloudinary cleanup -- pass true only when the draft's photos were just reused as a real entity's own photo"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/drafts/{id} [delete]
func handleDeleteDraft(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")
	keepPhotos := c.Query("keep_photos") == "true"

	err := DeleteDraft(c.Request.Context(), userID, id, keepPhotos)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
