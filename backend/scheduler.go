package main

import (
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var seriesIDs = []string{"GDPC1"}

func startScheduler(pool *pgxpool.Pool, apiKey string) {
	go func() {
		runFetches(pool, apiKey)

		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			runFetches(pool, apiKey)
		}
	}()
}

func runFetches(pool *pgxpool.Pool, apiKey string) {
	for _, id := range seriesIDs {
		if !needsFetch(pool, id) {
			log.Printf("scheduler: %s is up to date, skipping", id)
			continue
		}
		if err := fetchSeries(pool, id, apiKey); err != nil {
			log.Printf("scheduler: failed to fetch %s: %v", id, err)
		}
	}
}
