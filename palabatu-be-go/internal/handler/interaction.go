package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"palabatu-be/internal/httpx"
	"palabatu-be/internal/middleware"
	"palabatu-be/internal/service"
)

func handleSendStatus(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(middleware.UserFromContext(r))
	id := chi.URLParam(r, "id")

	hasSent, err := service.HasSent(r.Context(), id, userID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]bool{"hasSent": hasSent})
}

func handleToggleSend(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(middleware.UserFromContext(r))
	id := chi.URLParam(r, "id")

	action, err := service.ToggleSend(r.Context(), id, userID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"action": action})
}

func handleListComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	comments, err := service.ListComments(r.Context(), id)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, comments)
}

func handleCreateComment(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(middleware.UserFromContext(r))
	id := chi.URLParam(r, "id")

	var body struct {
		Content string `json:"content"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	comment, err := service.CreateComment(r.Context(), id, userID, body.Content)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, comment)
	case errors.Is(err, service.ErrEmptyComment):
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Comment cannot be empty"})
	default:
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Server error"})
	}
}
