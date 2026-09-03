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

	"palabatu-be/internal/approaches"
	"palabatu-be/internal/auth"
	"palabatu-be/internal/boulders"
	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/crags"
	"palabatu-be/internal/db"
	"palabatu-be/internal/devtools"
	"palabatu-be/internal/feedback"
	"palabatu-be/internal/hype"
	"palabatu-be/internal/metrics"
	"palabatu-be/internal/middleware"
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

	// Default to gin's release mode (quieter logging, no debug-mode
	// warnings) unless the environment already asks for something else --
	// e.g. GIN_MODE=debug during local dev. gin itself falls back to debug
	// mode when GIN_MODE is unset, which is the wrong default for what
	// ends up running in production.
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Behind a reverse proxy the app never sees a real client IP on the
	// connection itself, so it has to read one out of X-Forwarded-For --
	// but gin's default is to trust *every* proxy (0.0.0.0/0), which means
	// it equally trusts an X-Forwarded-For a client set itself.
	// middleware.RateLimit keys its per-IP token buckets on c.ClientIP(),
	// so that default is a rate-limit bypass: rotate the header, get a
	// fresh bucket every request. Trust only the network the proxy
	// actually reaches us over (the Docker bridge subnet in production --
	// see deploy/compose.yml). Left unset for local dev and direct
	// `go run`, where there is no proxy and gin's default is harmless.
	if proxies := os.Getenv("TRUSTED_PROXIES"); proxies != "" {
		if err := r.SetTrustedProxies(strings.Split(proxies, ",")); err != nil {
			log.Fatalf("invalid TRUSTED_PROXIES: %v", err)
		}
	}

	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(metrics.Middleware)

	// Caps every request body -- see middleware.BodyLimit's doc comment
	// for why this is one content-type-aware limiter rather than a flat
	// number. 2MB covers the largest real JSON payload in this app (a
	// topo annotation's shape list) many times over; 10MB mirrors
	// problems.maxUploadMemory, the existing multipart buffering ceiling,
	// so the two stay in sync if that ever changes. Mounted at the root
	// so it covers /auth as well as /api, ahead of both route groups.
	r.Use(middleware.BodyLimit(2<<20, 10<<20))

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
	r.GET("/healthz", func(c *gin.Context) { c.Status(http.StatusOK) })

	apiGroup := r.Group("/api")

	// Deliberately a second group at the same "/api" prefix rather than a
	// sub-group of apiGroup (gin resolves routes by path, not by which
	// *gin.RouterGroup registered them, so two groups sharing a prefix
	// coexist fine) -- this one is never wrapped in the blanket limiter
	// below. It exists solely for hype's POST /hype/click: every other
	// domain wants the blanket backstop, but that route is the one in the
	// app designed to be mashed by a real person as fast as they
	// physically can, and stacking it under a burst-20 gate sized for "a
	// page load fires a handful of GETs" meant genuine enthusiastic
	// tapping silently stopped counting well before a real fan would
	// expect (see hype.Routes' own doc comment for the numbers, and git
	// history around 2026-09-03 for the two rounds of retuning that got
	// here). It still gets every engine-level middleware everyone else
	// gets (logging, recovery, metrics, body-size cap) -- it isn't
	// unthrottled, just not throttled by a limit sized for a different
	// kind of route. hype's own GET /hype stays on the ordinary apiGroup
	// below, since a plain read has no reason to skip the backstop.
	hypeClickGroup := r.Group("/api")

	// Blanket backstop for every /api route, on top of the tighter
	// per-endpoint limits individual domains already apply to their own
	// write-heavy routes (auth, waitlist, feedback, comments, reports).
	// Most GET listings (crags/boulders/problems/map data) have no
	// endpoint-specific limit at all, so without this they're completely
	// unthrottled. 10 req/s sustained with a burst of 20 is generous
	// enough that a normal page load (which can fire several API calls
	// at once) never notices it, while still capping a scripted flood.
	// Same in-memory-per-IP caveat as middleware.RateLimit's doc comment:
	// fine at single-instance scale, needs a shared store once there's
	// more than one backend replica.
	apiGroup.Use(middleware.RateLimit(100*time.Millisecond, 20))

	auth.AuthRoutes(r.Group("/auth"))
	auth.ProfileRoutes(apiGroup)
	crags.Routes(apiGroup)
	boulders.Routes(apiGroup)
	problems.Routes(apiGroup)
	approaches.Routes(apiGroup)
	social.Routes(apiGroup)
	report.Routes(apiGroup)
	notification.Routes(apiGroup)
	waitlist.Routes(apiGroup)
	devtools.Routes(apiGroup)
	feedback.Routes(apiGroup)
	hype.Routes(apiGroup, hypeClickGroup)

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
		// Unset, net/http lets a client hold a connection open
		// indefinitely (the classic Slowloris shape: open the connection,
		// trickle bytes just fast enough to not get dropped, tie up a
		// handler goroutine forever). ReadHeaderTimeout alone closes that
		// gap cheaply since headers are always small and fast to send.
		// ReadTimeout/WriteTimeout are looser -- generous enough that an
		// 8MB topo/avatar upload over a slow mobile connection still
		// completes (this app is used as a PWA on phones, often on
		// Indonesian mobile networks) while still bounding a connection
		// that never finishes at all. IdleTimeout caps how long a
		// keep-alive connection sits idle between requests.
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
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
