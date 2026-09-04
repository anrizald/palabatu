package db

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

// Pool sizing, deliberately explicit rather than left at pgxpool's
// defaults (MaxConns = 4x runtime.NumCPU(), MinConns = 0, no idle/lifetime
// caps). Tying pool size to the deploy host's core count is an
// unpredictable knob at this app's current single-instance scale, and
// DATABASE_URL sometimes points at Neon (see CLAUDE.md's Database
// migrations section) rather than the local Docker instance -- a
// serverless Postgres whose lower tiers cap total connections, so an
// uncapped pool is a real way to lock yourself out of your own database.
// These are conservative starting numbers, not a permanent ceiling; raise
// them once real traffic says they're too tight.
const (
	maxPoolConns      = 10
	minPoolConns      = 2
	maxConnLifetime   = time.Hour
	maxConnIdleTime   = 15 * time.Minute
	healthCheckPeriod = time.Minute
)

func Connect() {
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("unable to parse database config: %v", err)
	}

	config.MaxConns = maxPoolConns
	config.MinConns = minPoolConns
	config.MaxConnLifetime = maxConnLifetime
	config.MaxConnIdleTime = maxConnIdleTime
	config.HealthCheckPeriod = healthCheckPeriod

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("unable to create connection pool: %v", err)
	}
	Pool = pool
}
