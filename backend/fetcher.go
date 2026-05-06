package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const fredBaseURL = "https://api.stlouisfed.org/fred/series/observations"

type fredResponse struct {
	Observations []fredObservation `json:"observations"`
}

type fredObservation struct {
	Date  string `json:"date"`
	Value string `json:"value"`
}

func fetchSeries(pool *pgxpool.Pool, seriesID string, apiKey string) error {
	url := fmt.Sprintf(
		"%s?series_id=%s&api_key=%s&file_type=json",
		fredBaseURL, seriesID, apiKey,
	)

	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	var fred fredResponse
	if err := json.NewDecoder(resp.Body).Decode(&fred); err != nil {
		return fmt.Errorf("json decode: %w", err)
	}

	for _, obs := range fred.Observations {
		if obs.Value == "." {
			continue
		}

		value, err := strconv.ParseFloat(obs.Value, 64)
		if err != nil {
			log.Printf("fetcher: skipping unparseable value %q for %s on %s", obs.Value, seriesID, obs.Date)
			continue
		}

		_, err = pool.Exec(context.Background(), `
			INSERT INTO series_observations (series_id, date, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (series_id, date) DO UPDATE SET value = EXCLUDED.value
		`, seriesID, obs.Date, value)
		if err != nil {
			return fmt.Errorf("upsert %s %s: %w", seriesID, obs.Date, err)
		}
	}

	_, err = pool.Exec(context.Background(), `
		INSERT INTO series_fetches (series_id, last_fetched_at)
		VALUES ($1, NOW())
		ON CONFLICT (series_id) DO UPDATE SET last_fetched_at = NOW()
	`, seriesID)
	if err != nil {
		return fmt.Errorf("update series_fetches: %w", err)
	}

	log.Printf("fetcher: %s updated, %d observations", seriesID, len(fred.Observations))
	return nil
}

func needsFetch(pool *pgxpool.Pool, seriesID string) bool {
	var lastFetched time.Time
	err := pool.QueryRow(context.Background(), `
		SELECT last_fetched_at FROM series_fetches WHERE series_id = $1
	`, seriesID).Scan(&lastFetched)

	if err != nil {
		return true
	}

	return time.Since(lastFetched) > 24*time.Hour
}
