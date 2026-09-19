package social

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/auth"
	"palabatu-be/internal/middleware"
)

// CreateCommentRequest is handleCreateComment's request body.
type CreateCommentRequest struct {
	Content string `json:"content"`
}

// SendStatusResponse's json tag is deliberately "hasSent" (camelCase), not
// the app's usual snake_case, because that's the literal key palabatu-fe
// already reads (ProblemDetailPage.tsx: data.hasSent). Documented as-is,
// not normalized -- this is a documentation pass, not a wire-format change.
//
// HighPoint is the caller's own turned-back pitch on this route (handoff.md
// open item 14), null when they have none. It is private to them: this is the
// only place it is ever returned, and only to the person it belongs to.
type SendStatusResponse struct {
	HasSent   bool `json:"hasSent"`
	HighPoint *int `json:"highPoint"`
}

// SetHighPointRequest is handleSetHighPoint's request body.
type SetHighPointRequest struct {
	Pitch int `json:"pitch"`
}

// ActionResponse is shared by handleToggleSend ("sent"/"unsent") and
// handleToggleReaction ("added"/"removed").
type ActionResponse struct {
	Action string `json:"action"`
}

// Routes registers the social domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	// Per-IP: 20 comments/minute (burst 5), enough for real conversation
	// while blunting spam/flood posting.
	limitComments := middleware.RateLimit(3*time.Second, 5)

	rg.GET("/problems/:id/send-status", middleware.RequireAuth, handleSendStatus)
	rg.POST("/problems/:id/send", middleware.RequireAuth, handleToggleSend)
	rg.PUT("/problems/:id/high-point", middleware.RequireAuth, handleSetHighPoint)
	rg.DELETE("/problems/:id/high-point", middleware.RequireAuth, handleClearHighPoint)
	rg.GET("/sends/mine", middleware.RequireAuth, handleListMySends)

	rg.GET("/problems/:id/comments", handleListComments)
	rg.POST("/problems/:id/comments", middleware.RequireAuth, limitComments, handleCreateComment)
	rg.DELETE("/comments/:id", middleware.RequireAuth, handleDeleteComment)

	rg.GET("/profiles/:id/reactions", handleReactionCounts)
	rg.GET("/profiles/:id/reactions/status", middleware.RequireAuth, handleReactionStatus)
	rg.POST("/profiles/:id/reactions/:type", middleware.RequireAuth, handleToggleReaction)
}

// handleSendStatus godoc
// @Summary      Whether the authenticated user has sent this problem, and their own high point on it
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {object}  social.SendStatusResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/send-status [get]
func handleSendStatus(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	hasSent, err := HasSent(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	highPoint, err := GetHighPoint(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, SendStatusResponse{HasSent: hasSent, HighPoint: highPoint})
}

// handleSetHighPoint godoc
// @Summary      Record how far up a multi-pitch route the authenticated user got
// @Description  A private high point for a route the caller turned back from, one per climber per route (a new one replaces the old). Never counted as a send, notifies no one, and is cleared when the caller sends the route. Only a multi-pitch route on a wall has one, and pitch must be from 1 to the route's pitch count.
// @Tags         social
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                      true  "Problem ID"
// @Param        body  body      social.SetHighPointRequest  true  "Pitch reached"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      409   {object}  apitypes.ErrorResponse  "the caller has already sent this route"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/high-point [put]
func handleSetHighPoint(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body SetHighPointRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := SetHighPoint(c.Request.Context(), id, userID, body.Pitch)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrNotMultiPitch):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "This route is not multi-pitch"})
	case errors.Is(err, ErrInvalidHighPoint):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Pitch must be from 1 to the route's pitch count"})
	case errors.Is(err, ErrAlreadySent):
		c.JSON(http.StatusConflict, apitypes.ErrorResponse{Error: "You already topped this route out"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleClearHighPoint godoc
// @Summary      Clear the authenticated user's high point on a route
// @Description  Idempotent: clearing one that is not there still succeeds.
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/high-point [delete]
func handleClearHighPoint(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	if err := ClearHighPoint(c.Request.Context(), id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
}

// handleToggleSend godoc
// @Summary      Toggle a send (tick) on this problem
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {object}  social.ActionResponse  "action is sent or unsent"
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/send [post]
func handleToggleSend(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	action, err := ToggleSend(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, ActionResponse{Action: action})
}

// handleListMySends godoc
// @Summary      Problem IDs the authenticated user has sent
// @Description  Backs client-side "sent by me" filtering over a problem
// @Description  listing without an N+1 per-problem send-status call.
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   string
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/sends/mine [get]
func handleListMySends(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	ids, err := ListSentProblemIDs(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, ids)
}

// handleListComments godoc
// @Summary      List a problem's comments
// @Tags         social
// @Produce      json
// @Param        id   path      string  true  "Problem ID"
// @Success      200  {array}   social.Comment
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/comments [get]
func handleListComments(c *gin.Context) {
	id := c.Param("id")

	comments, err := ListComments(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, comments)
}

// handleCreateComment godoc
// @Summary      Add a comment to a problem
// @Tags         social
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                       true  "Problem ID"
// @Param        body  body      social.CreateCommentRequest  true  "Comment content"
// @Success      200   {object}  social.Comment
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/comments [post]
func handleCreateComment(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body CreateCommentRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	comment, err := CreateComment(c.Request.Context(), id, userID, body.Content)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, comment)
	case errors.Is(err, ErrEmptyComment):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Comment cannot be empty"})
	case errors.Is(err, ErrCommentTooLong):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Comment is too long"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// resolveProfileID accepts either a profile's real id or its public slug
// (see auth.ResolveUserID) — the reaction routes are mounted at
// /profiles/:id, which the frontend now addresses by slug.
func resolveProfileID(c *gin.Context, idOrSlug string) (string, bool) {
	id, err := auth.ResolveUserID(c.Request.Context(), idOrSlug)
	if err != nil {
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "User not found"})
		return "", false
	}
	return id, true
}

// handleReactionCounts godoc
// @Summary      Total reaction counts on a profile
// @Tags         social
// @Produce      json
// @Param        id   path      string  true  "Profile ID or slug"
// @Success      200  {object}  social.ReactionCounts
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id}/reactions [get]
func handleReactionCounts(c *gin.Context) {
	id, ok := resolveProfileID(c, c.Param("id"))
	if !ok {
		return
	}

	counts, err := GetReactionCounts(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, counts)
}

// handleReactionStatus godoc
// @Summary      Which reactions the authenticated user gave this profile
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Profile ID or slug"
// @Success      200  {object}  social.ReactionStatus
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id}/reactions/status [get]
func handleReactionStatus(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id, ok := resolveProfileID(c, c.Param("id"))
	if !ok {
		return
	}

	status, err := GetReactionStatus(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, status)
}

// handleToggleReaction godoc
// @Summary      Toggle a reaction on a profile
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string  true  "Profile ID or slug"
// @Param        type  path      string  true  "Reaction type: like, fire, or heart"
// @Success      200   {object}  social.ActionResponse  "action is added or removed"
// @Failure      400   {object}  apitypes.ErrorResponse  "invalid reaction type"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/profiles/{id}/reactions/{type} [post]
func handleToggleReaction(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id, ok := resolveProfileID(c, c.Param("id"))
	if !ok {
		return
	}
	reactionType := c.Param("type")

	action, err := ToggleReaction(c.Request.Context(), id, userID, reactionType)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, ActionResponse{Action: action})
	case errors.Is(err, ErrInvalidReactionType):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid reaction type"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleDeleteComment godoc
// @Summary      Delete a comment
// @Description  Allowed for the comment's own author or an admin.
// @Tags         social
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Comment ID"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      403  {object}  apitypes.ErrorResponse
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/comments/{id} [delete]
func handleDeleteComment(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	err := DeleteComment(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to delete this comment."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
