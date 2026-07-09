package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/db"
	"palabatu-be/internal/handler"
	"palabatu-be/internal/metrics"
)

// stripTrailingSlash makes "/foo" and "/foo/" match the same route, mirroring
// Express's default (non-strict) routing. It has to run as a raw http.Handler
// wrapper, not a gin middleware: gin resolves routes (and would otherwise
// 301/307-redirect a trailing slash) before any r.Use() middleware runs, and
// a redirected POST is fragile across CORS (body replay, extra preflight).
// palabatu-fe calls some endpoints with a trailing slash, e.g.
// POST /api/upload/avatar/.
func stripTrailingSlash(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if len(req.URL.Path) > 1 && strings.HasSuffix(req.URL.Path, "/") {
			req.URL.Path = strings.TrimRight(req.URL.Path, "/")
		}
		next.ServeHTTP(w, req)
	})
}

func main() {
	_ = godotenv.Load()

	db.Connect()
	cloudinary.Connect()

	r := gin.New()

	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(metrics.Middleware)

	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://localhost:4173",
			"http://192.168.0.100:5173",
			"http://192.168.0.101:5173",
		},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	handler.AuthRoutes(r.Group("/auth"))
	handler.APIRoutes(r.Group("/api"))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Server running on port %s", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, stripTrailingSlash(r)))
}
