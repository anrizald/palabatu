package problems

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/cloudinary"
)

// maxUploadMemory bounds how much of a multipart upload mime/multipart
// buffers in memory before spilling to a temp file; it isn't a hard size
// limit (multer's memoryStorage has none either, so neither does this).
const maxUploadMemory = 10 << 20 // 10MB

// maxUploadSize is the hard cap on an individual uploaded file, enforced
// below since ParseMultipartForm's maxMemory only bounds in-memory
// buffering, not the file itself.
const maxUploadSize = 8 << 20 // 8MB

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

	file, header, err := c.Request.FormFile(field)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is too large (max 8MB)"})
		return
	}

	sniff := make([]byte, 512)
	n, err := file.Read(sniff)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid upload"})
		return
	}
	if !strings.HasPrefix(http.DetectContentType(sniff[:n]), "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only image files are allowed"})
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	url, err := cloudinary.UploadStream(c.Request.Context(), file, folder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudinary upload failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{responseKey: url})
}
