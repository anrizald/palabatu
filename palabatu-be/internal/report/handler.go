package report

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

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

func currentUserID(claims map[string]interface{}) string {
	id, _ := claims["id"].(string)
	return id
}

func handleReportComment(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	report, err := CreateCommentReport(c.Request.Context(), userID, id, body.Reason)
	writeReportResult(c, report, err)
}

func handleReportImage(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		URL    string `json:"url"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrCannotReportOwnContent):
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot report your own content."})
	case errors.Is(err, ErrReasonTooLong):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is too long"})
	case errors.Is(err, ErrInvalidTarget):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report target"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleListReports(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))

	reports, err := ListPending(c.Request.Context(), userID)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, reports)
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to view reports."})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}

func handleResolveReport(c *gin.Context) {
	userID := currentUserID(middleware.UserFromContext(c))
	id := c.Param("id")

	var body struct {
		Action string `json:"action"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := Resolve(c.Request.Context(), userID, id, body.Action)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"success": true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to resolve reports."})
	case errors.Is(err, ErrInvalidAction):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid resolution action"})
	case errors.Is(err, ErrAlreadyResolved):
		c.JSON(http.StatusConflict, gin.H{"error": "Report already resolved"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
