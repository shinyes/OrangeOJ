package api

import (
	"database/sql"
	"errors"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"orangeoj/backend/internal/auth"
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

	admin := protected.Group("/admin", auth.RequireSystemAdmin())
	admin.Get("/settings/registration", api.handleGetRegistration)
	admin.Put("/settings/registration", api.handleSetRegistration)
	admin.Get("/root-problems", api.handleListRootProblems)
	admin.Post("/root-problems", api.handleCreateRootProblem)
	admin.Put("/root-problems/:id", api.handleUpdateRootProblem)
	admin.Delete("/root-problems/:id", api.handleDeleteRootProblem)
	admin.Get("/spaces", api.handleAdminListSpaces)
	admin.Post("/spaces", api.handleAdminCreateSpace)
	admin.Post("/users/batch-register", api.handleBatchRegisterUsers)

	protected.Get("/spaces", api.handleListSpaces)
	protected.Get("/spaces/:spaceId", api.handleGetSpace)

	spaceAdmin := protected.Group("/spaces/:spaceId", auth.RequireSpaceAdmin(db))
	spaceAdmin.Post("/members", api.handleAddSpaceMember)
	spaceAdmin.Put("/members/:userId", api.handleUpdateSpaceMember)
	spaceAdmin.Post("/problem-bank-links", api.handleAddSpaceProblemLink)
	spaceAdmin.Delete("/problem-bank-links/:problemId", api.handleDeleteSpaceProblemLink)

	spaceRead := protected.Group("/spaces/:spaceId")
	spaceRead.Get("/problem-bank-links", api.handleListSpaceProblemLinks)
	spaceRead.Get("/problems/:problemId", api.handleGetSpaceProblem)

	spaceRead.Get("/training-plans", api.handleListTrainingPlans)
	spaceAdmin.Post("/training-plans", api.handleCreateTrainingPlan)
	spaceRead.Get("/training-plans/:planId", api.handleGetTrainingPlan)
	spaceAdmin.Put("/training-plans/:planId", api.handleUpdateTrainingPlan)
	spaceAdmin.Post("/training-plans/:planId/participants", api.handleAddPlanParticipant)
	spaceRead.Post("/training-plans/:planId/join", api.handleJoinPlan)

	spaceRead.Get("/homeworks", api.handleListHomeworks)
	spaceAdmin.Post("/homeworks", api.handleCreateHomework)
	spaceRead.Get("/homeworks/:homeworkId", api.handleGetHomework)
	spaceAdmin.Put("/homeworks/:homeworkId", api.handleUpdateHomework)
	spaceAdmin.Post("/homeworks/:homeworkId/targets", api.handleAddHomeworkTarget)

	spaceRead.Post("/problems/:problemId/objective-submit", api.handleObjectiveSubmit)
	spaceRead.Post("/problems/:problemId/run", api.handleRun)
	spaceRead.Post("/problems/:problemId/test", api.handleTest)
	spaceRead.Post("/problems/:problemId/submit", api.handleSubmit)

	protected.Get("/submissions/:submissionId", api.handleGetSubmission)
	protected.Get("/submissions/:submissionId/stream", api.handleSubmissionStream)

	app.Static("/", "./web")
	app.Get("*", func(c *fiber.Ctx) error {
		return c.SendFile("./web/index.html")
	})

	return app
}
