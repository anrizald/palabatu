package main

import (
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/boulders"
	"palabatu-be/internal/problems"
)

// crawlerUserAgents lists case-insensitive substrings identifying known
// social-media link-preview bots. These don't execute JS, so the SPA's
// client-rendered <head> updates never reach them — this list decides which
// requests get a server-rendered preview instead of the plain SPA shell.
var crawlerUserAgents = []string{
	"facebookexternalhit",
	"twitterbot",
	"whatsapp",
	"slackbot",
	"telegrambot",
	"linkedinbot",
	"discordbot",
}

func isCrawlerUA(ua string) bool {
	ua = strings.ToLower(ua)
	for _, sub := range crawlerUserAgents {
		if strings.Contains(ua, sub) {
			return true
		}
	}
	return false
}

const problemsPathPrefix = "/problems/"

// problemIDFromPath extracts the :id segment from a "/problems/:id" request
// path, rejecting anything with extra segments (e.g. "/problems/1/foo").
func problemIDFromPath(path string) (string, bool) {
	if !strings.HasPrefix(path, problemsPathPrefix) {
		return "", false
	}
	id := strings.TrimPrefix(path, problemsPathPrefix)
	if id == "" || strings.Contains(id, "/") {
		return "", false
	}
	return id, true
}

type sharePreview struct {
	Title       string
	Description string
	Image       string
	URL         string
}

// shareTemplate is html/template (not text/template or Sprintf) because
// problem Name/LocationName are user-submitted content being rendered into
// HTML here for the first time anywhere in this codebase — auto-escaping is
// what keeps that from being an HTML-injection path.
var shareTemplate = template.Must(template.New("share").Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{.Title}}</title>
<meta name="description" content="{{.Description}}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="{{.Title}}" />
<meta property="og:description" content="{{.Description}}" />
<meta property="og:image" content="{{.Image}}" />
<meta property="og:url" content="{{.URL}}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{{.Title}}" />
<meta name="twitter:description" content="{{.Description}}" />
<meta name="twitter:image" content="{{.Image}}" />
</head>
<body></body>
</html>
`))

const (
	fallbackTitle       = "palabatu"
	fallbackDescription = "A community map and directory for Indonesian bouldering spots, routes, and climbers."
	fallbackImage       = "/person_only.png"
)

func requestBaseURL(c *gin.Context) string {
	scheme := c.GetHeader("X-Forwarded-Proto")
	if scheme == "" {
		if c.Request.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	return scheme + "://" + c.Request.Host
}

// buildSharePreview loads the problem behind a "/problems/:id" crawler
// request directly via problems.GetProblem (same process, no HTTP
// round-trip) and maps it onto OG/Twitter fields, falling back to the
// site's generic values if the problem 404s or has no photo. The preview
// image comes from the problem's boulder (photos live there now, not on
// the problem itself -- see handoff.md's photo-ownership move); this is
// the one place cmd/api imports both problems and boulders directly, which
// is fine since main is the top of the dependency graph, not a domain
// package either of them could import back.
func buildSharePreview(c *gin.Context, id string) sharePreview {
	baseURL := requestBaseURL(c)
	preview := sharePreview{
		Title:       fallbackTitle,
		Description: fallbackDescription,
		Image:       baseURL + fallbackImage,
		URL:         baseURL + problemsPathPrefix + id,
	}

	problem, err := problems.GetProblem(c.Request.Context(), id)
	if err != nil || problem == nil {
		return preview
	}

	preview.Title = problem.Name + " - palabatu"

	grade := ""
	if problem.Grade != nil {
		grade = *problem.Grade
	}
	location := ""
	if problem.CragName != nil {
		location = *problem.CragName
	}
	switch {
	case grade != "" && location != "":
		preview.Description = grade + " boulder problem at " + location + " - palabatu"
	case location != "":
		preview.Description = "Boulder problem at " + location + " - palabatu"
	}

	if boulder, err := boulders.GetBoulder(c.Request.Context(), problem.BoulderID); err == nil && len(boulder.ImageURLs) > 0 && boulder.ImageURLs[0] != "" {
		preview.Image = boulder.ImageURLs[0]
	}

	return preview
}

// newSPAHandler serves the built frontend out of staticDir as a gin
// r.NoRoute fallback. Known crawler user agents hitting "/problems/:id" get
// a server-rendered OG/Twitter preview for that specific problem; every
// other request is served whatever static file matches the path (JS/CSS/
// icons/etc.) verbatim, or falls back to dist/index.html unchanged so
// client-side routing still works — this is purely additive over the plain
// SPA shell.
func newSPAHandler(staticDir string) gin.HandlerFunc {
	indexPath := filepath.Join(staticDir, "index.html")

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Unmatched /api or /auth calls should 404 as JSON, not silently
		// receive the SPA shell.
		if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/auth/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}

		if id, ok := problemIDFromPath(path); ok && isCrawlerUA(c.Request.UserAgent()) {
			preview := buildSharePreview(c, id)
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.Status(http.StatusOK)
			_ = shareTemplate.Execute(c.Writer, preview)
			return
		}

		filePath := filepath.Join(staticDir, filepath.Clean(path))
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			c.File(filePath)
			return
		}

		c.File(indexPath)
	}
}
