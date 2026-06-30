package api

import (
	"database/sql"
	"errors"
	"log"
	"strings"

	"orangeoj/backend/internal/auth"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func NewApp(db *sql.DB, jwtSecret string, cookieSecure bool, corsOrigins string) *fiber.App {
	api := &API{DB: db, JWTSecret: jwtSecret, CookieSecure: cookieSecure}
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			var e *fiber.Error
			if errors.As(err, &e) {
				return c.Status(e.Code).JSON(fiber.Map{"error": e.Message})
			}
			log.Printf("[ERROR] unhandled request error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal server error"})
		},
	})

	app.Use(logger.New())
	app.Use(recover.New())
	allowOrigins := strings.TrimSpace(corsOrigins)
	allowCredentials := true
	if allowOrigins == "" {
		allowOrigins = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
	}
	if allowOrigins == "*" {
		allowCredentials = false
	}

	app.Use(cors.New(cors.Config{
		AllowCredentials: allowCredentials,
		AllowOrigins:     allowOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
	}))

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	authGroup := app.Group("/api/auth")
	authGroup.Post("/login", api.handleLogin)
	authGroup.Post("/logout", api.handleLogout)
	authGroup.Post("/register", api.handleRegister)
	authGroup.Get("/registration-status", api.handleRegistrationStatus)
	app.Get("/api/auth/me", auth.AuthMiddleware(jwtSecret), api.handleMe)

	protected := app.Group("/api", auth.AuthMiddleware(jwtSecret))
	protected.Post("/auth/change-password", api.handleChangePassword)

	admin := protected.Group("/admin", auth.RequireSystemAdmin())
	admin.Get("/settings/registration", api.handleGetRegistration)
	admin.Put("/settings/registration", api.handleSetRegistration)
	admin.Post("/settings/cleanup-orphaned-images", api.handleCleanupOrphanedImages)
	admin.Get("/spaces", api.handleAdminListSpaces)
	admin.Post("/spaces", api.handleAdminCreateSpace)
	admin.Post("/users/batch-register", api.handleBatchRegisterUsers)
	admin.Post("/users/:userId/reset-password", api.handleAdminResetUserPassword)

	protected.Get("/spaces", api.handleListSpaces)
	protected.Get("/spaces/:spaceId", api.handleGetSpace)

	spaceRead := protected.Group("/spaces/:spaceId")
	spaceRead.Get("/problems", api.handleListSpaceProblemLinks)
	spaceRead.Get("/problems/export", api.handleExportProblems)
	spaceRead.Post("/problems/import", api.handleImportProblems)
	spaceRead.Get("/problem-directories", api.handleListProblemDirectories)
	protected.Post("/spaces/:spaceId/problem-directories", auth.RequireSpaceAdmin(db), api.handleCreateProblemDirectory)
	protected.Put("/spaces/:spaceId/problem-directories/:dirId", auth.RequireSpaceAdmin(db), api.handleUpdateProblemDirectory)
	protected.Delete("/spaces/:spaceId/problem-directories/:dirId", auth.RequireSpaceAdmin(db), api.handleDeleteProblemDirectory)
	protected.Put("/spaces/:spaceId/problems/:problemId/directory", auth.RequireSpaceAdmin(db), api.handleUpdateProblemDirectoryID)
	spaceRead.Get("/problems/:problemId", api.handleGetSpaceProblem)
	spaceRead.Get("/problems/:problemId/draft", api.handleGetProblemDraft)
	spaceRead.Put("/problems/:problemId/draft", api.handleSaveProblemDraft)
	spaceRead.Delete("/problems/:problemId/draft", api.handleDeleteProblemDraft)

	spaceRead.Get("/training-plans", api.handleListTrainingPlans)
	protected.Post("/spaces/:spaceId/training-plans", auth.RequireSpaceAdmin(db), api.handleCreateTrainingPlan)
	spaceRead.Get("/training-plans/:planId", api.handleGetTrainingPlan)
		spaceRead.Get("/training-plans/:planId/progress", api.handleTrainingPlanProgress)
	protected.Put("/spaces/:spaceId/training-plans/:planId", auth.RequireSpaceAdmin(db), api.handleUpdateTrainingPlan)
	protected.Delete("/spaces/:spaceId/training-plans/:planId", auth.RequireSpaceAdmin(db), api.handleDeleteTrainingPlan)
	protected.Get("/spaces/:spaceId/training-plans/:planId/participant-candidates", auth.RequireSpaceAdmin(db), api.handleSearchTrainingCandidates)
	protected.Post("/spaces/:spaceId/training-plans/:planId/participants", auth.RequireSpaceAdmin(db), api.handleAddPlanParticipant)
	protected.Delete("/spaces/:spaceId/training-plans/:planId/participants/:userId", auth.RequireSpaceAdmin(db), api.handleDeletePlanParticipant)
	spaceRead.Get("/practices", api.handleListPractices)
	protected.Post("/spaces/:spaceId/practices", auth.RequireSpaceAdmin(db), api.handleCreatePractice)
	spaceRead.Get("/practices/:practiceId", api.handleGetPractice)
	spaceRead.Get("/practices/:practiceId/draft", api.handleGetPracticeDraft)
	spaceRead.Put("/practices/:practiceId/draft", api.handleSavePracticeDraft)
	spaceRead.Delete("/practices/:practiceId/draft", api.handleDeletePracticeDraft)
	spaceRead.Get("/practices/:practiceId/submission-records", api.handleListPracticeSubmissionRecords)
	spaceRead.Post("/practices/:practiceId/submission-records", api.handleCreatePracticeSubmissionRecord)
	protected.Put("/spaces/:spaceId/practices/:practiceId", auth.RequireSpaceAdmin(db), api.handleUpdatePractice)
	protected.Delete("/spaces/:spaceId/practices/:practiceId", auth.RequireSpaceAdmin(db), api.handleDeletePractice)
	protected.Get("/spaces/:spaceId/practices/:practiceId/target-candidates", auth.RequireSpaceAdmin(db), api.handleSearchPracticeTargetCandidates)
	protected.Post("/spaces/:spaceId/practices/:practiceId/targets", auth.RequireSpaceAdmin(db), api.handleAddPracticeTarget)
	protected.Delete("/spaces/:spaceId/practices/:practiceId/targets/:userId", auth.RequireSpaceAdmin(db), api.handleDeletePracticeTarget)

	spaceRead.Post("/problems/:problemId/objective-submit", api.handleObjectiveSubmit)
	spaceRead.Post("/problems/:problemId/run", api.handleRun)
	spaceRead.Post("/problems/:problemId/test", api.handleTest)
	spaceRead.Post("/problems/:problemId/submit", api.handleSubmit)
	spaceRead.Post("/problems/:problemId/turtle-run", api.handleTurtleRun)

	// Submission list and detail
	spaceRead.Get("/problems/:problemId/submissions", api.handleListSubmissions)
	protected.Get("/submissions/:submissionId", api.handleGetSubmission)
	protected.Get("/submissions/:submissionId/stream", api.handleSubmissionStream)

	protected.Put("/spaces/:spaceId", auth.RequireSpaceAdmin(db), api.handleUpdateSpace)
	protected.Get("/spaces/:spaceId/members", auth.RequireSpaceAdmin(db), api.handleListSpaceMembers)
	protected.Get("/spaces/:spaceId/member-candidates", auth.RequireSpaceAdmin(db), api.handleSearchSpaceMemberCandidates)
	protected.Post("/spaces/:spaceId/members", auth.RequireSpaceAdmin(db), api.handleAddSpaceMember)
	protected.Put("/spaces/:spaceId/members/:userId", auth.RequireSpaceAdmin(db), api.handleUpdateSpaceMember)
	protected.Delete("/spaces/:spaceId/members/:userId", auth.RequireSpaceAdmin(db), api.handleDeleteSpaceMember)
	protected.Post("/spaces/:spaceId/members/:userId/reset-password", auth.RequireSpaceAdmin(db), api.handleSpaceMemberResetPassword)
	protected.Post("/spaces/:spaceId/problems", auth.RequireSpaceAdmin(db), api.handleCreateSpaceProblem)
	protected.Put("/spaces/:spaceId/problems/:problemId", auth.RequireSpaceAdmin(db), api.handleUpdateSpaceProblem)
	protected.Delete("/spaces/:spaceId/problems/:problemId", auth.RequireSpaceAdmin(db), api.handleDeleteSpaceProblem)

	// Image upload
	protected.Post("/images/upload", api.handleUploadImage)

	// ZIP export/import (space admin only)
	protected.Get("/spaces/:spaceId/practices/:practiceId/export", api.handleExportPractice)
	protected.Get("/spaces/:spaceId/training-plans/:planId/export", api.handleExportTrainingPlan)
	protected.Post("/spaces/:spaceId/training-plans/import", auth.RequireSpaceAdmin(db), api.handleImportTrainingPlan)

	// Image tag management routes
	protected.Get("/image-tags", api.ListImageTags)
	protected.Post("/image-tags", api.CreateImageTag)
	protected.Delete("/image-tags/:id", api.DeleteImageTag)
	protected.Post("/image-tags/link", api.LinkImageTag)
	protected.Delete("/image-tags/unlink", api.UnlinkImageTag)
	protected.Get("/image-tags/image/:imageUrl", api.GetImageTags)
	protected.Get("/image-tags/tag/:id/images", api.GetImagesByTag)

	app.Static("/api/uploads", "./uploads")
	app.Static("/", "./web")
	app.Get("*", func(c *fiber.Ctx) error {
		return c.SendFile("./web/index.html")
	})

	return app
}
