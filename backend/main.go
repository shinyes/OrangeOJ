package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orangeoj/backend/internal/api"
	"orangeoj/backend/internal/db"
	"orangeoj/backend/internal/judge"
	"orangeoj/backend/internal/util"
)

func main() {
	cfg := util.LoadConfig()

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db failed: %v", err)
	}
	defer database.Close()

	ctx := context.Background()
	setup, err := db.Setup(ctx, database, cfg.RegistrationDefault, cfg.AdminPasswordOverride)
	if err != nil {
		log.Fatalf("db setup failed: %v", err)
	}
	db.LogAdminPassword(setup.AdminPasswordGenerated)

	runner := judge.NewDockerRunner(judge.RunnerConfig{
		ImageCPP:    cfg.JudgeImageCPP,
		ImagePython: cfg.JudgeImagePython,
		ImageGo:     cfg.JudgeImageGo,
		CPU:         cfg.JudgeCPU,
	})
	queue := judge.NewQueueService(database, runner, cfg.JudgeWorkers)
	workerCtx, workerCancel := context.WithCancel(context.Background())
	queue.Start(workerCtx)

	app := api.NewApp(database, cfg.JWTSecret, cfg.CookieSecure, cfg.CORSOrigins)

	go func() {
		if err := app.Listen(":" + cfg.AppPort); err != nil {
			log.Printf("server stopped: %v", err)
		}
	}()

	log.Printf("OrangeOJ started on :%s", cfg.AppPort)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("shutting down...")
	workerCancel()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
