package report

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// ReportCommentRequest is handleReportComment's request body.
type ReportCommentRequest struct {
	Reason string `json:"reason"`
}

// ReportImageRequest is handleReportImage's request body.
type ReportImageRequest struct {
	URL    string `json:"url"`
	Reason string `json:"reason"`
}

// ResolveReportRequest is handleResolveReport's request body.
type ResolveReportRequest struct {
	Action string `json:"action"`
}

// Routes registers the report domain's routes on the /api group. Create
// routes live under /comments and /problems (matching social.Routes' own
// precedent of owning POST /problems/:id/comments) since route ownership
// here follows business logic, not URL prefix.
func Routes(rg *gin.RouterGroup) {
	limitReports := middleware.RateLimit(3*time.Second, 5)

	rg.POST("/comments/:id/report", middleware.RequireAuth, limitReports, handleReportComment)
	rg.POST("/problems/:id/images/report", middleware.RequireAuth, limitReports, handleReportImage)

	rg.GET("/reports", middleware.RequireAuth, handleListReports)
	rg.POST("/reports/:id/resolve", middleware.RequireAuth, handleResolveReport)
}

// handleReportComment godoc
// @Summary      Report a comment
// @Tags         report
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                  true  "Comment ID"
// @Param        body  body      report.ReportCommentRequest  true  "Report reason"
// @Success      200   {object}  report.Report
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse  "reporting your own content"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/comments/{id}/report [post]
func handleReportComment(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body ReportCommentRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	report, err := CreateCommentReport(c.Request.Context(), userID, id, body.Reason)
	writeReportResult(c, report, err)
}

// handleReportImage godoc
// @Summary      Report a problem's topo image
// @Tags         report
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                true  "Problem ID"
// @Param        body  body      report.ReportImageRequest  true  "Image URL and reason"
// @Success      200   {object}  report.Report
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse  "reporting your own content"
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/problems/{id}/images/report [post]
func handleReportImage(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body ReportImageRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	report, err := CreateImageReport(c.Request.Context(), userID, id, body.URL, body.Reason)
	writeReportResult(c, report, err)
}

func writeReportResult(c *gin.Context, rep *Report, err error) {
	switch {
	case err == nil:
		c.JSON(http.StatusOK, rep)
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrCannotReportOwnContent):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "You cannot report your own content."})
	case errors.Is(err, ErrReasonTooLong):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Reason is too long"})
	case errors.Is(err, ErrInvalidTarget):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid report target"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleListReports godoc
// @Summary      List pending reports
// @Description  Admin-only (Council/Associate title) moderation queue.
// @Tags         report
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   report.Report
// @Failure      403  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/reports [get]
func handleListReports(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	reports, err := ListPending(c.Request.Context(), userID)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, reports)
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to view reports."})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleResolveReport godoc
// @Summary      Resolve a report
// @Description  Admin-only. Action is either "remove" (deletes the reported content) or "dismiss".
// @Tags         report
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                       true  "Report ID"
// @Param        body  body      report.ResolveReportRequest  true  "Resolution action"
// @Success      200   {object}  apitypes.SuccessResponse
// @Failure      400   {object}  apitypes.ErrorResponse
// @Failure      403   {object}  apitypes.ErrorResponse
// @Failure      404   {object}  apitypes.ErrorResponse
// @Failure      409   {object}  apitypes.ErrorResponse  "report already resolved"
// @Failure      500   {object}  apitypes.ErrorResponse
// @Router       /api/reports/{id}/resolve [post]
func handleResolveReport(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	var body ResolveReportRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid request body"})
		return
	}

	err := Resolve(c.Request.Context(), userID, id, body.Action)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, apitypes.ErrorResponse{Error: "Not authorized to resolve reports."})
	case errors.Is(err, ErrInvalidAction):
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid resolution action"})
	case errors.Is(err, ErrAlreadyResolved):
		c.JSON(http.StatusConflict, apitypes.ErrorResponse{Error: "Report already resolved"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}
