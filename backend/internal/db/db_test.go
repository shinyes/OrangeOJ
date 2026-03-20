package db

import (
	"context"
	"testing"
)

func TestRegistrationSetting(t *testing.T) {
	db, err := Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if _, err := Setup(context.Background(), db, false, "admin123456"); err != nil {
		t.Fatalf("setup db: %v", err)
	}
	enabled, err := GetRegistrationEnabled(context.Background(), db)
	if err != nil {
		t.Fatalf("get registration: %v", err)
	}
	if enabled {
		t.Fatalf("expected registration disabled by default")
	}
	if err := SetRegistrationEnabled(context.Background(), db, true); err != nil {
		t.Fatalf("set registration: %v", err)
	}
	enabled, err = GetRegistrationEnabled(context.Background(), db)
	if err != nil {
		t.Fatalf("get registration 2: %v", err)
	}
	if !enabled {
		t.Fatalf("expected registration enabled")
	}
}
