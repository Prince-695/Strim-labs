package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
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

// SlogGormLogger adapts Go's log/slog into GORM's logger interface.
type SlogGormLogger struct {
	logger        *slog.Logger
	slowThreshold time.Duration
}

// NewSlogGormLogger creates a GORM logger adapter backed by slog.
func NewSlogGormLogger(l *slog.Logger, slowThreshold time.Duration) *SlogGormLogger {
	return &SlogGormLogger{
		logger:        l,
		slowThreshold: slowThreshold,
	}
}

func (s *SlogGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	return s
}

func (s *SlogGormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	s.logger.InfoContext(ctx, fmt.Sprintf(msg, data...))
}

func (s *SlogGormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	s.logger.WarnContext(ctx, fmt.Sprintf(msg, data...))
}

func (s *SlogGormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	s.logger.ErrorContext(ctx, fmt.Sprintf(msg, data...))
}

func (s *SlogGormLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	elapsed := time.Since(begin)
	sqlStr, rows := fc()

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		s.logger.ErrorContext(ctx, "database query error",
			slog.String("sql", sqlStr),
			slog.Int64("rows", rows),
			slog.Duration("duration", elapsed),
			slog.Any("error", err),
		)
		return
	}

	if s.slowThreshold > 0 && elapsed > s.slowThreshold {
		s.logger.WarnContext(ctx, "slow database query",
			slog.String("sql", sqlStr),
			slog.Int64("rows", rows),
			slog.Duration("duration", elapsed),
		)
		return
	}

	s.logger.DebugContext(ctx, "database query trace",
		slog.String("sql", sqlStr),
		slog.Int64("rows", rows),
		slog.Duration("duration", elapsed),
	)
}

// New connects to PostgreSQL using GORM, applies connection pooling, and sets up logging.
func New(cfg *config.Config, l *slog.Logger) (*DB, error) {
	gormLog := NewSlogGormLogger(l, 200*time.Millisecond)

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

	// Verify connectivity with a bounded 3-second timeout so slow/unreachable DB never stalls startup
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer pingCancel()
	if pingErr := sqlDB.PingContext(pingCtx); pingErr != nil {
		return nil, fmt.Errorf("database connectivity check failed: %w", pingErr)
	}

	return &DB{
		DB:    db,
		sqlDB: sqlDB,
	}, nil
}

// Ping verifies the database connection is alive within the given context.
func (db *DB) Ping(ctx context.Context) error {
	if db.sqlDB == nil {
		return errors.New("database connection is not initialized")
	}
	return db.sqlDB.PingContext(ctx)
}

// Close closes the underlying SQL database connection pool cleanly.
func (db *DB) Close() error {
	if db.sqlDB != nil {
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
