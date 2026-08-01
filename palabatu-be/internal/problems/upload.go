package problems

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/apitypes"
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

// handleUploadTopo godoc
// @Summary      Upload a topo photo
// @Description  Streams an image to Cloudinary's kepalabatu_topos folder, returns its URL.
// @Tags         problems
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        image  formData  file  true  "Image file, max 8MB"
// @Success      200    {object}  problems.TopoUploadResponse
// @Failure      400    {object}  apitypes.ErrorResponse  "no file, file too large, or not an image"
// @Failure      500    {object}  apitypes.ErrorResponse  "cloudinary upload failed"
// @Router       /api/upload/topo [post]
func handleUploadTopo(c *gin.Context) {
	handleUpload(c, "image", "kepalabatu_topos", func(url string) any { return TopoUploadResponse{Url: url} })
}

// handleUploadAvatar godoc
// @Summary      Upload a profile avatar
// @Description  Streams an image to Cloudinary's kepalabatu_avatars folder, returns its URL.
// @Tags         problems
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        avatar  formData  file  true  "Image file, max 8MB"
// @Success      200     {object}  problems.AvatarUploadResponse
// @Failure      400     {object}  apitypes.ErrorResponse  "no file, file too large, or not an image"
// @Failure      500     {object}  apitypes.ErrorResponse  "cloudinary upload failed"
// @Router       /api/upload/avatar [post]
func handleUploadAvatar(c *gin.Context) {
	handleUpload(c, "avatar", "kepalabatu_avatars", func(url string) any { return AvatarUploadResponse{AvatarUrl: url} })
}

// handleUpload is the shared multipart-parsing implementation behind
// handleUploadTopo/handleUploadAvatar. buildResponse lets each caller return
// its own typed response shape (rather than a dynamic gin.H key) so both
// routes stay documentable via swag.
func handleUpload(c *gin.Context, field, folder string, buildResponse func(url string) any) {
	if err := c.Request.ParseMultipartForm(maxUploadMemory); err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid upload"})
		return
	}

	file, header, err := c.Request.FormFile(field)
	if err != nil {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "No file uploaded"})
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "File is too large (max 8MB)"})
		return
	}

	sniff := make([]byte, 512)
	n, err := file.Read(sniff)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Invalid upload"})
		return
	}
	if !strings.HasPrefix(http.DetectContentType(sniff[:n]), "image/") {
		c.JSON(http.StatusBadRequest, apitypes.ErrorResponse{Error: "Only image files are allowed"})
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Server error"})
		return
	}

	url, err := cloudinary.UploadStream(c.Request.Context(), file, folder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, apitypes.ErrorResponse{Error: "Cloudinary upload failed"})
		return
	}

	c.JSON(http.StatusOK, buildResponse(url))
}
