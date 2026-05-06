package main

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func connectDB(databaseURL string) *pgxpool.Pool {
	var pool *pgxpool.Pool
	var err error

	for attempt := 1; attempt <= 10; attempt++ {
		pool, err = pgxpool.New(context.Background(), databaseURL)
		if err == nil {
			if pingErr := pool.Ping(context.Background()); pingErr == nil {
				log.Println("db: connected")
				return pool
			}
		}
		log.Printf("db: not ready, attempt %d/10, retrying in %ds", attempt, attempt)
		time.Sleep(time.Duration(attempt) * time.Second)
	}

	log.Fatal("db: could not connect: ", err)
	return nil
}

func runMigrations(pool *pgxpool.Pool) {
	_, err := pool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS series_observations (
			series_id   TEXT    NOT NULL,
			date        DATE    NOT NULL,
			value       NUMERIC,
			PRIMARY KEY (series_id, date)
		);

		CREATE TABLE IF NOT EXISTS series_fetches (
			series_id       TEXT        PRIMARY KEY,
			last_fetched_at TIMESTAMPTZ NOT NULL
		);
	`)
	if err != nil {
		log.Fatal("db: migrations failed: ", err)
	}
	log.Println("db: migrations complete")
}
