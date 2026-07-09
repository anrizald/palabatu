package handler

import (
	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// APIRoutes registers routes under /api, mirroring palabatu-be/routes/api.ts.
// Handlers live in problem.go, profile.go, interaction.go, and upload.go,
// delegating business logic to internal/service and data access to
// internal/repository.
func APIRoutes(rg *gin.RouterGroup) {
	rg.GET("/problems", handleListProblems)
	rg.POST("/problems", middleware.RequireAuth, handleCreateProblem)
	rg.PUT("/problems/:id", middleware.RequireAuth, handleUpdateProblem)
	rg.DELETE("/problems/:id", middleware.RequireAuth, handleDeleteProblem)

	rg.GET("/profiles/:id", handleGetProfile)
	rg.PUT("/profiles/:id", middleware.RequireAuth, handleUpsertProfile)

	rg.GET("/problems/:id/send-status", middleware.RequireAuth, handleSendStatus)
	rg.POST("/problems/:id/send", middleware.RequireAuth, handleToggleSend)

	rg.GET("/problems/:id/comments", handleListComments)
	rg.POST("/problems/:id/comments", middleware.RequireAuth, handleCreateComment)

	rg.POST("/upload/topo", middleware.RequireAuth, handleUploadTopo)
	rg.POST("/upload/avatar", middleware.RequireAuth, handleUploadAvatar)
}

// currentUserID reads the "id" claim attached by middleware.RequireAuth,
// mirroring (req as any).user.id in the Node routes.
func currentUserID(claims map[string]interface{}) string {
	id, _ := claims["id"].(string)
	return id
}
