package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimit returns gin middleware that allows one request every `every`
// per client IP, with bursts up to `burst`, using an in-memory token
// bucket per IP. This is enough at the app's current single-instance
// scale; a multi-instance deployment would need a shared store (e.g.
// Redis) instead since each instance would otherwise track its own
// independent counters.
func RateLimit(every time.Duration, burst int) gin.HandlerFunc {
	type entry struct {
		limiter  *rate.Limiter
		lastSeen time.Time
	}

	var mu sync.Mutex
	limiters := make(map[string]*entry)

	go func() {
		for range time.Tick(10 * time.Minute) {
			mu.Lock()
			for ip, e := range limiters {
				if time.Since(e.lastSeen) > 10*time.Minute {
					delete(limiters, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		e, ok := limiters[ip]
		if !ok {
			e = &entry{limiter: rate.NewLimiter(rate.Every(every), burst)}
			limiters[ip] = e
		}
		e.lastSeen = time.Now()
		limiter := e.limiter
		mu.Unlock()

		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests, please try again later"})
			return
		}
		c.Next()
	}
}
