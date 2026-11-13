package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/Prince-695/strim/backend/internal/platform/logger"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/pkg/startup"
)

var (
	Version = "1.0.0"
	Commit  = "dev"
)

func main() {
	startTime := time.Now()

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "CRITICAL: Worker configuration failure: %v\n", err)
		os.Exit(1)
	}

	appLogger := logger.New(cfg.LogLevel, os.Stdout)
	clk := clock.NewRealClock()

	// Initialize Database Connection
	db, err := database.New(cfg, appLogger)
	if err != nil {
		appLogger.Error("Worker failed to connect to database", slog.Any("error", err))
		os.Exit(1)
	}
	defer func() {
		_ = db.Close()
	}()

	startup.PrintWorkerBanner(startup.Config{
		ServiceName:     "STRIM LABS",
		Version:         Version,
		Commit:          Commit,
		Environment:     cfg.AppEnv,
		Status:          "ACTIVE",
		StatusDetails:   "Database connected",
		StartupDuration: time.Since(startTime),
	})

	// Context for background jobs cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Shutdown trap
	shutdownSignals := make(chan os.Signal, 1)
	signal.Notify(shutdownSignals, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	// Initialize Repositories & Load Engine Worker Daemon
	jobRepo := repository.NewJobRepository(db)
	loadTestRepo := repository.NewLoadTestRepository(db)
	projectRepo := repository.NewProjectRepository(db)
	capacityRepo := repository.NewCapacityRepository(db)
	engine := loadengine.NewEngine()
	loadWorker := loadengine.NewWorker(
		"",
		jobRepo,
		loadTestRepo,
		projectRepo,
		capacityRepo,
		engine,
		nil,
		cfg.JWTSecret,
		appLogger,
	)
	go loadWorker.Start(ctx)

	// Worker heartbeat loop
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case t := <-ticker.C:
				appLogger.Debug("Worker heartbeat pulse",
					slog.Time("now", clk.Now()),
					slog.Time("ticker", t),
				)
			}
		}
	}()

	<-shutdownSignals
	cancel()
}
