package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"palabatu-be/internal/auth"
	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/db"
	"palabatu-be/internal/devtools"
	"palabatu-be/internal/feedback"
	"palabatu-be/internal/metrics"
	"palabatu-be/internal/notification"
	"palabatu-be/internal/problems"
	"palabatu-be/internal/report"
	"palabatu-be/internal/social"
	"palabatu-be/internal/waitlist"
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

// @title        Palabatu API
// @version      1.0
// @description  Backend API for Palabatu, a community app for Indonesian bouldering enthusiasts (spot map, climber profiles, route/problem listings, comments, reactions, reports).
// @host         localhost:3001
// @BasePath     /
// @securityDefinitions.apikey  BearerAuth
// @in                          header
// @name                        Authorization
// @description                 Type "Bearer" followed by a space and the JWT, e.g. "Bearer eyJhbGc...".
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
			"https://palabatu.id",
			"https://www.palabatu.id",
			"http://localhost:5173",
			"http://localhost:4173",
			"http://192.168.0.100:5173",
			"http://192.168.0.101:5173",
			"http://192.168.0.102:5173",
		},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	r.GET("/healthz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		if err := db.Pool.Ping(ctx); err != nil {
			c.String(http.StatusServiceUnavailable, "database unreachable: %v", err)
			return
		}
		c.Status(http.StatusOK)
	})

	apiGroup := r.Group("/api")

	auth.AuthRoutes(r.Group("/auth"))
	auth.ProfileRoutes(apiGroup)
	problems.Routes(apiGroup)
	social.Routes(apiGroup)
	report.Routes(apiGroup)
	notification.Routes(apiGroup)
	waitlist.Routes(apiGroup)
	devtools.Routes(apiGroup)
	feedback.Routes(apiGroup)

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "../palabatu-fe/dist"
	}
	r.NoRoute(newSPAHandler(staticDir))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	srv := &http.Server{
		Addr:    "0.0.0.0:" + port,
		Handler: stripTrailingSlash(r),
	}

	go func() {
		log.Printf("Server running on port %s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("forced shutdown: %v", err)
	}

	db.Pool.Close()
	log.Println("server exited")
}
