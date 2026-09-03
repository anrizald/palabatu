package hype

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the hype domain's routes onto /api. Both are public and
// unauthenticated by design -- this is a coming-soon-page cheer button, not
// a moderated action.
//
// The click endpoint is deliberately mounted in main.go on its own route
// group rather than the shared apiGroup every other domain uses, so it does
// NOT stack under the blanket /api rate limiter (burst 20, 10/s -- sized
// for "a page load fires a handful of GETs," not for a button whose entire
// point is to be mashed). This limiter is the *only* throttle on the route,
// sized generously on purpose: burst 200 means a normal enthusiastic
// session -- even minutes of on-and-off tapping -- never touches it at all,
// and 3/s sustained after that still lets a genuinely long session through,
// just at a ceiling meant for an unattended script rather than a real
// person. The failure mode this is tuned against is a real fan's later taps
// silently not counting -- two earlier, tighter versions of this limiter
// did exactly that (see git history around 2026-09-03). This costs nothing
// visually even when it does trigger -- the frontend increments
// optimistically (see UnderConstruction.tsx) and never waits on this
// response, so a throttled request just doesn't get counted server-side, it
// doesn't make the button feel unresponsive. None of this addresses a
// distributed (multi-IP/botnet) flood -- no per-IP limiter can -- see
// CLAUDE.md's "Known WIP rough edges" for the still-open network-edge
// decision.
func Routes(rg *gin.RouterGroup) {
	limitClick := middleware.RateLimit(333*time.Millisecond, 200)
	rg.GET("/hype", handleGet)
	rg.POST("/hype/click", limitClick, handleClick)
}

// handleGet godoc
// @Summary      Get the hype counter
// @Description  Returns the current total of the "Allez" cheer button on the under-construction page.
// @Tags         hype
// @Produce      json
// @Success      200  {object}  apitypes.CountResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/hype [get]
func handleGet(c *gin.Context) {
	count, err := GetCount(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, apitypes.CountResponse{Count: count})
}

// handleClick godoc
// @Summary      Click the hype counter
// @Description  Increments the "Allez" cheer counter by one and returns the new total.
// @Tags         hype
// @Produce      json
// @Success      200  {object}  apitypes.CountResponse
// @Failure      500  {object}  apitypes.ErrorResponse
// @Router       /api/hype/click [post]
func handleClick(c *gin.Context) {
	count, err := Click(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}
	c.JSON(http.StatusOK, apitypes.CountResponse{Count: count})
}
