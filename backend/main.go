package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/acme/autocert"
)

const fredBaseURL = "https://api.stlouisfed.org/fred/series/observations"

type observation struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

// fredObservation will become observation
// after Value is converted from string to float64
type fredObservation struct {
	Date  string `json:"date"`
	Value string `json:"value"`
}

type fredResponse struct {
	FredObservations []fredObservation `json:"observations"`
}

var seriesIDs = []string{}

func main() {
	fredAPIKey := os.Getenv("FRED_API_KEY")
	if fredAPIKey == "" {
		log.Fatal("FRED_API_KEY environment variable is not set")
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	var pool *pgxpool.Pool
	for attempt := 1; attempt <= 10; attempt++ {
		p, err := pgxpool.New(context.Background(), databaseURL)
		if err == nil {
			if err := p.Ping(context.Background()); err == nil {
				pool = p
				log.Println("db: connected")
				break
			}
		}
		if attempt == 10 {
			log.Fatal("db: could not connect after 10 attempts")
		}
		log.Printf("db: not ready, attempt %d/10, retrying in %ds", attempt, attempt)
		time.Sleep(time.Duration(attempt) * time.Second)
	}
	defer pool.Close()

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

	go func() {
		// runFetches located below
		runFetches(pool, fredAPIKey)
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		// ticker.C is a goroutine channel
		// infinite loop fires each time 24 hours elapse
		for range ticker.C {
			runFetches(pool, fredAPIKey)
		}
	}()

	mux := http.NewServeMux()

	mux.Handle("/api/series/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seriesID := strings.TrimPrefix(r.URL.Path, "/api/series/")
		if seriesID == "" {
			http.Error(w, "missing series id", http.StatusBadRequest)
			return
		}

		if err := fetchSeries(pool, fredAPIKey, seriesID); err != nil {
			log.Printf("handler: %v", err)
			http.Error(w, "failed to fetch series", http.StatusInternalServerError)
			return
		}

		rows, err := pool.Query(context.Background(), `
			SELECT date, value
			FROM series_observations
			WHERE series_id = $1
			ORDER BY date ASC
		`, seriesID)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		observations := []observation{}
		for rows.Next() {
			var date time.Time
			var value float64
			if err := rows.Scan(&date, &value); err != nil {
				http.Error(w, "scan error", http.StatusInternalServerError)
				return
			}
			observations = append(observations, observation{
				Date:  date.Format("2006-01-02"),
				Value: value,
			})
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "rows error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(observations)
	}))

	// for file system details see backend/Dockerfile
	mux.Handle("/", http.FileServer(http.Dir("dist")))

	manager := &autocert.Manager{
		// see docker-compose.yml for details on certs volume
		Cache:      autocert.DirCache("/certs"),
		Prompt:     autocert.AcceptTOS,
		HostPolicy: autocert.HostWhitelist("paralx.org", "www.paralx.org"),
	}

	// port 443: HTTPS
	httpsServer := &http.Server{
		Addr:      ":443",
		Handler:   mux,
		TLSConfig: manager.TLSConfig(),
	}

	redirectToHTTPS := func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://"+r.Host+r.URL.RequestURI(), http.StatusMovedPermanently)
	}
	// port 80: redirects to HTTPS and handles Let's Encrypt HTTP challenges
	httpServer := &http.Server{
		Addr:    ":80",
		Handler: manager.HTTPHandler(http.HandlerFunc(redirectToHTTPS)),
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()

	log.Fatal(httpsServer.ListenAndServeTLS("", ""))
}

// fetchSeries fetches one series from FRED and upserts it into the database.
// It respects the 24-hour cache in series_fetches and is safe to call
// from both the scheduler and the HTTP handler.
func fetchSeries(pool *pgxpool.Pool, apiKey string, id string) error {
	var lastFetched time.Time
	err := pool.QueryRow(context.Background(), `
		SELECT last_fetched_at FROM series_fetches WHERE series_id = $1
	`, id).Scan(&lastFetched)
	if err == nil && time.Since(lastFetched) <= 24*time.Hour {
		log.Printf("scheduler: %s is up to date, skipping", id)
		return nil
	}

	url := fmt.Sprintf(
		"%s?series_id=%s&api_key=%s&file_type=json",
		fredBaseURL, id, apiKey,
	)
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("fetch %s: %w", id, err)
	}

	var fred fredResponse
	decodeErr := json.NewDecoder(resp.Body).Decode(&fred)
	resp.Body.Close()
	if decodeErr != nil {
		return fmt.Errorf("decode %s: %w", id, decodeErr)
	}

	for _, obs := range fred.FredObservations {
		if obs.Value == "." {
			continue
		}
		value, err := strconv.ParseFloat(obs.Value, 64)
		if err != nil {
			log.Printf("scheduler: skipping unparseable value %q for %s on %s", obs.Value, id, obs.Date)
			continue
		}
		_, err = pool.Exec(context.Background(), `
			INSERT INTO series_observations (series_id, date, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (series_id, date) DO UPDATE SET value = EXCLUDED.value
		`, id, obs.Date, value)
		if err != nil {
			log.Printf("scheduler: upsert %s %s: %v", id, obs.Date, err)
		}
	}

	_, err = pool.Exec(context.Background(), `
		INSERT INTO series_fetches (series_id, last_fetched_at)
		VALUES ($1, NOW())
		ON CONFLICT (series_id) DO UPDATE SET last_fetched_at = NOW()
	`, id)
	if err != nil {
		return fmt.Errorf("update series_fetches %s: %w", id, err)
	}

	log.Printf("scheduler: %s updated, %d observations", id, len(fred.FredObservations))
	return nil
}

func runFetches(pool *pgxpool.Pool, apiKey string) {
	for _, id := range seriesIDs {
		if err := fetchSeries(pool, apiKey, id); err != nil {
			log.Printf("scheduler: %v", err)
		}
	}
}
