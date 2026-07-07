package handler

import (
	"net/http"

	"palabatu-be/internal/cloudinary"
	"palabatu-be/internal/httpx"
)

// maxUploadMemory bounds how much of a multipart upload mime/multipart
// buffers in memory before spilling to a temp file; it isn't a hard size
// limit (multer's memoryStorage has none either, so neither does this).
const maxUploadMemory = 10 << 20 // 10MB

func handleUploadTopo(w http.ResponseWriter, r *http.Request) {
	handleUpload(w, r, "image", "kepalabatu_topos", "url")
}

func handleUploadAvatar(w http.ResponseWriter, r *http.Request) {
	handleUpload(w, r, "avatar", "kepalabatu_avatars", "avatar_url")
}

func handleUpload(w http.ResponseWriter, r *http.Request, field, folder, responseKey string) {
	if err := r.ParseMultipartForm(maxUploadMemory); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid upload"})
		return
	}

	file, _, err := r.FormFile(field)
	if err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	url, err := cloudinary.UploadStream(r.Context(), file, folder)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "Cloudinary upload failed"})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{responseKey: url})
}
