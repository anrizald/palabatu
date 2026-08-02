package middleware

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// RequireOwner restricts a route to the single account identified by
// OWNER_USER_ID (godotenv, alongside JWT_SECRET), for the owner-only
// Developer page. Deliberately not a role/title: Council/Associate/Warden
// are community tiers meant to be held by more than one person, while this
// is for one account. Must be chained after RequireAuth so AuthUser is
// already on the context, mirroring RequireAuth's own chaining onto
// /session -- same secret, same one code path, no separate DB lookup.
func RequireOwner(c *gin.Context) {
	ownerID := os.Getenv("OWNER_USER_ID")
	if ownerID == "" || UserFromContext(c).ID != ownerID {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}
	c.Next()
}
