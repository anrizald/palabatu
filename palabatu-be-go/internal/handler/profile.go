package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"palabatu-be/internal/httpx"
	"palabatu-be/internal/service"
)

func handleGetProfile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	profile, err := service.GetProfile(r.Context(), id)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, profile)
}

func handleUpsertProfile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Username  string          `json:"username"`
		Title     json.RawMessage `json:"title"`
		Tags      json.RawMessage `json:"tags"`
		AvatarURL string          `json:"avatar_url"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	profile, err := service.UpsertProfile(r.Context(), id, body.Username, body.Title, body.Tags, body.AvatarURL)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, profile)
}
