package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"palabatu-be/internal/httpx"
)

type contextKey string

const userContextKey contextKey = "user"

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
			httpx.WriteJSON(w, http.StatusUnauthorized, map[string]string{"message": "Unauthorized"})
			return
		}
		token := parts[1]

		claims := jwt.MapClaims{}
		_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err != nil {
			httpx.WriteJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid token"})
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UserFromContext returns the decoded JWT claims attached by RequireAuth,
// mirroring how (req as any).user is read in the Node backend's routes.
func UserFromContext(r *http.Request) jwt.MapClaims {
	claims, _ := r.Context().Value(userContextKey).(jwt.MapClaims)
	return claims
}
