package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/db"
	"palabatu-be/internal/handler"
)

func main() {
	_ = godotenv.Load()

	db.Connect()
	cloudinary.Connect()

	r := chi.NewRouter()

	// Express's default (non-strict) routing treats "/foo" and "/foo/" as
	// the same route; chi doesn't unless told to. palabatu-fe calls some
	// endpoints with a trailing slash (e.g. POST /api/upload/avatar/), so
	// strip it here to match Node's behavior everywhere rather than special
	// casing individual routes.
	r.Use(middleware.StripSlashes)
	r.Use(middleware.Logger)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:5173",
			"http://localhost:4173",
			"http://192.168.0.100:5173",
			"http://192.168.0.101:5173",
		},
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.Mount("/auth", handler.AuthRouter())
	r.Mount("/api", handler.APIRouter())

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Server running on port %s", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, r))
}
