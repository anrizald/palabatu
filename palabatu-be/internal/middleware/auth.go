package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"palabatu-be/internal/apitypes"
)

const userContextKey = "user"

// AuthUser is the authenticated caller, extracted once from JWT claims by
// RequireAuth. Handlers read it via UserFromContext instead of pulling
// "id" out of a raw claims map by hand.
type AuthUser struct {
	ID string
}

func RequireAuth(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, apitypes.ErrorResponse{Error: "Unauthorized"})
		return
	}
	token := parts[1]

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, apitypes.ErrorResponse{Error: "Invalid token"})
		return
	}

	id, _ := claims["id"].(string)
	c.Set(userContextKey, AuthUser{ID: id})
	c.Next()
}

// UserFromContext returns the authenticated user attached by RequireAuth.
func UserFromContext(c *gin.Context) AuthUser {
	user, _ := c.Get(userContextKey)
	authUser, _ := user.(AuthUser)
	return authUser
}
