// Package metrics exposes Prometheus HTTP request metrics for the API.
package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	requestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests processed, labeled by method, route, and status code.",
		},
		[]string{"method", "route", "status"},
	)

	requestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds, labeled by method and route.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "route"},
	)
)

// Middleware records request count and duration for every request. It uses
// the matched route pattern (c.FullPath(), e.g. "/problems/:id") rather than
// the raw request path as a label, so path params don't blow up cardinality.
func Middleware(c *gin.Context) {
	start := time.Now()
	c.Next()

	route := c.FullPath()
	if route == "" {
		route = "unmatched"
	}

	requestsTotal.WithLabelValues(c.Request.Method, route, strconv.Itoa(c.Writer.Status())).Inc()
	requestDuration.WithLabelValues(c.Request.Method, route).Observe(time.Since(start).Seconds())
}
