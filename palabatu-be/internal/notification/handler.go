package notification

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the notification domain's routes on the /api group.
func Routes(rg *gin.RouterGroup) {
	rg.GET("/notifications", middleware.RequireAuth, handleList)
	rg.GET("/notifications/unread-count", middleware.RequireAuth, handleUnreadCount)
	rg.POST("/notifications/:id/read", middleware.RequireAuth, handleMarkRead)
	rg.POST("/notifications/read-all", middleware.RequireAuth, handleMarkAllRead)
}

// handleList godoc
// @Summary      List notifications
// @Description  Returns the authenticated user's notifications, newest first.
// @Tags         notification
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   notification.Notification
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/notifications [get]
func handleList(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	items, err := List(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, items)
}

// handleUnreadCount godoc
// @Summary      Unread notification count
// @Tags         notification
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  apitypes.CountResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/notifications/unread-count [get]
func handleUnreadCount(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	count, err := UnreadCount(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, apitypes.CountResponse{Count: count})
}

// handleMarkRead godoc
// @Summary      Mark one notification read
// @Tags         notification
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Notification ID"
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      404  {object}  apitypes.ErrorResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/notifications/{id}/read [post]
func handleMarkRead(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID
	id := c.Param("id")

	err := MarkRead(c.Request.Context(), userID, id)
	switch {
	case err == nil:
		c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, apitypes.ErrorResponse{Error: "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
	}
}

// handleMarkAllRead godoc
// @Summary      Mark all notifications read
// @Tags         notification
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  apitypes.SuccessResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/notifications/read-all [post]
func handleMarkAllRead(c *gin.Context) {
	userID := middleware.UserFromContext(c).ID

	if err := MarkAllRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, apitypes.SuccessResponse{Success: true})
}
