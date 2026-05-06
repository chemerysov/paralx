package main

import (
	"log"
	"net/http"
	"os"

	"golang.org/x/crypto/acme/autocert"
)

func main() {
	fredAPIKey := os.Getenv("FRED_API_KEY")
	if fredAPIKey == "" {
		log.Fatal("FRED_API_KEY environment variable is not set")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	pool := connectDB(databaseURL)
	defer pool.Close()

	runMigrations(pool)

	startScheduler(pool, fredAPIKey)

	mux := http.NewServeMux()
	mux.Handle("/api/series/", seriesHandler(pool))
	// for file system details see backend/Dockerfile
	mux.Handle("/", http.FileServer(http.Dir("dist")))

	manager := &autocert.Manager{
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
