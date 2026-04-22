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
	admin.Get("/root-problems", api.handleListRootProblems)
	admin.Post("/root-problems", api.handleCreateRootProblem)
	admin.Get("/root-problems/:id", api.handleGetRootProblem)
	admin.Put("/root-problems/:id", api.handleUpdateRootProblem)
	admin.Delete("/root-problems/:id", api.handleDeleteRootProblem)
	admin.Get("/spaces", api.handleAdminListSpaces)
	admin.Post("/spaces", api.handleAdminCreateSpace)
	admin.Post("/users/batch-register", api.handleBatchRegisterUsers)
	admin.Post("/users/:userId/reset-password", api.handleAdminResetUserPassword)

	protected.Get("/spaces", api.handleListSpaces)
	protected.Get("/spaces/:spaceId", api.handleGetSpace)

	spaceRead := protected.Group("/spaces/:spaceId")
	spaceRead.Get("/problem-bank-links", api.handleListSpaceProblemLinks)
	spaceRead.Get("/problems/:problemId", api.handleGetSpaceProblem)

	spaceRead.Get("/training-plans", api.handleListTrainingPlans)
	protected.Post("/spaces/:spaceId/training-plans", auth.RequireSpaceAdmin(db), api.handleCreateTrainingPlan)
	spaceRead.Get("/training-plans/:planId", api.handleGetTrainingPlan)
	protected.Put("/spaces/:spaceId/training-plans/:planId", auth.RequireSpaceAdmin(db), api.handleUpdateTrainingPlan)
	protected.Delete("/spaces/:spaceId/training-plans/:planId", auth.RequireSpaceAdmin(db), api.handleDeleteTrainingPlan)
	protected.Post("/spaces/:spaceId/training-plans/:planId/participants", auth.RequireSpaceAdmin(db), api.handleAddPlanParticipant)
	spaceRead.Post("/training-plans/:planId/join", api.handleJoinPlan)

	spaceRead.Get("/homeworks", api.handleListHomeworks)
	protected.Post("/spaces/:spaceId/homeworks", auth.RequireSpaceAdmin(db), api.handleCreateHomework)
	spaceRead.Get("/homeworks/:homeworkId", api.handleGetHomework)
	spaceRead.Get("/homeworks/:homeworkId/submission-records", api.handleListHomeworkSubmissionRecords)
	spaceRead.Post("/homeworks/:homeworkId/submission-records", api.handleCreateHomeworkSubmissionRecord)
	protected.Put("/spaces/:spaceId/homeworks/:homeworkId", auth.RequireSpaceAdmin(db), api.handleUpdateHomework)
	protected.Delete("/spaces/:spaceId/homeworks/:homeworkId", auth.RequireSpaceAdmin(db), api.handleDeleteHomework)
	protected.Post("/spaces/:spaceId/homeworks/:homeworkId/targets", auth.RequireSpaceAdmin(db), api.handleAddHomeworkTarget)

	spaceRead.Post("/problems/:problemId/objective-submit", api.handleObjectiveSubmit)
	spaceRead.Post("/problems/:problemId/run", api.handleRun)
	spaceRead.Post("/problems/:problemId/test", api.handleTest)
	spaceRead.Post("/problems/:problemId/submit", api.handleSubmit)

	// Submission list and detail
	spaceRead.Get("/problems/:problemId/submissions", api.handleListSubmissions)
	protected.Get("/submissions/:submissionId", api.handleGetSubmission)
	protected.Get("/submissions/:submissionId/stream", api.handleSubmissionStream)

	protected.Put("/spaces/:spaceId", auth.RequireSpaceAdmin(db), api.handleUpdateSpace)
	protected.Post("/spaces/:spaceId/members", auth.RequireSpaceAdmin(db), api.handleAddSpaceMember)
	protected.Put("/spaces/:spaceId/members/:userId", auth.RequireSpaceAdmin(db), api.handleUpdateSpaceMember)
	protected.Post("/spaces/:spaceId/members/:userId/reset-password", auth.RequireSpaceAdmin(db), api.handleSpaceMemberResetPassword)
	protected.Post("/spaces/:spaceId/problems", auth.RequireSpaceAdmin(db), api.handleCreateSpaceProblem)
	protected.Put("/spaces/:spaceId/problems/:problemId", auth.RequireSpaceAdmin(db), api.handleUpdateSpaceProblem)
	protected.Post("/spaces/:spaceId/problem-bank-links", auth.RequireSpaceAdmin(db), api.handleAddSpaceProblemLink)
	protected.Delete("/spaces/:spaceId/problem-bank-links/:problemId", auth.RequireSpaceAdmin(db), api.handleDeleteSpaceProblemLink)
	protected.Get("/spaces/:spaceId/root-problems", auth.RequireSpaceAdmin(db), api.handleListSpaceRootProblems)

	// Image tag management routes
	protected.Get("/image-tags", api.ListImageTags)
	protected.Post("/image-tags", api.CreateImageTag)
	protected.Delete("/image-tags/:id", api.DeleteImageTag)
	protected.Post("/image-tags/link", api.LinkImageTag)
	protected.Delete("/image-tags/unlink", api.UnlinkImageTag)
	protected.Get("/image-tags/image/:imageUrl", api.GetImageTags)
	protected.Get("/image-tags/tag/:id/images", api.GetImagesByTag)

	app.Static("/", "./web")
	app.Get("*", func(c *fiber.Ctx) error {
		return c.SendFile("./web/index.html")
	})

	return app
}
