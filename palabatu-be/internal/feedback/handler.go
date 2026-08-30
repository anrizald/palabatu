package feedback

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// SubmitFeedbackRequest is handleSubmit's request body. Type is one of
// validFeedbackTypes (service.go); blank defaults to "feedback" server-side.
type SubmitFeedbackRequest struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Email   string `json:"email"`
	PageURL string `json:"page_url"`
}

// Routes registers the feedback domain's routes on the /api group. The
// submit route is public and per-IP rate-limited (mirroring
// internal/waitlist's pattern) rather than behind middleware.RequireAuth,
// since the form is deliberately open to logged-out visitors; it still runs
// middleware.OptionalAuth so a logged-in submitter's user_id gets attached
// when possible. The review-list routes reuse the same RequireAuth+
// RequireOwner gate internal/devtools already established, kept here
// instead of in internal/devtools so the table-owning package stays in
// charge of its own data.
func Routes(rg *gin.RouterGroup) {
	limitSubmit := middleware.RateLimit(5*time.Second, 3)
	rg.POST("/feedback", limitSubmit, middleware.OptionalAuth, handleSubmit)

	dev := rg.Group("/feedback", middleware.RequireAuth, middleware.RequireOwner)
	dev.GET("", handleList)
	dev.POST("/:id/reviewed", handleMarkReviewed)
}

// handleSubmit godoc
// @Summary      Submit feedback
// @Description  Public, rate-limited (3 per 5s per IP). Open to logged-out visitors -- runs OptionalAuth so a logged-in submitter's user_id is attached when present.
// @Tags         feedback
// @Accept       json
// @Produce      json
// @Param        body  body      feedback.SubmitFeedbackRequest  true  "Feedback submission"
// @Success      201   {object}  feedback.Feedback
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/feedback [post]
func handleSubmit(c *gin.Context) {
	var body SubmitFeedbackRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	var userID *string
	if id := middleware.UserFromContext(c).ID; id != "" {
		userID = &id
	}

	f, err := Submit(c.Request.Context(), userID, body.Type, body.Message, body.Email, body.PageURL)
	switch {
	case err == nil:
		c.JSON(http.StatusCreated, f)
	case errors.Is(err, ErrEmptyMessage):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Message is required"})
	case errors.Is(err, ErrMessageTooLong):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Message is too long"})
	case errors.Is(err, ErrInvalidType):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid feedback type"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleList godoc
// @Summary      List open feedback
// @Description  Owner-only.
// @Tags         feedback
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   feedback.Feedback
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/feedback [get]
func handleList(c *gin.Context) {
	items, err := ListOpen(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, items)
}

// handleMarkReviewed godoc
// @Summary      Mark a feedback submission reviewed
// @Description  Owner-only.
// @Tags         feedback
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Feedback ID"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/feedback/{id}/reviewed [post]
func handleMarkReviewed(c *gin.Context) {
	err := MarkReviewed(c.Request.Context(), c.Param("id"))
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
