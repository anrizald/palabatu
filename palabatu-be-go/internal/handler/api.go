package handler

import (
	"github.com/go-chi/chi/v5"

	"palabatu-be/internal/middleware"
)

// APIRouter mounts at /api, mirroring palabatu-be/routes/api.ts. Handlers
// live in problem.go, profile.go, and interaction.go, delegating business
// logic to internal/service and data access to internal/repository.
//
// Not yet ported: POST /upload/topo and POST /upload/avatar, which need the
// Cloudinary Go SDK.
func APIRouter() chi.Router {
	r := chi.NewRouter()

	r.Get("/problems", handleListProblems)
	r.With(middleware.RequireAuth).Post("/problems", handleCreateProblem)
	r.With(middleware.RequireAuth).Put("/problems/{id}", handleUpdateProblem)
	r.With(middleware.RequireAuth).Delete("/problems/{id}", handleDeleteProblem)

	r.Get("/profiles/{id}", handleGetProfile)
	r.With(middleware.RequireAuth).Put("/profiles/{id}", handleUpsertProfile)

	r.With(middleware.RequireAuth).Get("/problems/{id}/send-status", handleSendStatus)
	r.With(middleware.RequireAuth).Post("/problems/{id}/send", handleToggleSend)

	r.Get("/problems/{id}/comments", handleListComments)
	r.With(middleware.RequireAuth).Post("/problems/{id}/comments", handleCreateComment)

	return r
}

// currentUserID reads the "id" claim attached by middleware.RequireAuth,
// mirroring (req as any).user.id in the Node routes.
func currentUserID(claims map[string]interface{}) string {
	id, _ := claims["id"].(string)
	return id
}
