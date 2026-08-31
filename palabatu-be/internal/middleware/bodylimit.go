package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// BodyLimit returns gin middleware that caps how large a request body may
// be, closing the gap where multipart uploads have an explicit per-file
// ceiling (problems/upload.go's maxUploadSize) but every other POST/PUT --
// plain JSON bodies -- has none at all. Without this, a client can send an
// arbitrarily large body and the app spends memory and time reading and
// parsing all of it before any handler-level validation ever runs.
//
// multipart/form-data requests (the two upload endpoints) get
// multipartLimit instead of jsonLimit, since those legitimately carry an
// image file; everything else in this app never sends anywhere near
// jsonLimit's worth of JSON, so that ceiling stays tight.
//
// http.MaxBytesReader makes the body's Read calls start failing once the
// limit is crossed. gin's ShouldBindJSON and mime/multipart's own
// ParseMultipartForm already treat a read error as a bind/parse failure,
// so every existing handler's "invalid request body" 400 branch already
// covers this -- no handler-side changes needed.
func BodyLimit(jsonLimit, multipartLimit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := jsonLimit
		if c.ContentType() == "multipart/form-data" {
			limit = multipartLimit
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}
