package main

import (
	"log"
	"net/http"

	"golang.org/x/crypto/acme/autocert"
)

func main() {
	mux := http.NewServeMux()
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
