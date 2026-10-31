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
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/Prince-695/strim/backend/internal/platform/logger"
)

var (
	Version = "1.0.0"
	Commit  = "dev"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "CRITICAL: Worker configuration failure: %v\n", err)
		os.Exit(1)
	}

	appLogger := logger.New(cfg.LogLevel, os.Stdout)
	appLogger.Info("Initializing STRIM Labs Background Worker",
		slog.String("version", Version),
		slog.String("commit", Commit),
		slog.String("env", cfg.AppEnv),
	)

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

	appLogger.Info("Worker successfully connected to database. Ready to process background jobs.")

	// Context for background jobs cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Shutdown trap
	shutdownSignals := make(chan os.Signal, 1)
	signal.Notify(shutdownSignals, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	// Worker heartbeat loop (placeholder for load engine, alert evaluator, roll-up jobs)
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

	sig := <-shutdownSignals
	appLogger.Info("Worker received shutdown signal, draining jobs...", slog.String("signal", sig.String()))
	cancel()
	time.Sleep(500 * time.Millisecond)
	appLogger.Info("Worker gracefully stopped")
}
