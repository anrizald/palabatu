package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const userContextKey = "user"

func RequireAuth(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	token := parts[1]

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Invalid token"})
		return
	}

	c.Set(userContextKey, claims)
	c.Next()
}

// UserFromContext returns the decoded JWT claims attached by RequireAuth,
// mirroring how (req as any).user is read in the Node backend's routes.
func UserFromContext(c *gin.Context) jwt.MapClaims {
	claims, _ := c.Get(userContextKey)
	mapClaims, _ := claims.(jwt.MapClaims)
	return mapClaims
}
