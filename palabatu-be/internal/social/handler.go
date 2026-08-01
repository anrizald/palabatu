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
type SendStatusResponse struct {
	HasSent bool `json:"hasSent"`
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

	rg.GET("/problems/:id/comments", handleListComments)
	rg.POST("/problems/:id/comments", middleware.RequireAuth, limitComments, handleCreateComment)
	rg.DELETE("/comments/:id", middleware.RequireAuth, handleDeleteComment)

	rg.GET("/profiles/:id/reactions", handleReactionCounts)
	rg.GET("/profiles/:id/reactions/status", middleware.RequireAuth, handleReactionStatus)
	rg.POST("/profiles/:id/reactions/:type", middleware.RequireAuth, handleToggleReaction)
}

// handleSendStatus godoc
// @Summary      Whether the authenticated user has sent this problem
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
	c.JSON(http.StatusOK, SendStatusResponse{HasSent: hasSent})
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
