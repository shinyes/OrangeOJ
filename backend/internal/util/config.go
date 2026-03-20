package util

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	AppPort               string
	DBPath                string
	JWTSecret             string
	JudgeWorkers          int
	RegistrationDefault   bool
	AdminPasswordOverride string
	JudgeImageCPP         string
	JudgeImagePython      string
	JudgeImageGo          string
	JudgeCPU              string
	CookieSecure          bool
	CORSOrigins           string
}

func LoadConfig() Config {
	cfg := Config{
		AppPort:               envOr("ORANGEOJ_PORT", "8080"),
		DBPath:                envOr("ORANGEOJ_DB_PATH", "./data/orangeoj.db"),
		JWTSecret:             envOr("ORANGEOJ_JWT_SECRET", "orangeoj-dev-secret-change-me"),
		JudgeWorkers:          envIntOr("ORANGEOJ_JUDGE_WORKERS", 2),
		RegistrationDefault:   envBoolOr("ORANGEOJ_REGISTRATION_DEFAULT", false),
		AdminPasswordOverride: os.Getenv("ORANGEOJ_ADMIN_PASSWORD"),
		JudgeImageCPP:         envOr("ORANGEOJ_IMAGE_CPP", "gcc:13.2"),
		JudgeImagePython:      envOr("ORANGEOJ_IMAGE_PYTHON", "python:3.8-alpine"),
		JudgeImageGo:          envOr("ORANGEOJ_IMAGE_GO", "golang:1.25-alpine"),
		JudgeCPU:              envOr("ORANGEOJ_JUDGE_CPU", "0.5"),
		CookieSecure:          envBoolOr("ORANGEOJ_COOKIE_SECURE", false),
		CORSOrigins:           envOr("ORANGEOJ_CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"),
	}
	if cfg.JudgeWorkers < 1 {
		cfg.JudgeWorkers = 1
	}
	if cfg.JWTSecret == "orangeoj-dev-secret-change-me" {
		log.Println("[WARN] ORANGEOJ_JWT_SECRET is using default value; change it in production")
	}
	return cfg
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envIntOr(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envBoolOr(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return parsed
}
