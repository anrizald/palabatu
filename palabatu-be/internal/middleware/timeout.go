package middleware

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

// Timeout returns gin middleware that puts a deadline on every request's
// context, so a slow or hanging query can't hold a pool connection
// indefinitely. The pool's MaxConns (internal/db) caps how many queries run
// at once, but not how long any of them may take; without a deadline, a
// pile of stuck queries exhausts the pool and every later request waits on
// Acquire forever.
//
// Every handler already passes c.Request.Context() down through its service
// and repository calls, and pgx honors that context on both Acquire and the
// query itself, so this one wrapper bounds every database call in the app --
// no repository function needs its own timeout. An expired deadline surfaces
// as an ordinary query error, which every handler already maps to a 500.
//
// This is enforced by the driver rather than by a server-side
// statement_timeout, deliberately: production reaches Neon through its
// PgBouncer pooler, which can reject unknown startup parameters, and
// db.Connect treats a failed connect as fatal.
//
// multipart/form-data requests (the two upload endpoints) get
// multipartLimit instead of jsonLimit, mirroring BodyLimit: the clock starts
// before the handler reads the body, so a slow phone upload spends part of
// the budget before the Cloudinary call that follows ever starts.
//
// Work that must finish after a commit regardless of this deadline --
// best-effort Cloudinary destroys, purge's post-delete bookkeeping -- detaches
// with context.WithoutCancel and sets its own bound instead.
func Timeout(jsonLimit, multipartLimit time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := jsonLimit
		if c.ContentType() == "multipart/form-data" {
			limit = multipartLimit
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), limit)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
