package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type observation struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
}

func seriesHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		seriesID := strings.TrimPrefix(r.URL.Path, "/api/series/")
		if seriesID == "" {
			http.Error(w, "missing series id", http.StatusBadRequest)
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
	}
}
