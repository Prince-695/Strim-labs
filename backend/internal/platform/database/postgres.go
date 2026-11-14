package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// DB wraps the GORM DB instance and its underlying connection pool.
type DB struct {
	*gorm.DB
	sqlDB *sql.DB
}

// Purple ANSI styling constants for database logs
const (
	ansiPurpleBold = "\033[38;2;168;85;247m"
	ansiPurpleDim  = "\033[38;2;192;132;252m"
	ansiReset      = "\033[0m"
	ansiRed        = "\033[31m"
	ansiYellow     = "\033[33m"
	ansiGray       = "\033[90m"
)

// SlogGormLogger adapts Go's log/slog into GORM's logger interface.
type SlogGormLogger struct {
	logger        *slog.Logger
	slowThreshold time.Duration
	dbRun         bool
}

// NewSlogGormLogger creates a GORM logger adapter backed by slog and optional purple console styling.
func NewSlogGormLogger(l *slog.Logger, slowThreshold time.Duration, dbRun bool) *SlogGormLogger {
	return &SlogGormLogger{
		logger:        l,
		slowThreshold: slowThreshold,
		dbRun:         dbRun,
	}
}

func (s *SlogGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	return s
}

func (s *SlogGormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if s.dbRun {
		fmt.Printf("%s[DATABASE]%s %s%s%s\n", ansiPurpleBold, ansiReset, ansiPurpleDim, fmt.Sprintf(msg, data...), ansiReset)
		return
	}
	s.logger.InfoContext(ctx, fmt.Sprintf(msg, data...))
}

func (s *SlogGormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if s.dbRun {
		fmt.Printf("%s[DATABASE WARN]%s %s%s%s\n", ansiYellow, ansiReset, ansiPurpleDim, fmt.Sprintf(msg, data...), ansiReset)
		return
	}
	s.logger.WarnContext(ctx, fmt.Sprintf(msg, data...))
}

func (s *SlogGormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if s.dbRun {
		fmt.Printf("%s[DATABASE ERROR]%s %s%s%s\n", ansiRed, ansiReset, ansiPurpleDim, fmt.Sprintf(msg, data...), ansiReset)
		return
	}
	s.logger.ErrorContext(ctx, fmt.Sprintf(msg, data...))
}

func (s *SlogGormLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	elapsed := time.Since(begin)
	sqlStr, rows := fc()

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		if s.dbRun {
			fmt.Printf("%s[DATABASE ERROR]%s %s%s (rows: %d, duration: %v) error: %v%s\n", ansiRed, ansiReset, ansiRed, sqlStr, rows, elapsed, err, ansiReset)
		} else {
			s.logger.ErrorContext(ctx, "database query error",
				slog.String("sql", sqlStr),
				slog.Int64("rows", rows),
				slog.Duration("duration", elapsed),
				slog.Any("error", err),
			)
		}
		return
	}

	if s.slowThreshold > 0 && elapsed > s.slowThreshold {
		if s.dbRun {
			fmt.Printf("%s[DATABASE SLOW]%s %s%s (rows: %d, duration: %v)%s\n", ansiYellow, ansiReset, ansiPurpleDim, sqlStr, rows, elapsed, ansiReset)
		} else {
			s.logger.WarnContext(ctx, "slow database query",
				slog.String("sql", sqlStr),
				slog.Int64("rows", rows),
				slog.Duration("duration", elapsed),
			)
		}
		return
	}

	if s.dbRun {
		fmt.Printf("%s[DATABASE SQL]%s %s%s%s %s(rows: %d, duration: %v)%s\n", ansiPurpleBold, ansiReset, ansiPurpleDim, sqlStr, ansiReset, ansiGray, rows, elapsed, ansiReset)
	} else {
		s.logger.DebugContext(ctx, "database query trace",
			slog.String("sql", sqlStr),
			slog.Int64("rows", rows),
			slog.Duration("duration", elapsed),
		)
	}
}

// New connects to PostgreSQL using GORM, applies connection pooling, and sets up logging.
func New(cfg *config.Config, l *slog.Logger) (*DB, error) {
	if strings.Contains(cfg.DatabaseURL, "localhost") && (cfg.AppEnv == "production" || os.Getenv("RENDER") != "") {
		l.Warn("DATABASE_URL points to localhost in a production/cloud environment. Configure DATABASE_URL in your deployment settings.",
			slog.String("database_url", cfg.DatabaseURL),
		)
	}

	gormLog := NewSlogGormLogger(l, 200*time.Millisecond, cfg.DBRun)

	gormConfig := &gorm.Config{
		Logger:                                   gormLog,
		PrepareStmt:                              true,
		SkipDefaultTransaction:                   true,
		DisableForeignKeyConstraintWhenMigrating: false,
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to open GORM database connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to obtain underlying *sql.DB: %w", err)
	}

	// Tune connection pool settings
	sqlDB.SetMaxOpenConns(cfg.DatabaseMaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DatabaseMaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.DatabaseConnMaxLife)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	// Verify connectivity with bounded retries so cold starts or DNS delays don't fail boot immediately
	var lastErr error
	maxAttempts := 5
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
		pingErr := sqlDB.PingContext(pingCtx)
		pingCancel()
		if pingErr == nil {
			lastErr = nil
			break
		}
		lastErr = pingErr
		if attempt < maxAttempts {
			time.Sleep(time.Duration(attempt) * 400 * time.Millisecond)
		}
	}

	if lastErr != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("database connectivity check failed after %d attempts: %w", maxAttempts, lastErr)
	}

	return &DB{
		DB:    db,
		sqlDB: sqlDB,
	}, nil
}

// Ping verifies the database connection is alive within the given context.
func (db *DB) Ping(ctx context.Context) error {
	if db == nil || db.sqlDB == nil {
		return errors.New("database connection is not initialized")
	}
	return db.sqlDB.PingContext(ctx)
}

// Close closes the underlying SQL database connection pool cleanly.
func (db *DB) Close() error {
	if db != nil && db.sqlDB != nil {
		return db.sqlDB.Close()
	}
	return nil
}

// ScopeWithOrg is a GORM scope helper that automatically enforces tenant isolation.
func ScopeWithOrg(orgID string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where("org_id = ?", orgID)
	}
}
