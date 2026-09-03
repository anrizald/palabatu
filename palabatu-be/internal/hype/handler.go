package hype

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
	"palabatu-be/internal/middleware"
)

// Routes registers the hype domain's routes. Both are public and
// unauthenticated by design -- this is a coming-soon-page cheer button, not
// a moderated action -- but they deliberately land on two different groups:
//
//   - GET /hype goes on rg (the standard apiGroup, same as every other
//     read in the app), so it gets the ordinary blanket /api backstop like
//     any other listing. The frontend polls this on an interval to pick up
//     other visitors' clicks (see UnderConstruction.tsx), so it needs to
//     stay a normal, cheap, blanket-protected read -- it has no reason to
//     share the click route's generous exemption below.
//   - POST /hype/click goes on clickGroup, which main.go deliberately does
//     NOT wrap in the blanket /api rate limiter (burst 20, 10/s -- sized
//     for "a page load fires a handful of GETs," not for a button whose
//     entire point is to be mashed). This route's own limiter is its
//     *only* throttle, sized generously on purpose: burst 200 means a
//     normal enthusiastic session -- even minutes of on-and-off tapping --
//     never touches it at all, and 3/s sustained after that still lets a
//     genuinely long session through, just at a ceiling meant for an
//     unattended script rather than a real person. The failure mode this
//     is tuned against is a real fan's later taps silently not counting --
//     two earlier, tighter versions of this limiter did exactly that (see
//     git history around 2026-09-03). This costs nothing visually even
//     when it does trigger -- the frontend increments optimistically and
//     never waits on this response, so a throttled request just doesn't
//     get counted server-side, it doesn't make the button feel
//     unresponsive.
//
// Neither of these, nor any other per-IP limiter in this app, addresses a
// distributed (multi-IP/botnet) flood -- see edge_protection_handoff.md at
// the repo root and CLAUDE.md's "Known WIP rough edges."
func Routes(rg *gin.RouterGroup, clickGroup *gin.RouterGroup) {
	limitClick := middleware.RateLimit(333*time.Millisecond, 200)
	rg.GET("/hype", handleGet)
	clickGroup.POST("/hype/click", limitClick, handleClick)
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
