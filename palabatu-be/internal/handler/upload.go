package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/cloudinary"
)

// maxUploadMemory bounds how much of a multipart upload mime/multipart
// buffers in memory before spilling to a temp file; it isn't a hard size
// limit (multer's memoryStorage has none either, so neither does this).
const maxUploadMemory = 10 << 20 // 10MB

func handleUploadTopo(c *gin.Context) {
	handleUpload(c, "image", "kepalabatu_topos", "url")
}

func handleUploadAvatar(c *gin.Context) {
	handleUpload(c, "avatar", "kepalabatu_avatars", "avatar_url")
}

func handleUpload(c *gin.Context, field, folder, responseKey string) {
	if err := c.Request.ParseMultipartForm(maxUploadMemory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid upload"})
		return
	}

	file, _, err := c.Request.FormFile(field)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	url, err := cloudinary.UploadStream(c.Request.Context(), file, folder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudinary upload failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{responseKey: url})
}
