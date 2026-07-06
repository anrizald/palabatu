package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"palabatu-be/internal/httpx"
	"palabatu-be/internal/middleware"
	"palabatu-be/internal/service"
)

func handleListProblems(w http.ResponseWriter, r *http.Request) {
	problems, err := service.ListProblems(r.Context())
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, problems)
}

func handleCreateProblem(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(middleware.UserFromContext(r))

	var body struct {
		Name      string   `json:"name"`
		Grade     string   `json:"grade"`
		Location  string   `json:"location"`
		Lat       float64  `json:"lat"`
		Lng       float64  `json:"lng"`
		ImageURLs []string `json:"image_urls"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	problem, err := service.CreateProblem(r.Context(), userID, body.Name, body.Grade, body.Location, body.Lat, body.Lng, body.ImageURLs)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, problem)
}

func handleUpdateProblem(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(middleware.UserFromContext(r))
	id := chi.URLParam(r, "id")

	var body struct {
		Name  string `json:"name"`
		Grade string `json:"grade"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	problem, err := service.UpdateProblem(r.Context(), userID, id, body.Name, body.Grade)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, problem)
	case errors.Is(err, service.ErrNotFound):
		httpx.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
	case errors.Is(err, service.ErrForbidden):
		httpx.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "Not authorized to edit this problem."})
	default:
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
	}
}

func handleDeleteProblem(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(middleware.UserFromContext(r))
	id := chi.URLParam(r, "id")

	err := service.DeleteProblem(r.Context(), userID, id)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
	case errors.Is(err, service.ErrNotFound):
		httpx.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "Not found"})
	case errors.Is(err, service.ErrForbidden):
		httpx.WriteJSON(w, http.StatusForbidden, map[string]string{"error": "Not authorized to delete this problem."})
	default:
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
	}
}
