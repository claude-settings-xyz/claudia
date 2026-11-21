package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"fyne.io/systray"

	"claudia/internal/claude"
	"claudia/internal/server"
	"claudia/web"
)

var version = "dev"

func main() {
	port := flag.Int("port", 7377, "port for the local web UI")
	noOpen := flag.Bool("no-open", false, "don't open the browser at launch")
	flag.Parse()

	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(*port))
	apiURL := "http://" + addr
	uiURL := cmp.Or(web.DevURL, apiURL)

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		if isRunning(apiURL) {
			openBrowser(uiURL)
			return
		}
		log.Fatalf("listen on %s: %v", addr, err)
	}

	paths, err := claude.DefaultPaths()
	if err != nil {
		log.Fatal(err)
	}
	api, err := server.New(paths, version)
	if err != nil {
		log.Fatal(err)
	}
	srv := &http.Server{
		Handler:           api.Handler(strconv.Itoa(*port), web.Handler()),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		if err := srv.Serve(listener); !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()
	log.Printf("claudia %s is running at %s", version, uiURL)

	if !*noOpen {
		openBrowser(uiURL)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signals
		systray.Quit()
	}()

	runTray(uiURL, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	})
}

// isRunning checks if another Claudia instance already uses the address.
func isRunning(url string) bool {
	req, err := http.NewRequest(http.MethodGet, url+"/api/health", nil)
	if err != nil {
		return false
	}
	req.Header.Set(server.Header, "1")

	client := http.Client{Timeout: time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	var health struct {
		App string `json:"app"`
	}
	return json.NewDecoder(resp.Body).Decode(&health) == nil && health.App == "claudia"
}
