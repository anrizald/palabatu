package handler

import "github.com/go-chi/chi/v5"

// APIRouter mounts at /api. Handlers for problems/sends/comments/etc. go here,
// ported one by one from palabatu-be/routes/api.ts, delegating business
// logic to internal/service and data access to internal/repository.
func APIRouter() chi.Router {
	r := chi.NewRouter()
	return r
}
